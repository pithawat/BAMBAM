package settings

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Viewer is the logged-in user with their role key and its effective permissions (the guard rules
// G1–G3 need both, CR-006).
type Viewer struct {
	ID          uuid.UUID
	RoleKey     string
	Permissions []string
}

func (v Viewer) Can(key string) bool { return slices.Contains(v.Permissions, key) }

// RoleAdmin is the platform roles service: the role list (Stage 1) and F29 role / matrix editing
// (Stage 2). The rules (system roles, in use, version, unknown keys) live there; the CR-006 guard
// rules live in this module (guards.go).
type RoleAdmin interface {
	List(ctx context.Context) ([]roles.Role, error)
	Create(ctx context.Context, actor uuid.UUID, in roles.CreateInput) (roles.Role, error)
	Update(ctx context.Context, actor, id uuid.UUID, in roles.UpdateInput) (roles.Role, error)
	Delete(ctx context.Context, actor, id uuid.UUID) error
	Matrix(ctx context.Context) (roles.Matrix, error)
	SaveMatrix(ctx context.Context, actor uuid.UUID, version int32, changes []roles.Change) (roles.Matrix, error)
}

// UserAdmin is the platform users admin (F15, Stage 3): search, detail with the lock reason, role change.
type UserAdmin interface {
	Search(ctx context.Context, in users.SearchInput) ([]users.Summary, int64, error)
	Get(ctx context.Context, viewer, id uuid.UUID) (users.Summary, string, error)
	ChangeRole(ctx context.Context, actor, id, roleID uuid.UUID) (users.Summary, error)
}

// AuditReader is the platform audit log as settings lists it (F30, Stage 3).
type AuditReader interface {
	List(ctx context.Context, f audit.Filter) ([]audit.Item, int64, error)
	Actors(ctx context.Context) ([]people.Ref, error)
	RoleHistory(ctx context.Context, userID uuid.UUID) ([]audit.RoleChange, error)
}

// Deps are the services settings orchestrates (it has no tables of its own, D-048). The Stage 4
// interfaces (Locations, Assets, RepairUsage) are in service_places.go.
type Deps struct {
	Roles     RoleAdmin
	Users     UserAdmin
	Audit     AuditReader
	Locations Locations
	Assets    Assets
	Repair    RepairUsage
	Master    RepairMaster
}

type Service struct {
	roles     RoleAdmin
	users     UserAdmin
	audit     AuditReader
	locations Locations
	assets    Assets
	repair    RepairUsage
	master    RepairMaster
}

func NewService(d Deps) *Service {
	return &Service{roles: d.Roles, users: d.Users, audit: d.Audit, locations: d.Locations, assets: d.Assets, repair: d.Repair, master: d.Master}
}

// RoleItem is a #2 role with what the viewer may do with it (CR-006): Guard = the G1 / G2 rule that
// locks its edit / delete ("" = none), Assignable = it may be given to someone in S25.
type RoleItem struct {
	roles.Role
	Guard      string
	Assignable bool
}

// Roles implements #2: every role with its user count, in contract order. S24 lists them and the
// S25 role filter / picker uses them, so any of the three permissions may read it. The route checks
// the same keys.
func (s *Service) Roles(ctx context.Context, v Viewer) ([]RoleItem, error) {
	if !v.Can(PermRoles) && !seesUsers(v) {
		return nil, apperr.ErrForbidden
	}
	list, err := s.roles.List(ctx)
	if err != nil {
		return nil, err
	}
	m, err := s.roles.Matrix(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]RoleItem, 0, len(list))
	for _, r := range list {
		item := RoleItem{Role: r, Guard: roleGuard(v, r.Key)}
		if mr, ok := matrixRole(m, r.ID.String()); ok {
			item.Assignable = assignGuard(v, mr) == ""
		}
		out = append(out, item)
	}
	return out, nil
}

