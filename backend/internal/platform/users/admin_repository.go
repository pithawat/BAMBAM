package users

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgAdminRepository struct {
	pool *pgxpool.Pool
	q    *platformdb.Queries
}

func NewAdminRepository(pool *pgxpool.Pool) *PgAdminRepository {
	return &PgAdminRepository{pool: pool, q: platformdb.New(pool)}
}

func (r *PgAdminRepository) Search(ctx context.Context, in SearchInput) ([]Summary, int64, error) {
	var q *string
	if in.Q != "" {
		q = &in.Q
	}
	total, err := r.q.CountUsers(ctx, platformdb.CountUsersParams{RoleID: in.RoleID, Q: q})
	if err != nil {
		return nil, 0, err
	}
	rows, err := r.q.SearchUsers(ctx, platformdb.SearchUsersParams{RoleID: in.RoleID, Q: q,
		Off: int32((in.Page - 1) * in.PageSize), Lim: int32(in.PageSize)}) // #nosec G115 -- page size ≤ 100, page bounded by the controller
	if err != nil {
		return nil, 0, err
	}
	out := make([]Summary, 0, len(rows))
	for _, row := range rows {
		out = append(out, toSummary(row.PlatformUser, RoleRef{ID: row.RoleID, Key: row.RoleKey, Name: row.RoleName}))
	}
	return out, total, nil
}

func (r *PgAdminRepository) GetSummary(ctx context.Context, id uuid.UUID) (Summary, error) {
	row, err := r.q.GetUserAdmin(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Summary{}, ErrUserNotFound
	}
	if err != nil {
		return Summary{}, err
	}
	return toSummary(row.PlatformUser, RoleRef{ID: row.RoleID, Key: row.RoleKey, Name: row.RoleName}), nil
}

func (r *PgAdminRepository) InTx(ctx context.Context, fn func(tx AdminTx) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&pgAdminTx{tx: tx, q: platformdb.New(tx)})
	})
}

type pgAdminTx struct {
	tx pgx.Tx
	q  *platformdb.Queries
}

func (t *pgAdminTx) LockRole(ctx context.Context, id uuid.UUID) (RoleRef, error) {
	row, err := t.q.GetRoleForUpdate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return RoleRef{}, ErrTargetRoleNotFound
	}
	if err != nil {
		return RoleRef{}, err
	}
	return RoleRef{ID: row.ID, Key: row.Key, Name: row.Name}, nil
}

func (t *pgAdminTx) SetRole(ctx context.Context, employeeCode string, roleID uuid.UUID) error {
	return t.q.SetUserRole(ctx, platformdb.SetUserRoleParams{EmployeeCode: employeeCode, RoleID: roleID})
}

func (t *pgAdminTx) Audit(ctx context.Context, e audit.Entry) error {
	return audit.Write(ctx, t.tx, e)
}

func toSummary(u platformdb.PlatformUser, role RoleRef) Summary {
	user := toUser(u, role.Key)
	user.RoleName = role.Name
	return Summary{User: user, RoleRef: role, LastLoginAt: u.LastLoginAt, FirstLoginAt: u.CreatedAt}
}
