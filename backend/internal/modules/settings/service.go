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

// Viewer is the logged-in user with the effective permissions of their role.
type Viewer struct {
	ID          uuid.UUID
	Permissions []string
}

func (v Viewer) Can(key string) bool { return slices.Contains(v.Permissions, key) }

// RoleAdmin is the platform roles service: the role list (Stage 1) and F29 role / matrix editing
// (Stage 2). The rules (system roles, in use, version, fixed keys) live there.
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

// Roles implements #2: every role with its user count, in contract order. S24 lists them and the
// S25 role filter uses them, so either permission may read it. The route checks the same keys.
func (s *Service) Roles(ctx context.Context, v Viewer) ([]roles.Role, error) {
	if !v.Can(PermRoles) && !v.Can(PermUsers) {
		return nil, apperr.ErrForbidden
	}
	return s.roles.List(ctx)
}

// CreateRole implements #3.
func (s *Service) CreateRole(ctx context.Context, v Viewer, in roles.CreateInput) (roles.Role, error) {
	if !v.Can(PermRoles) {
		return roles.Role{}, apperr.ErrForbidden
	}
	return s.roles.Create(ctx, v.ID, in)
}

// UpdateRole implements #4.
func (s *Service) UpdateRole(ctx context.Context, v Viewer, id uuid.UUID, in roles.UpdateInput) (roles.Role, error) {
	if !v.Can(PermRoles) {
		return roles.Role{}, apperr.ErrForbidden
	}
	return s.roles.Update(ctx, v.ID, id, in)
}

// DeleteRole implements #5.
func (s *Service) DeleteRole(ctx context.Context, v Viewer, id uuid.UUID) error {
	if !v.Can(PermRoles) {
		return apperr.ErrForbidden
	}
	return s.roles.Delete(ctx, v.ID, id)
}

// Matrix implements #6.
func (s *Service) Matrix(ctx context.Context, v Viewer) (roles.Matrix, error) {
	if !v.Can(PermRoles) {
		return roles.Matrix{}, apperr.ErrForbidden
	}
	return s.roles.Matrix(ctx)
}

// SaveMatrix implements #7.
func (s *Service) SaveMatrix(ctx context.Context, v Viewer, version int32, changes []roles.Change) (roles.Matrix, error) {
	if !v.Can(PermRoles) {
		return roles.Matrix{}, apperr.ErrForbidden
	}
	return s.roles.SaveMatrix(ctx, v.ID, version, changes)
}

// SearchUsers implements #8.
func (s *Service) SearchUsers(ctx context.Context, v Viewer, in users.SearchInput) ([]users.Summary, int64, error) {
	if !v.Can(PermUsers) {
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

// User implements #9.
func (s *Service) User(ctx context.Context, v Viewer, id uuid.UUID) (UserDetail, error) {
	if !v.Can(PermUsers) {
		return UserDetail{}, apperr.ErrForbidden
	}
	sum, reason, err := s.users.Get(ctx, v.ID, id)
	if err != nil {
		return UserDetail{}, err
	}
	hist, err := s.audit.RoleHistory(ctx, id)
	if err != nil {
		return UserDetail{}, err
	}
	return UserDetail{Summary: sum, CannotChangeReason: reason, RoleHistory: hist}, nil
}

// ChangeUserRole implements #10.
func (s *Service) ChangeUserRole(ctx context.Context, v Viewer, id, roleID uuid.UUID) (users.Summary, error) {
	if !v.Can(PermUsers) {
		return users.Summary{}, apperr.ErrForbidden
	}
	return s.users.ChangeRole(ctx, v.ID, id, roleID)
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
