package users

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
)

// Users admin (settings F15, #8–#10): search real users, read one with the role lock reason, change
// the role. A role change applies on the user's next request (permissions load per request, BR-F29-7).

var (
	ErrCannotChangeSelf = apperr.New(apperr.KindBusinessRule, "CANNOT_CHANGE_SELF", "cannot change own role")
	ErrRoleLocked       = apperr.New(apperr.KindBusinessRule, "ROLE_LOCKED", "role is set by SUPER_ADMIN_EMPLOYEE_CODES")
	// ErrTargetRoleNotFound: the picked role was deleted meanwhile (#10 answers 422, not 404).
	ErrTargetRoleNotFound = apperr.New(apperr.KindBusinessRule, "ROLE_NOT_FOUND", "role not found")
)

// Reasons in #9 `cannotChangeReason`.
const (
	ReasonSelf        = "SELF"
	ReasonLockedByEnv = "LOCKED_BY_ENV"
)

// RoleRef is the contract's `RoleRef`.
type RoleRef struct {
	ID   uuid.UUID `json:"id"`
	Key  string    `json:"key"`
	Name string    `json:"name"`
}

// Summary is the contract's `UserSummary` (+ #9 detail fields).
type Summary struct {
	User
	RoleRef         RoleRef
	RoleLockedByEnv bool
	LastLoginAt     *time.Time
	FirstLoginAt    time.Time
}

// SearchInput is #8. Q shorter than 2 characters is ignored.
type SearchInput struct {
	Q        string
	RoleID   *uuid.UUID
	Page     int
	PageSize int
}

type AdminRepository interface {
	Search(ctx context.Context, in SearchInput) ([]Summary, int64, error)
	// GetSummary returns ErrUserNotFound for an unknown id or a demo user.
	GetSummary(ctx context.Context, id uuid.UUID) (Summary, error)
	InTx(ctx context.Context, fn func(tx AdminTx) error) error
}

type AdminTx interface {
	// LockRole returns ErrTargetRoleNotFound for an unknown id; it holds the role until commit.
	LockRole(ctx context.Context, id uuid.UUID) (RoleRef, error)
	SetRole(ctx context.Context, employeeCode string, roleID uuid.UUID) error
	Audit(ctx context.Context, e audit.Entry) error
}

// EnvLock tells whether an employee code is an env-defined Superadmin (Service.IsEnvSuperAdmin).
type EnvLock interface {
	IsEnvSuperAdmin(employeeCode string) bool
}

type Admin struct {
	repo AdminRepository
	env  EnvLock
}

func NewAdmin(repo AdminRepository, env EnvLock) *Admin {
	return &Admin{repo: repo, env: env}
}

// Search implements #8.
func (a *Admin) Search(ctx context.Context, in SearchInput) ([]Summary, int64, error) {
	in.Q = strings.TrimSpace(in.Q)
	if utf8.RuneCountInString(in.Q) < 2 {
		in.Q = ""
	}
	list, total, err := a.repo.Search(ctx, in)
	if err != nil {
		return nil, 0, err
	}
	for i := range list {
		list[i].RoleLockedByEnv = a.env.IsEnvSuperAdmin(list[i].EmployeeCode)
	}
	return list, total, nil
}

// Get implements #9 (without the history): the summary and why the viewer may not change the role.
func (a *Admin) Get(ctx context.Context, viewer, id uuid.UUID) (Summary, string, error) {
	s, err := a.repo.GetSummary(ctx, id)
	if err != nil {
		return Summary{}, "", err
	}
	s.RoleLockedByEnv = a.env.IsEnvSuperAdmin(s.EmployeeCode)
	return s, a.lockReason(viewer, s), nil
}

func (a *Admin) lockReason(viewer uuid.UUID, s Summary) string {
	switch {
	case s.ID == viewer:
		return ReasonSelf
	case s.RoleLockedByEnv:
		return ReasonLockedByEnv
	}
	return ""
}

// roleChangeData is the audit `data` of a role change: the user's name only (PDPA, no profile).
type roleChangeData struct {
	EntityName string         `json:"entityName"`
	Changes    []audit.Change `json:"changes"`
}

// ChangeRole implements #10 (F15): not yourself, not an env-defined Superadmin; the same role is a
// no-op without an audit row; otherwise the role and its audit row commit together.
func (a *Admin) ChangeRole(ctx context.Context, actor, id, roleID uuid.UUID) (Summary, error) {
	s, err := a.repo.GetSummary(ctx, id)
	if err != nil {
		return Summary{}, err
	}
	s.RoleLockedByEnv = a.env.IsEnvSuperAdmin(s.EmployeeCode)
	switch a.lockReason(actor, s) {
	case ReasonSelf:
		return Summary{}, ErrCannotChangeSelf
	case ReasonLockedByEnv:
		return Summary{}, ErrRoleLocked
	}
	if s.RoleRef.ID == roleID {
		return s, nil
	}
	before := s.RoleRef
	err = a.repo.InTx(ctx, func(tx AdminTx) error {
		r, err := tx.LockRole(ctx, roleID)
		if err != nil {
			return err
		}
		if err := tx.SetRole(ctx, s.EmployeeCode, r.ID); err != nil {
			return err
		}
		from, to := before.Name, r.Name
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "role_change", TargetType: "user", TargetID: s.ID.String(),
			Data: roleChangeData{EntityName: s.DisplayName(), Changes: []audit.Change{{Field: "role", Before: &from, After: &to}}}})
	})
	if err != nil {
		return Summary{}, err
	}
	return a.reload(ctx, id)
}

// reload re-reads a summary after a change (lock flag included).
func (a *Admin) reload(ctx context.Context, id uuid.UUID) (Summary, error) {
	s, err := a.repo.GetSummary(ctx, id)
	if err != nil {
		return Summary{}, err
	}
	s.RoleLockedByEnv = a.env.IsEnvSuperAdmin(s.EmployeeCode)
	return s, nil
}
