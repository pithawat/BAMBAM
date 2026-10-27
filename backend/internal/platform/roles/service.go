// Package roles owns roles as data (settings Stage 1, D-049): the role list with user counts, the
// stored permissions of a role, and (settings Stage 2, F29) role add / edit / delete and the
// permission matrix. Callers check `settings.roles.manage` before calling the write methods.
package roles

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
)

// Error codes from settings 04-api-contract.md → Stage 2.
var (
	ErrRoleNotFound      = apperr.New(apperr.KindNotFound, "ROLE_NOT_FOUND", "role not found")
	ErrNameTaken         = apperr.New(apperr.KindConflict, "NAME_TAKEN", "role name already used")
	ErrVersionConflict   = apperr.New(apperr.KindConflict, "VERSION_CONFLICT", "changed by someone else")
	ErrRoleInUse         = apperr.New(apperr.KindConflict, "ROLE_IN_USE", "role still has users")
	ErrSystemRole        = apperr.New(apperr.KindBusinessRule, "SYSTEM_ROLE", "system role cannot be changed this way")
	ErrUnknownPermission = apperr.New(apperr.KindInvalid, "UNKNOWN_PERMISSION", "permission key not in the catalog")
	ErrFixedPermission   = apperr.New(apperr.KindBusinessRule, "FIXED_PERMISSION", "settings permissions are fixed by role")
)

const (
	maxNameLen        = 50  // BR-F29-4
	maxDescriptionLen = 200 // contract #3
	auditTargetRole   = "role"
)

// Role is the contract's `Role` (settings 04-api-contract.md).
type Role struct {
	ID          uuid.UUID
	Key         string
	Name        string
	Description string
	IsSystem    bool
	IsLocked    bool
	UserCount   int64
	UpdatedAt   time.Time
	UpdatedBy   *people.Ref
}

// MatrixMeta is the matrix version row (D-051).
type MatrixMeta struct {
	Version   int32
	UpdatedAt time.Time
	UpdatedBy *people.Ref
}

// MatrixRole is one row of the matrix: the role and its effective permissions (fixed keys included).
type MatrixRole struct {
	Role
	Permissions []string
}

// Matrix is contract #6.
type Matrix struct {
	MatrixMeta
	Systems []permissions.System
	Roles   []MatrixRole
}

// Change is one cell of a matrix save (#7).
type Change struct {
	RoleID     uuid.UUID
	Permission string
	Granted    bool
}

// CreateInput is #3. CopyFrom nil = base permissions only.
type CreateInput struct {
	Name        string
	Description string
	CopyFrom    *uuid.UUID
}

// UpdateInput is #4: nil fields stay as they are; UpdatedAt is the version the client edited.
type UpdateInput struct {
	Name        *string
	Description *string
	UpdatedAt   time.Time
}

type Repository interface {
	List(ctx context.Context) ([]Role, error)
	ByKey(ctx context.Context, key string) (Role, error)
	StoredPermissions(ctx context.Context, roleID uuid.UUID) ([]string, error)
	AllStoredPermissions(ctx context.Context) (map[uuid.UUID][]string, error)
	MatrixMeta(ctx context.Context) (MatrixMeta, error)
	// InTx runs fn in one transaction with a repository bound to it.
	InTx(ctx context.Context, fn func(tx TxRepository) error) error
}

// TxRepository is used inside write transactions.
type TxRepository interface {
	// LockRole returns ErrRoleNotFound for an unknown id.
	LockRole(ctx context.Context, id uuid.UUID) (Role, error)
	// InsertRole / UpdateRole return ErrNameTaken when the name (case-insensitive) is used.
	InsertRole(ctx context.Context, key, name, description string, actor uuid.UUID) (Role, error)
	UpdateRole(ctx context.Context, id uuid.UUID, name, description string, actor uuid.UUID) (Role, error)
	// DeleteRole returns ErrRoleInUse when a role assignment still points at it.
	DeleteRole(ctx context.Context, id uuid.UUID) error
	// RealUserCount counts the role's users without demo users.
	RealUserCount(ctx context.Context, role Role) (int64, error)
	// DeleteDemoUsers removes the role's demo users (or at least their assignment).
	DeleteDemoUsers(ctx context.Context, roleID uuid.UUID) error
	StoredPermissions(ctx context.Context, roleID uuid.UUID) ([]string, error)
	Grant(ctx context.Context, roleID uuid.UUID, key string) error
	Revoke(ctx context.Context, roleID uuid.UUID, key string) error
	// LockMatrix locks the matrix version row and returns the version.
	LockMatrix(ctx context.Context) (int32, error)
	BumpMatrix(ctx context.Context, actor uuid.UUID) error
	Audit(ctx context.Context, e audit.Entry) error
}

type Service struct {
	repo   Repository
	reg    *permissions.Registry
	newKey func() string
}

func NewService(repo Repository, reg *permissions.Registry) *Service {
	return &Service{repo: repo, reg: reg, newKey: randomKey}
}

