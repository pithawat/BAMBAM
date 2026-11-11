package users

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
)

var (
	ErrUserNotFound    = apperr.New(apperr.KindNotFound, "USER_NOT_FOUND", "user not found")
	ErrMissingEmployee = apperr.New(apperr.KindInvalid, "SSO_CLAIM_MISSING", "USER claim missing")
	ErrNoDemoUser      = apperr.New(apperr.KindNotFound, "DEMO_USER_NOT_FOUND", "no demo user for role")
)

type Repository interface {
	UpsertSSOUser(ctx context.Context, c SSOClaims) (uuid.UUID, error)
	// UpsertDemoUser stores the demo user and assigns its role (the role key must exist).
	UpsertDemoUser(ctx context.Context, d demoUser) (uuid.UUID, error)
	// AssignRole sets a person's role by key, before or after their first login; false = unknown key.
	AssignRole(ctx context.Context, employeeCode, roleKey string) (bool, error)
	// GetUser returns the user with the role key, role name and the role's stored permissions.
	GetUser(ctx context.Context, id uuid.UUID) (User, error)
	ListDemoUsers(ctx context.Context) ([]User, error)
	InsertAudit(ctx context.Context, e AuditEntry) error
}

// RoleCatalog is the platform roles service (role list in contract order, lookup by key).
type RoleCatalog interface {
	List(ctx context.Context) ([]roles.Role, error)
	ByKey(ctx context.Context, key string) (roles.Role, error)
}

// TechnicianCategories is provided by the repair module (Stage 2, technician ↔ category seed).
// Until it is wired, /me returns an empty list.
type TechnicianCategories interface {
	CategoriesForTechnician(ctx context.Context, userID uuid.UUID) ([]Ref, error)
}

type AuditEntry struct {
	ActorUserID *uuid.UUID
	Action      string
	TargetType  string
	TargetID    string
	Data        []byte
}

type Service struct {
	repo        Repository
	roles       RoleCatalog
	reg         *permissions.Registry
	superAdmins []string // SUPER_ADMIN_EMPLOYEE_CODES (BR-F25-2)
	categories  TechnicianCategories
}

func NewService(repo Repository, roles RoleCatalog, reg *permissions.Registry, superAdminCodes []string) *Service {
	return &Service{repo: repo, roles: roles, reg: reg, superAdmins: superAdminCodes}
}

// SetTechnicianCategories wires the repair module's provider (called from main.go).
func (s *Service) SetTechnicianCategories(p TechnicianCategories) { s.categories = p }

// IsEnvSuperAdmin: the employee code is listed in SUPER_ADMIN_EMPLOYEE_CODES. Such a person is
// always super_admin and their role cannot be changed on screen (F25 "Added by Claude").
func (s *Service) IsEnvSuperAdmin(employeeCode string) bool {
	return slices.Contains(s.superAdmins, strings.TrimSpace(employeeCode))
}

// EnsureEnvSuperAdmins gives every env-listed code the super_admin role (API start, BR-F25-2).
// The row is keyed by employee code, so it works before the person's first login.
func (s *Service) EnsureEnvSuperAdmins(ctx context.Context) error {
	for _, code := range s.superAdmins {
		if _, err := s.repo.AssignRole(ctx, code, RoleSuperAdmin); err != nil {
			return fmt.Errorf("assign super_admin to %s: %w", code, err)
		}
	}
	if len(s.superAdmins) > 0 {
		return nil
	}
	list, err := s.roles.List(ctx)
	if err != nil {
		return err
	}
	for _, r := range list {
		if r.Key == RoleSuperAdmin && r.UserCount == 0 {
			slog.WarnContext(ctx, "no Superadmin: SUPER_ADMIN_EMPLOYEE_CODES is empty and no user has super_admin")
		}
	}
	return nil
}

// UpsertFromSSO refreshes the stored claims on every login (BR-F01-3). A first login gets the
// default role `employee` because no user_roles row exists (D-003); an env-listed code gets
// super_admin again on every login (BR-F25-2).
func (s *Service) UpsertFromSSO(ctx context.Context, c SSOClaims) (User, error) {
	c.EmployeeCode = strings.TrimSpace(c.EmployeeCode)
	if c.EmployeeCode == "" {
		return User{}, ErrMissingEmployee
	}
	id, err := s.repo.UpsertSSOUser(ctx, c)
	if err != nil {
		return User{}, fmt.Errorf("upsert sso user: %w", err)
	}
	if s.IsEnvSuperAdmin(c.EmployeeCode) {
		if _, err := s.repo.AssignRole(ctx, c.EmployeeCode, RoleSuperAdmin); err != nil {
			return User{}, fmt.Errorf("assign env super_admin: %w", err)
		}
	}
	return s.Get(ctx, id)
}

