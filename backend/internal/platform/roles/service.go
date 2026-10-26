// Package roles owns roles as data (settings Stage 1, D-049): the role list with user counts and
// the stored permissions of a role. The matrix editing (F29) is added in settings Stage 2.
package roles

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
)

var ErrRoleNotFound = apperr.New(apperr.KindNotFound, "ROLE_NOT_FOUND", "role not found")

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

type Repository interface {
	List(ctx context.Context) ([]Role, error)
	ByKey(ctx context.Context, key string) (Role, error)
	StoredPermissions(ctx context.Context, roleID uuid.UUID) ([]string, error)
}

type Service struct {
	repo Repository
	reg  *permissions.Registry
}

func NewService(repo Repository, reg *permissions.Registry) *Service {
	return &Service{repo: repo, reg: reg}
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