// randomKey is the key of a new role: `r_` + 8 hex (contract `RoleRef`). A collision (1 in 4·10⁹)
// fails the insert with a 500; the user saves again.
func randomKey() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return "r_" + hex.EncodeToString(b)
}

// List returns every role in contract order with its user count (demo users excluded).
func (s *Service) List(ctx context.Context) ([]Role, error) {
	return s.repo.List(ctx)
}

// ByKey returns ErrRoleNotFound for an unknown key.
func (s *Service) ByKey(ctx context.Context, key string) (Role, error) {
	return s.repo.ByKey(ctx, key)
}

// PermissionsOf is the effective permission set of a role (stored + fixed; super_admin = all).
func (s *Service) PermissionsOf(ctx context.Context, r Role) ([]string, error) {
	stored, err := s.repo.StoredPermissions(ctx, r.ID)
	if err != nil {
		return nil, err
	}
	return s.reg.Effective(r.Key, stored), nil
}

// auditData is the `data` of a role audit row; settings Stage 3 maps it to `AuditEntry`.
type auditData struct {
	EntityName string        `json:"entityName"`
	Changes    []auditChange `json:"changes"`
}

type auditChange struct {
	Field  string  `json:"field"`
	Before *string `json:"before,omitempty"`
	After  *string `json:"after,omitempty"`
	// pointers so a permissions change always writes both lists, `[]` included
	Added   *[]string `json:"added,omitempty"`
	Removed *[]string `json:"removed,omitempty"`
}

func roleAudit(actor uuid.UUID, action string, r Role, changes []auditChange) audit.Entry {
	if changes == nil {
		changes = []auditChange{}
	}
	return audit.Entry{ActorID: &actor, Action: action, TargetType: auditTargetRole, TargetID: r.ID.String(),
		Data: auditData{EntityName: r.Name, Changes: changes}}
}

func validateText(fields map[string]string, field, v string, required bool, max int) {
	switch {
	case required && v == "":
		fields[field] = "REQUIRED"
	case utf8.RuneCountInString(v) > max:
		fields[field] = "TOO_LONG"
	}
}

// Create implements #3 (F29 step 4). Copying takes the source's editable permissions; the fixed
// `settings.*` keys are never copied and a new role never has them (BR-F29-8).
func (s *Service) Create(ctx context.Context, actor uuid.UUID, in CreateInput) (Role, error) {
	name, desc := strings.TrimSpace(in.Name), strings.TrimSpace(in.Description)
	fields := map[string]string{}
	validateText(fields, "name", name, true, maxNameLen)
	validateText(fields, "description", desc, false, maxDescriptionLen)
	if len(fields) > 0 {
		return Role{}, apperr.Validation(fields)
	}
	var created Role
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		var copied []string
		if in.CopyFrom != nil {
			src, err := tx.LockRole(ctx, *in.CopyFrom)
			if errors.Is(err, ErrRoleNotFound) {
				return apperr.Validation(map[string]string{"copyFromRoleId": "INVALID"})
			}
			if err != nil {
				return err
			}
			stored, err := tx.StoredPermissions(ctx, src.ID)
			if err != nil {
				return err
			}
			for _, k := range s.reg.Effective(src.Key, stored) {
				if !s.reg.IsFixed(k) {
					copied = append(copied, k)
				}
			}
		}
		r, err := tx.InsertRole(ctx, s.newKey(), name, desc, actor)
		if err != nil {
			return err
		}
		for _, k := range copied {
			if err := tx.Grant(ctx, r.ID, k); err != nil {
				return err
			}
		}
		created = r
		return tx.Audit(ctx, roleAudit(actor, "create", r, nil))
	})
	if err != nil {
		return Role{}, err
	}
	return s.fresh(ctx, created.ID)
}

// Update implements #4: rename / describe (F29 step 5, `employee` included). super_admin is locked.
func (s *Service) Update(ctx context.Context, actor, id uuid.UUID, in UpdateInput) (Role, error) {
	fields := map[string]string{}
	var name, desc string
	if in.Name != nil {
		name = strings.TrimSpace(*in.Name)
		validateText(fields, "name", name, true, maxNameLen)
	}
	if in.Description != nil {
		desc = strings.TrimSpace(*in.Description)
		validateText(fields, "description", desc, false, maxDescriptionLen)
	}
	if in.UpdatedAt.IsZero() {
		fields["updatedAt"] = "REQUIRED"
	}
	if len(fields) > 0 {
		return Role{}, apperr.Validation(fields)
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockRole(ctx, id)
		if err != nil {
			return err
		}
		if cur.IsLocked {
			return ErrSystemRole
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrVersionConflict
		}
		if in.Name == nil {
			name = cur.Name
		}
		if in.Description == nil {
			desc = cur.Description
		}
		var changes []auditChange
		if name != cur.Name {
			changes = append(changes, auditChange{Field: "name", Before: &cur.Name, After: &name})
		}
		if desc != cur.Description {
			changes = append(changes, auditChange{Field: "description", Before: &cur.Description, After: &desc})
		}
		if len(changes) == 0 {
			return nil
		}
		r, err := tx.UpdateRole(ctx, id, name, desc, actor)
		if err != nil {
			return err
		}
		return tx.Audit(ctx, roleAudit(actor, "update", r, changes))
	})
	if err != nil {
		return Role{}, err
	}
	return s.fresh(ctx, id)
}