// CreateRole implements #3. Copying needs G3: the source's permissions within the viewer's.
func (s *Service) CreateRole(ctx context.Context, v Viewer, in roles.CreateInput) (roles.Role, error) {
	if !v.Can(PermRoles) {
		return roles.Role{}, apperr.ErrForbidden
	}
	if in.CopyFrom != nil && !v.isSuperAdmin() {
		m, err := s.roles.Matrix(ctx)
		if err != nil {
			return roles.Role{}, err
		}
		if src, ok := matrixRole(m, in.CopyFrom.String()); ok && !holdsAll(v, src.Permissions) {
			return roles.Role{}, guardError(RuleEscalation)
		}
	}
	return s.roles.Create(ctx, v.ID, in)
}

// roleGuardByID applies G1 / G2 to a role id; an unknown id passes (the roles service answers).
func (s *Service) roleGuardByID(ctx context.Context, v Viewer, id uuid.UUID) error {
	if v.isSuperAdmin() {
		return nil
	}
	list, err := s.roles.List(ctx)
	if err != nil {
		return err
	}
	for _, r := range list {
		if r.ID != id {
			continue
		}
		if rule := roleGuard(v, r.Key); rule != "" {
			return guardError(rule)
		}
	}
	return nil
}

// UpdateRole implements #4 (G1 / G2).
func (s *Service) UpdateRole(ctx context.Context, v Viewer, id uuid.UUID, in roles.UpdateInput) (roles.Role, error) {
	if !v.Can(PermRoles) {
		return roles.Role{}, apperr.ErrForbidden
	}
	if err := s.roleGuardByID(ctx, v, id); err != nil {
		return roles.Role{}, err
	}
	return s.roles.Update(ctx, v.ID, id, in)
}

// DeleteRole implements #5 (G1 / G2).
func (s *Service) DeleteRole(ctx context.Context, v Viewer, id uuid.UUID) error {
	if !v.Can(PermRoles) {
		return apperr.ErrForbidden
	}
	if err := s.roleGuardByID(ctx, v, id); err != nil {
		return err
	}
	return s.roles.Delete(ctx, v.ID, id)
}

// MatrixView is #6 for one viewer (CR-006): Grantable = the keys they may tick or untick, Guards =
// role id → the G1 / G2 rule that locks that row.
type MatrixView struct {
	roles.Matrix
	Grantable []string
	Guards    map[uuid.UUID]string
}

func matrixView(v Viewer, m roles.Matrix) MatrixView {
	out := MatrixView{Matrix: m, Grantable: grantable(v, catalogKeys(m)), Guards: map[uuid.UUID]string{}}
	for _, r := range m.Roles {
		if rule := roleGuard(v, r.Key); rule != "" {
			out.Guards[r.ID] = rule
		}
	}
	return out
}

// Matrix implements #6.
func (s *Service) Matrix(ctx context.Context, v Viewer) (MatrixView, error) {
	if !v.Can(PermRoles) {
		return MatrixView{}, apperr.ErrForbidden
	}
	m, err := s.roles.Matrix(ctx)
	if err != nil {
		return MatrixView{}, err
	}
	return matrixView(v, m), nil
}

// SaveMatrix implements #7: every cell passes G1–G3 first, then the roles service saves them all.
func (s *Service) SaveMatrix(ctx context.Context, v Viewer, version int32, changes []roles.Change) (MatrixView, error) {
	if !v.Can(PermRoles) {
		return MatrixView{}, apperr.ErrForbidden
	}
	if !v.isSuperAdmin() {
		m, err := s.roles.Matrix(ctx)
		if err != nil {
			return MatrixView{}, err
		}
		if err := matrixGuard(v, m, changes); err != nil {
			return MatrixView{}, err
		}
	}
	m, err := s.roles.SaveMatrix(ctx, v.ID, version, changes)
	if err != nil {
		return MatrixView{}, err
	}
	return matrixView(v, m), nil
}

