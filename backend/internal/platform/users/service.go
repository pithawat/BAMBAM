package users

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

var (
	ErrUserNotFound    = apperr.New(apperr.KindNotFound, "USER_NOT_FOUND", "user not found")
	ErrMissingEmployee = apperr.New(apperr.KindInvalid, "SSO_CLAIM_MISSING", "USER claim missing")
	ErrNoDemoUser      = apperr.New(apperr.KindNotFound, "DEMO_USER_NOT_FOUND", "no demo user for role")
)

type Repository interface {
	UpsertSSOUser(ctx context.Context, c SSOClaims) (uuid.UUID, error)
	UpsertDemoUser(ctx context.Context, d demoUser) error
	GetUser(ctx context.Context, id uuid.UUID) (User, error)
	ListDemoUsers(ctx context.Context) ([]User, error)
	InsertAudit(ctx context.Context, e AuditEntry) error
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
	repo       Repository
	categories TechnicianCategories
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// SetTechnicianCategories wires the repair module's provider (called from main.go).
func (s *Service) SetTechnicianCategories(p TechnicianCategories) { s.categories = p }

// UpsertFromSSO refreshes the stored claims on every login (BR-F01-3). A first
// login gets the default role `employee` because no user_roles row exists (D-003).
func (s *Service) UpsertFromSSO(ctx context.Context, c SSOClaims) (User, error) {
	c.EmployeeCode = strings.TrimSpace(c.EmployeeCode)
	if c.EmployeeCode == "" {
		return User{}, ErrMissingEmployee
	}
	id, err := s.repo.UpsertSSOUser(ctx, c)
	if err != nil {
		return User{}, fmt.Errorf("upsert sso user: %w", err)
	}
	return s.repo.GetUser(ctx, id)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (User, error) {
	return s.repo.GetUser(ctx, id)
}

// TechnicianCategoriesOf returns the categories a technician handles; empty for other roles.
func (s *Service) TechnicianCategoriesOf(ctx context.Context, u User) ([]Ref, error) {
	if u.Role != RoleTechnician || s.categories == nil {
		return []Ref{}, nil
	}
	return s.categories.CategoriesForTechnician(ctx, u.ID)
}

// EnsureDemoUsers seeds one demo user per role. Call only when the role switcher is enabled (D-005).
func (s *Service) EnsureDemoUsers(ctx context.Context) error {
	for _, d := range demoUsers {
		if err := s.repo.UpsertDemoUser(ctx, d); err != nil {
			return fmt.Errorf("seed demo user %s: %w", d.EmployeeCode, err)
		}
	}
	return nil
}

// DemoUsers lists the demo users in role order.
func (s *Service) DemoUsers(ctx context.Context) ([]User, error) {
	list, err := s.repo.ListDemoUsers(ctx)
	if err != nil {
		return nil, err
	}
	byRole := map[string]User{}
	for _, u := range list {
		if _, seen := byRole[u.Role]; !seen {
			byRole[u.Role] = u
		}
	}
	out := make([]User, 0, len(Roles))
	for _, r := range Roles {
		if u, ok := byRole[r]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

func (s *Service) DemoUserForRole(ctx context.Context, role string) (User, error) {
	if !ValidRole(role) {
		return User{}, apperr.Validation(map[string]string{"role": "INVALID"})
	}
	list, err := s.DemoUsers(ctx)
	if err != nil {
		return User{}, err
	}
	for _, u := range list {
		if u.Role == role {
			return u, nil
		}
	}
	return User{}, ErrNoDemoUser
}

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
