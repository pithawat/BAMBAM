package users

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgRepository struct {
	q *platformdb.Queries
}

func NewRepository(dbtx platformdb.DBTX) *PgRepository {
	return &PgRepository{q: platformdb.New(dbtx)}
}

func (r *PgRepository) UpsertSSOUser(ctx context.Context, c SSOClaims) (uuid.UUID, error) {
	u, err := r.q.UpsertSSOUser(ctx, platformdb.UpsertSSOUserParams{
		EmployeeCode: c.EmployeeCode,
		SsoSubject:   strPtr(c.Subject),
		FirstNameTh:  strPtr(c.FirstNameTH),
		LastNameTh:   strPtr(c.LastNameTH),
		FirstNameEn:  strPtr(c.FirstNameEN),
		LastNameEn:   strPtr(c.LastNameEN),
		Email:        strPtr(c.Email),
		Department:   strPtr(c.Department),
		Division:     strPtr(c.Division),
		PositionTh:   strPtr(c.PositionTH),
	})
	return u.ID, err
}

func (r *PgRepository) UpsertDemoUser(ctx context.Context, d demoUser) (uuid.UUID, error) {
	u, err := r.q.UpsertDemoUser(ctx, platformdb.UpsertDemoUserParams{
		EmployeeCode: d.EmployeeCode,
		FirstNameTh:  strPtr(d.FirstNameTH),
		LastNameTh:   strPtr(d.LastNameTH),
		Department:   strPtr(d.Department),
		PositionTh:   strPtr(d.PositionTH),
	})
	if err != nil {
		return uuid.Nil, err
	}
	ok, err := r.AssignRole(ctx, d.EmployeeCode, d.Role)
	if err != nil {
		return uuid.Nil, err
	}
	if !ok {
		return uuid.Nil, fmt.Errorf("role %q does not exist", d.Role)
	}
	return u.ID, nil
}

func (r *PgRepository) AssignRole(ctx context.Context, employeeCode, roleKey string) (bool, error) {
	n, err := r.q.UpsertUserRole(ctx, platformdb.UpsertUserRoleParams{EmployeeCode: employeeCode, RoleKey: roleKey})
	return n > 0, err
}

func (r *PgRepository) GetUser(ctx context.Context, id uuid.UUID) (User, error) {
	row, err := r.q.GetUserWithRole(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, err
	}
	u := toUser(row.PlatformUser, row.Role)
	u.RoleName = row.RoleName
	u.Permissions = row.Permissions // stored keys; the service adds the fixed ones
	return u, nil
}

func (r *PgRepository) ListDemoUsers(ctx context.Context) ([]User, error) {
	rows, err := r.q.ListDemoUsers(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]User, 0, len(rows))
	for _, row := range rows {
		out = append(out, toUser(row.PlatformUser, row.Role))
	}
	return out, nil
}

func (r *PgRepository) InsertAudit(ctx context.Context, e AuditEntry) error {
	return r.q.InsertAuditLog(ctx, platformdb.InsertAuditLogParams{
		ActorUserID: e.ActorUserID,
		Action:      e.Action,
		TargetType:  strPtr(e.TargetType),
		TargetID:    strPtr(e.TargetID),
		Data:        e.Data,
	})
}

func toUser(u platformdb.PlatformUser, role string) User {
	return User{
		ID:           u.ID,
		EmployeeCode: u.EmployeeCode,
		FirstNameTH:  u.FirstNameTh,
		LastNameTH:   u.LastNameTh,
		FirstNameEN:  u.FirstNameEn,
		LastNameEN:   u.LastNameEn,
		Email:        u.Email,
		Department:   u.Department,
		Division:     u.Division,
		PositionTH:   u.PositionTh,
		IsDemo:       u.IsDemo,
		Role:         role,
	}
}

// strPtr stores empty claims as NULL so the UI shows "—".
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
