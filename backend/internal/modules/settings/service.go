package settings

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
)

// Viewer is the logged-in user with the effective permissions of their role.
type Viewer struct {
	ID          uuid.UUID
	Permissions []string
}

func (v Viewer) Can(key string) bool { return slices.Contains(v.Permissions, key) }

// RoleLister is the platform roles service.
type RoleLister interface {
	List(ctx context.Context) ([]roles.Role, error)
}

type Service struct {
	roles RoleLister
}

func NewService(roles RoleLister) *Service {
	return &Service{roles: roles}
}

// Roles implements #2: every role with its user count, in contract order. S24 lists them and the
// S25 role filter uses them, so either permission may read it. The route checks the same keys.
func (s *Service) Roles(ctx context.Context, v Viewer) ([]roles.Role, error) {
	if !v.Can(PermRoles) && !v.Can(PermUsers) {
		return nil, apperr.ErrForbidden
	}
	return s.roles.List(ctx)
}
