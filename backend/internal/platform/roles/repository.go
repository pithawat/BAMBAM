package roles

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgRepository struct {
	q *platformdb.Queries
}

func NewRepository(dbtx platformdb.DBTX) *PgRepository {
	return &PgRepository{q: platformdb.New(dbtx)}
}

func (r *PgRepository) List(ctx context.Context) ([]Role, error) {
	rows, err := r.q.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Role, 0, len(rows))
	for _, row := range rows {
		role := toRole(row.PlatformRole)
		role.UserCount = row.UserCount
		if row.UpdatedByUserID != nil {
			code := ""
			if row.UpdatedByEmployeeCode != nil {
				code = *row.UpdatedByEmployeeCode
			}
			role.UpdatedBy = &people.Ref{
				ID:         *row.UpdatedByUserID,
				Name:       people.DisplayName(code, row.UpdatedByFirstNameTh, row.UpdatedByLastNameTh, row.UpdatedByFirstNameEn, row.UpdatedByLastNameEn),
				Department: row.UpdatedByDepartment,
			}
		}
		out = append(out, role)
	}
	return out, nil
}

func (r *PgRepository) ByKey(ctx context.Context, key string) (Role, error) {
	row, err := r.q.GetRoleByKey(ctx, key)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, ErrRoleNotFound
	}
	if err != nil {
		return Role{}, err
	}
	return toRole(row), nil
}

func (r *PgRepository) StoredPermissions(ctx context.Context, roleID uuid.UUID) ([]string, error) {
	return r.q.ListRolePermissions(ctx, roleID)
}

func toRole(r platformdb.PlatformRole) Role {
	return Role{
		ID: r.ID, Key: r.Key, Name: r.Name, Description: r.Description,
		IsSystem: r.IsSystem, IsLocked: r.IsLocked, UpdatedAt: r.UpdatedAt,
	}
}
