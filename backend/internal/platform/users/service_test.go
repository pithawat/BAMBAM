package users

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

type fakeRepo struct {
	users  map[uuid.UUID]User
	byCode map[string]uuid.UUID
	roles  map[string]string
	audit  []AuditEntry
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{users: map[uuid.UUID]User{}, byCode: map[string]uuid.UUID{}, roles: map[string]string{}}
}

func (f *fakeRepo) upsert(code string, set func(*User)) uuid.UUID {
	id, ok := f.byCode[code]
	if !ok {
		id = uuid.New()
		f.byCode[code] = id
	}
	u := f.users[id]
	u.ID, u.EmployeeCode = id, code
	set(&u)
	f.users[id] = u
	return id
}

func (f *fakeRepo) UpsertSSOUser(_ context.Context, c SSOClaims) (uuid.UUID, error) {
	return f.upsert(c.EmployeeCode, func(u *User) { u.FirstNameTH = strPtr(c.FirstNameTH); u.LastNameTH = strPtr(c.LastNameTH) }), nil
}

func (f *fakeRepo) UpsertDemoUser(_ context.Context, d demoUser) error {
	f.upsert(d.EmployeeCode, func(u *User) {
		u.FirstNameTH = strPtr(d.FirstNameTH)
		u.LastNameTH = strPtr(d.LastNameTH)
		u.IsDemo = true
	})
	f.roles[d.EmployeeCode] = d.Role
	return nil
}

func (f *fakeRepo) GetUser(_ context.Context, id uuid.UUID) (User, error) {
	u, ok := f.users[id]
	if !ok {
		return User{}, ErrUserNotFound
	}
	u.Role = RoleEmployee
	if r, ok := f.roles[u.EmployeeCode]; ok {
		u.Role = r
	}
	return u, nil
}

func (f *fakeRepo) ListDemoUsers(ctx context.Context) ([]User, error) {
	var out []User
	for id, u := range f.users {
		if u.IsDemo {
			full, _ := f.GetUser(ctx, id)
			out = append(out, full)
		}
	}
	return out, nil
}

func (f *fakeRepo) InsertAudit(_ context.Context, e AuditEntry) error {
	f.audit = append(f.audit, e)
	return nil
}

func TestFirstLoginIsEmployeeAndSeededRoleWins(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := NewService(repo)

	u, err := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "600123", FirstNameTH: "วรรณา", LastNameTH: "สุขประเสริฐ"})
	if err != nil {
		t.Fatal(err)
	}
	if u.Role != RoleEmployee {
		t.Fatalf("first login role = %s, want employee (D-003)", u.Role)
	}
	if u.DisplayName() != "วรรณา สุขประเสริฐ" {
		t.Fatalf("name = %q", u.DisplayName())
	}

	repo.roles["600999"] = RoleTechnician // seed file assigned before first login
	tech, err := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "600999"})
	if err != nil {
		t.Fatal(err)
	}
	if tech.Role != RoleTechnician {
		t.Fatalf("seeded role = %s, want technician", tech.Role)
	}
	if tech.DisplayName() != "600999" {
		t.Fatalf("fallback name = %q", tech.DisplayName())
	}
}

func TestUpsertRequiresEmployeeCode(t *testing.T) {
	_, err := NewService(newFakeRepo()).UpsertFromSSO(context.Background(), SSOClaims{EmployeeCode: "  "})
	if !errors.Is(err, ErrMissingEmployee) {
		t.Fatalf("err = %v, want ErrMissingEmployee", err)
	}
}

func TestDemoUsersOnePerRoleInOrder(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newFakeRepo())
	if err := svc.EnsureDemoUsers(ctx); err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureDemoUsers(ctx); err != nil { // idempotent
		t.Fatal(err)
	}
	list, err := svc.DemoUsers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != len(Roles) {
		t.Fatalf("got %d demo users, want %d", len(list), len(Roles))
	}
	for i, u := range list {
		if u.Role != Roles[i] || !u.IsDemo {
			t.Fatalf("demo user %d = %s demo=%v, want %s", i, u.Role, u.IsDemo, Roles[i])
		}
	}
	if list[3].DisplayName() != "ธนากร พึ่งบุญ" {
		t.Fatalf("technician demo = %q", list[3].DisplayName())
	}
}

func TestDemoUserForRoleValidatesRole(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newFakeRepo())
	_ = svc.EnsureDemoUsers(ctx)
	_, err := svc.DemoUserForRole(ctx, "superuser")
	e, ok := apperr.As(err)
	if !ok || e.Code != "VALIDATION_FAILED" || e.Fields["role"] != "INVALID" {
		t.Fatalf("err = %v, want VALIDATION_FAILED role INVALID", err)
	}
	u, err := svc.DemoUserForRole(ctx, RoleAdmin)
	if err != nil || u.Role != RoleAdmin {
		t.Fatalf("admin demo = %+v, %v", u, err)
	}
}

func TestMeResponseShape(t *testing.T) {
	u := User{ID: uuid.New(), EmployeeCode: "600123", FirstNameTH: strPtr("วรรณา"), Role: RoleEmployee}
	me := NewMeResponse(u, nil, "")
	if me.Environment != nil || me.TechnicianCategories == nil || me.Name != "วรรณา" {
		t.Fatalf("unexpected me %+v", me)
	}
	if NewMeResponse(u, nil, "UAT").Environment == nil {
		t.Fatal("environment label missing")
	}
}
