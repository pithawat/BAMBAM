package roles

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgRepository struct {
	pool *pgxpool.Pool
	q    *platformdb.Queries
}

func NewRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool, q: platformdb.New(pool)}
}

func (r *PgRepository) InTx(ctx context.Context, fn func(tx TxRepository) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&pgTxRepository{tx: tx, q: platformdb.New(tx)})
	})
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
		role.UpdatedBy = personRef(row.UpdatedByUserID, row.UpdatedByEmployeeCode, row.UpdatedByFirstNameTh, row.UpdatedByLastNameTh,
			row.UpdatedByFirstNameEn, row.UpdatedByLastNameEn, row.UpdatedByDepartment)
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

func (r *PgRepository) AllStoredPermissions(ctx context.Context) (map[uuid.UUID][]string, error) {
	rows, err := r.q.ListAllRolePermissions(ctx)
	if err != nil {
		return nil, err
	}
	out := map[uuid.UUID][]string{}
	for _, row := range rows {
		out[row.RoleID] = append(out[row.RoleID], row.Permission)
	}
	return out, nil
}

func (r *PgRepository) MatrixMeta(ctx context.Context) (MatrixMeta, error) {
	row, err := r.q.GetPermissionMatrix(ctx)
	if err != nil {
		return MatrixMeta{}, err
	}
	return MatrixMeta{
		Version:   row.Version,
		UpdatedAt: row.UpdatedAt,
		UpdatedBy: personRef(row.UpdatedByUserID, row.UpdatedByEmployeeCode, row.UpdatedByFirstNameTh, row.UpdatedByLastNameTh,
			row.UpdatedByFirstNameEn, row.UpdatedByLastNameEn, row.UpdatedByDepartment),
	}, nil
}

type pgTxRepository struct {
	tx pgx.Tx
	q  *platformdb.Queries
}

func (r *pgTxRepository) LockRole(ctx context.Context, id uuid.UUID) (Role, error) {
	row, err := r.q.LockRole(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Role{}, ErrRoleNotFound
	}
	if err != nil {
		return Role{}, err
	}
	return toRole(row), nil
}

func (r *pgTxRepository) InsertRole(ctx context.Context, key, name, description string, actor uuid.UUID) (Role, error) {
	row, err := r.q.InsertRole(ctx, platformdb.InsertRoleParams{Key: key, Name: name, Description: description, ActorID: &actor})
	if err != nil {
		return Role{}, nameTaken(err)
	}
	return toRole(row), nil
}

func (r *pgTxRepository) UpdateRole(ctx context.Context, id uuid.UUID, name, description string, actor uuid.UUID) (Role, error) {
	row, err := r.q.UpdateRole(ctx, platformdb.UpdateRoleParams{ID: id, Name: name, Description: description, ActorID: &actor})
	if err != nil {
		return Role{}, nameTaken(err)
	}
	return toRole(row), nil
}

func (r *pgTxRepository) DeleteRole(ctx context.Context, id uuid.UUID) error {
	err := r.q.DeleteRole(ctx, id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		// a user_roles row of someone who has not logged in yet still points at the role
		return ErrRoleInUse
	}
	return err
}

func (r *pgTxRepository) RealUserCount(ctx context.Context, role Role) (int64, error) {
	return r.q.CountRealUsersInRole(ctx, platformdb.CountRealUsersInRoleParams{RoleID: role.ID, RoleKey: role.Key})
}

// DeleteDemoUsers unassigns the role's demo users and deletes each one that nothing references.
// A demo user that reported or worked on tickets cannot be deleted (repair keeps its rows); it
// stays as a demo user without a role, i.e. an employee.
func (r *pgTxRepository) DeleteDemoUsers(ctx context.Context, roleID uuid.UUID) error {
	codes, err := r.q.DeleteDemoUserRoles(ctx, roleID)
	if err != nil {
		return err
	}
	for _, code := range codes {
		sp, err := r.tx.Begin(ctx)
		if err != nil {
			return err
		}
		if err := platformdb.New(sp).DeleteDemoUser(ctx, code); err != nil {
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "23503" {
				_ = sp.Rollback(ctx)
				return err
			}
			if err := sp.Rollback(ctx); err != nil {
				return err
			}
			continue
		}
		if err := sp.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (r *pgTxRepository) StoredPermissions(ctx context.Context, roleID uuid.UUID) ([]string, error) {
	return r.q.ListRolePermissions(ctx, roleID)
}

func (r *pgTxRepository) Grant(ctx context.Context, roleID uuid.UUID, key string) error {
	return r.q.GrantRolePermission(ctx, platformdb.GrantRolePermissionParams{RoleID: roleID, Permission: key})
}

func (r *pgTxRepository) Revoke(ctx context.Context, roleID uuid.UUID, key string) error {
	return r.q.RevokeRolePermission(ctx, platformdb.RevokeRolePermissionParams{RoleID: roleID, Permission: key})
}

func (r *pgTxRepository) LockMatrix(ctx context.Context) (int32, error) {
	return r.q.LockPermissionMatrix(ctx)
}

func (r *pgTxRepository) BumpMatrix(ctx context.Context, actor uuid.UUID) error {
	return r.q.BumpPermissionMatrix(ctx, &actor)
}

func (r *pgTxRepository) Audit(ctx context.Context, e audit.Entry) error {
	return audit.Write(ctx, r.tx, e)
}

// nameTaken maps the unique index on lower(name) to NAME_TAKEN (two Superadmins saving one name).
func nameTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "roles_name_key" {
		return ErrNameTaken
	}
	return err
}

func personRef(id *uuid.UUID, code, firstTH, lastTH, firstEN, lastEN, department *string) *people.Ref {
	if id == nil {
		return nil
	}
	c := ""
	if code != nil {
		c = *code
	}
	return &people.Ref{ID: *id, Name: people.DisplayName(c, firstTH, lastTH, firstEN, lastEN), Department: department}
}

func toRole(r platformdb.PlatformRole) Role {
	return Role{
		ID: r.ID, Key: r.Key, Name: r.Name, Description: r.Description,
		IsSystem: r.IsSystem, IsLocked: r.IsLocked, UpdatedAt: r.UpdatedAt,
	}
}