// seesUsers: the users list and detail are read with `users.view` or `users.manage` (CR-006).
func seesUsers(v Viewer) bool { return v.Can(PermUsersView) || v.Can(PermUsers) }

// SearchUsers implements #8.
func (s *Service) SearchUsers(ctx context.Context, v Viewer, in users.SearchInput) ([]users.Summary, int64, error) {
	if !seesUsers(v) {
		return nil, 0, apperr.ErrForbidden
	}
	return s.users.Search(ctx, in)
}

// UserDetail is #9: the summary, the lock reason ("" = can change) and the role history.
type UserDetail struct {
	users.Summary
	CannotChangeReason string
	RoleHistory        []audit.RoleChange
}

// Reasons #9 adds to the users admin's SELF / LOCKED_BY_ENV (CR-006).
const (
	ReasonReadOnly   = "READ_ONLY"   // the viewer has `users.view` only
	ReasonSuperAdmin = "SUPER_ADMIN" // G2: the user is a Superadmin and the viewer is not
)

// User implements #9.
func (s *Service) User(ctx context.Context, v Viewer, id uuid.UUID) (UserDetail, error) {
	if !seesUsers(v) {
		return UserDetail{}, apperr.ErrForbidden
	}
	sum, reason, err := s.users.Get(ctx, v.ID, id)
	if err != nil {
		return UserDetail{}, err
	}
	switch {
	case reason != "":
	case !v.Can(PermUsers):
		reason = ReasonReadOnly
	case roleGuard(v, sum.RoleRef.Key) == RuleSuperAdmin:
		reason = ReasonSuperAdmin
	}
	hist, err := s.audit.RoleHistory(ctx, id)
	if err != nil {
		return UserDetail{}, err
	}
	return UserDetail{Summary: sum, CannotChangeReason: reason, RoleHistory: hist}, nil
}

// ChangeUserRole implements #10. G2 / G3 first (not a Superadmin's role, not to super_admin, only a
// role within the viewer's permissions); the viewer's own row stays CANNOT_CHANGE_SELF.
func (s *Service) ChangeUserRole(ctx context.Context, v Viewer, id, roleID uuid.UUID) (users.Summary, error) {
	if !v.Can(PermUsers) {
		return users.Summary{}, apperr.ErrForbidden
	}
	if !v.isSuperAdmin() && id != v.ID {
		if err := s.guardAssign(ctx, v, id, roleID); err != nil {
			return users.Summary{}, err
		}
	}
	return s.users.ChangeRole(ctx, v.ID, id, roleID)
}

// guardAssign: unknown users / roles pass (the users admin answers USER_NOT_FOUND / ROLE_NOT_FOUND).
func (s *Service) guardAssign(ctx context.Context, v Viewer, id, roleID uuid.UUID) error {
	cur, _, err := s.users.Get(ctx, v.ID, id)
	if err != nil {
		return err
	}
	if roleGuard(v, cur.RoleRef.Key) == RuleSuperAdmin {
		return guardError(RuleSuperAdmin)
	}
	m, err := s.roles.Matrix(ctx)
	if err != nil {
		return err
	}
	if target, ok := matrixRole(m, roleID.String()); ok {
		if rule := assignGuard(v, target); rule != "" {
			return guardError(rule)
		}
	}
	return nil
}

// Audit implements #11.
func (s *Service) Audit(ctx context.Context, v Viewer, f audit.Filter) ([]audit.Item, int64, error) {
	if !v.Can(PermAudit) {
		return nil, 0, apperr.ErrForbidden
	}
	return s.audit.List(ctx, f)
}

// AuditActors implements #12.
func (s *Service) AuditActors(ctx context.Context, v Viewer) ([]people.Ref, error) {
	if !v.Can(PermAudit) {
		return nil, apperr.ErrForbidden
	}
	return s.audit.Actors(ctx)
}