// Delete implements #5 (BR-F29-6): only a non-system role without real users; its demo users go
// with it.
func (s *Service) Delete(ctx context.Context, actor, id uuid.UUID) error {
	return s.repo.InTx(ctx, func(tx TxRepository) error {
		r, err := tx.LockRole(ctx, id)
		if err != nil {
			return err
		}
		if r.IsSystem || r.IsLocked {
			return ErrSystemRole
		}
		n, err := tx.RealUserCount(ctx, r)
		if err != nil {
			return err
		}
		if n > 0 {
			return ErrRoleInUse
		}
		if err := tx.DeleteDemoUsers(ctx, r.ID); err != nil {
			return err
		}
		if err := tx.DeleteRole(ctx, r.ID); err != nil {
			return err
		}
		return tx.Audit(ctx, roleAudit(actor, "delete", r, nil))
	})
}

// Matrix implements #6: the catalog, every role with its effective permissions, and the version.
func (s *Service) Matrix(ctx context.Context) (Matrix, error) {
	meta, err := s.repo.MatrixMeta(ctx)
	if err != nil {
		return Matrix{}, err
	}
	list, err := s.repo.List(ctx)
	if err != nil {
		return Matrix{}, err
	}
	stored, err := s.repo.AllStoredPermissions(ctx)
	if err != nil {
		return Matrix{}, err
	}
	m := Matrix{MatrixMeta: meta, Systems: s.reg.Systems(), Roles: make([]MatrixRole, 0, len(list))}
	for _, r := range list {
		m.Roles = append(m.Roles, MatrixRole{Role: r, Permissions: s.reg.Effective(r.Key, stored[r.ID])})
	}
	return m, nil
}

// SaveMatrix implements #7 (F29 steps 2–3): all changes in one transaction on the locked version
// row (D-051), one `permissions_change` audit row per role whose set really changed. The new
// permissions apply on each user's next request (BR-F29-7).
func (s *Service) SaveMatrix(ctx context.Context, actor uuid.UUID, version int32, changes []Change) (Matrix, error) {
	if len(changes) == 0 {
		return Matrix{}, apperr.Validation(map[string]string{"changes": "REQUIRED"})
	}
	// the last change of a cell wins; roles keep the order they first appear in
	byRole := map[uuid.UUID]map[string]bool{}
	var roleOrder []uuid.UUID
	for _, c := range changes {
		if !s.reg.Known(c.Permission) {
			return Matrix{}, ErrUnknownPermission
		}
		if s.reg.IsFixed(c.Permission) {
			return Matrix{}, ErrFixedPermission
		}
		if byRole[c.RoleID] == nil {
			byRole[c.RoleID] = map[string]bool{}
			roleOrder = append(roleOrder, c.RoleID)
		}
		byRole[c.RoleID][c.Permission] = c.Granted
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockMatrix(ctx)
		if err != nil {
			return err
		}
		if cur != version {
			return ErrVersionConflict
		}
		for _, id := range roleOrder {
			r, err := tx.LockRole(ctx, id)
			if err != nil {
				return err
			}
			if r.IsLocked {
				return ErrSystemRole
			}
			stored, err := tx.StoredPermissions(ctx, r.ID)
			if err != nil {
				return err
			}
			var added, removed []string
			for _, k := range s.reg.Ordered(keys(byRole[id])) {
				has := slices.Contains(stored, k)
				switch granted := byRole[id][k]; {
				case granted && !has:
					if err := tx.Grant(ctx, r.ID, k); err != nil {
						return err
					}
					added = append(added, s.reg.Label(k))
				case !granted && has:
					if err := tx.Revoke(ctx, r.ID, k); err != nil {
						return err
					}
					removed = append(removed, s.reg.Label(k))
				}
			}
			if len(added) == 0 && len(removed) == 0 {
				continue
			}
			added, removed = orEmpty(added), orEmpty(removed)
			change := auditChange{Field: "permissions", Added: &added, Removed: &removed}
			if err := tx.Audit(ctx, roleAudit(actor, "permissions_change", r, []auditChange{change})); err != nil {
				return err
			}
		}
		return tx.BumpMatrix(ctx, actor)
	})
	if err != nil {
		return Matrix{}, err
	}
	return s.Matrix(ctx)
}

// fresh re-reads one role with its user count and updater (the list is short).
func (s *Service) fresh(ctx context.Context, id uuid.UUID) (Role, error) {
	list, err := s.repo.List(ctx)
	if err != nil {
		return Role{}, err
	}
	for _, r := range list {
		if r.ID == id {
			return r, nil
		}
	}
	return Role{}, ErrRoleNotFound
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// orEmpty writes an empty list as [] rather than null.
func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