// Get returns the user with the effective permissions of their role (loaded on every request, D-049).
func (s *Service) Get(ctx context.Context, id uuid.UUID) (User, error) {
	u, err := s.repo.GetUser(ctx, id)
	if err != nil {
		return User{}, err
	}
	u.Permissions = s.reg.Effective(u.Role, u.Permissions)
	return u, nil
}

// TechnicianCategoriesOf returns the categories a technician handles; empty for other roles.
func (s *Service) TechnicianCategoriesOf(ctx context.Context, u User) ([]Ref, error) {
	if u.Role != RoleTechnician || s.categories == nil {
		return []Ref{}, nil
	}
	return s.categories.CategoriesForTechnician(ctx, u.ID)
}

// EnsureDemoUsers seeds the demo users of the seeded roles. Call only when the role switcher is enabled (D-005).
func (s *Service) EnsureDemoUsers(ctx context.Context) error {
	for _, d := range demoUsers {
		if _, err := s.repo.UpsertDemoUser(ctx, d); err != nil {
			return fmt.Errorf("seed demo user %s: %w", d.EmployeeCode, err)
		}
	}
	return nil
}

// DemoUser is one P2 row: a role and the demo user the switch uses (Name is generated when the
// role has no demo user yet; the user is created on the first switch).
type DemoUser struct {
	Role     string
	RoleName string
	Name     string
}

// DemoUsers lists one row per role in role order (settings P2).
func (s *Service) DemoUsers(ctx context.Context) ([]DemoUser, error) {
	list, err := s.roles.List(ctx)
	if err != nil {
		return nil, err
	}
	byRole, err := s.demoUsersByRole(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]DemoUser, 0, len(list))
	for _, r := range list {
		name := generatedDemoName(r.Name)
		if u, ok := byRole[r.Key]; ok {
			name = u.DisplayName()
		}
		out = append(out, DemoUser{Role: r.Key, RoleName: r.Name, Name: name})
	}
	return out, nil
}

// DemoUserForRole returns the demo user of any existing role, creating it on demand (settings P3).
func (s *Service) DemoUserForRole(ctx context.Context, roleKey string) (User, error) {
	r, err := s.roles.ByKey(ctx, roleKey)
	if err != nil {
		if e, ok := apperr.As(err); ok && e.Kind == apperr.KindNotFound {
			return User{}, apperr.Validation(map[string]string{"role": "INVALID"})
		}
		return User{}, err
	}
	byRole, err := s.demoUsersByRole(ctx)
	if err != nil {
		return User{}, err
	}
	if u, ok := byRole[r.Key]; ok {
		return s.Get(ctx, u.ID)
	}
	id, err := s.repo.UpsertDemoUser(ctx, demoUser{
		EmployeeCode: demoCode(r.Key), Role: r.Key, FirstNameTH: "ผู้ใช้ตัวอย่าง", LastNameTH: r.Name,
	})
	if err != nil {
		return User{}, fmt.Errorf("create demo user for %s: %w", r.Key, err)
	}
	return s.Get(ctx, id)
}

// demoUsersByRole picks one demo user per role: the lowest employee code wins.
func (s *Service) demoUsersByRole(ctx context.Context) (map[string]User, error) {
	list, err := s.repo.ListDemoUsers(ctx)
	if err != nil {
		return nil, err
	}
	slices.SortFunc(list, func(a, b User) int { return strings.Compare(a.EmployeeCode, b.EmployeeCode) })
	byRole := map[string]User{}
	for _, u := range list {
		if _, seen := byRole[u.Role]; !seen {
			byRole[u.Role] = u
		}
	}
	return byRole, nil
}

func generatedDemoName(roleName string) string {
	return "ผู้ใช้ตัวอย่าง " + roleName
}

// demoCode is the employee code of a generated demo user, e.g. DEMO-R_7C21A9F0.
func demoCode(roleKey string) string { return "DEMO-" + strings.ToUpper(roleKey) }

// Audit writes one audit_log row. data is marshalled to JSON.
func (s *Service) Audit(ctx context.Context, actor *uuid.UUID, action, targetType, targetID string, data any) error {
	b := []byte("{}")
	if data != nil {
		var err error
		if b, err = json.Marshal(data); err != nil {
			return fmt.Errorf("marshal audit data: %w", err)
		}
	}
	return s.repo.InsertAudit(ctx, AuditEntry{ActorUserID: actor, Action: action, TargetType: targetType, TargetID: targetID, Data: b})
}
