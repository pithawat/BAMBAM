package users

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
)

var testCatalog = permissions.MustRegistry(
	permissions.System{Key: "repair", Groups: []permissions.Group{{Key: "repair.ticket", Permissions: []permissions.Permission{
		{Key: "repair.ticket.view_all"}, {Key: "repair.ticket.work"},
	}}}},
	permissions.System{Key: "settings", Groups: []permissions.Group{{Key: "settings", Fixed: true, Permissions: []permissions.Permission{
		{Key: "settings.assets.manage", FixedRoles: []string{RoleAdmin, RoleSuperAdmin}},
		{Key: "settings.users.manage", FixedRoles: []string{RoleSuperAdmin}},
	}}}},
)

// fakeRoles is the role list in contract order plus one custom role.
type fakeRoles struct{ list []roles.Role }

func newFakeRoles() *fakeRoles {
	f := &fakeRoles{}
	for _, k := range []string{RoleSuperAdmin, RoleEmployee, RoleHousekeeperLead, RoleSecurityLead, RoleTechnician, RoleAdmin, "r_7c21a9f0"} {
		name := k
		if k == "r_7c21a9f0" {
			name = "หัวหน้าช่าง"
		}
		f.list = append(f.list, roles.Role{ID: uuid.New(), Key: k, Name: name})
	}
	return f
}

func (f *fakeRoles) List(context.Context) ([]roles.Role, error) { return f.list, nil }

func (f *fakeRoles) ByKey(_ context.Context, key string) (roles.Role, error) {
	for _, r := range f.list {
		if r.Key == key {
			return r, nil
		}
	}
	return roles.Role{}, roles.ErrRoleNotFound
}

type fakeRepo struct {
	users  map[uuid.UUID]User
	byCode map[string]uuid.UUID
	roles  map[string]string   // employee code → role key
	stored map[string][]string // role key → stored permissions
	known  *fakeRoles
	audit  []AuditEntry
}

func newFakeRepo(known *fakeRoles) *fakeRepo {
	return &fakeRepo{users: map[uuid.UUID]User{}, byCode: map[string]uuid.UUID{}, roles: map[string]string{}, known: known,
		stored: map[string][]string{RoleTechnician: {"repair.ticket.view_all", "repair.ticket.work"}, RoleAdmin: {"repair.ticket.view_all"}}}
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

func (f *fakeRepo) UpsertDemoUser(ctx context.Context, d demoUser) (uuid.UUID, error) {
	id := f.upsert(d.EmployeeCode, func(u *User) {
		u.FirstNameTH = strPtr(d.FirstNameTH)
		u.LastNameTH = strPtr(d.LastNameTH)
		u.IsDemo = true
	})
	if ok, _ := f.AssignRole(ctx, d.EmployeeCode, d.Role); !ok {
		return uuid.Nil, errors.New("unknown role")
	}
	return id, nil
}

func (f *fakeRepo) AssignRole(ctx context.Context, code, key string) (bool, error) {
	if _, err := f.known.ByKey(ctx, key); err != nil {
		return false, nil
	}
	f.roles[code] = key
	return true, nil
}

func (f *fakeRepo) GetUser(ctx context.Context, id uuid.UUID) (User, error) {
	u, ok := f.users[id]
	if !ok {
		return User{}, ErrUserNotFound
	}
	u.Role = RoleEmployee
	if r, ok := f.roles[u.EmployeeCode]; ok {
		u.Role = r
	}
	r, _ := f.known.ByKey(ctx, u.Role)
	u.RoleName = r.Name
	u.Permissions = f.stored[u.Role]
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

func newTestService(superCodes ...string) (*Service, *fakeRepo) {
	known := newFakeRoles()
	repo := newFakeRepo(known)
	return NewService(repo, known, testCatalog, superCodes), repo
}

func TestFirstLoginIsEmployeeAndSeededRoleWins(t *testing.T) {
	ctx := context.Background()
	svc, repo := newTestService()

	u, err := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "600123", FirstNameTH: "วรรณา", LastNameTH: "สุขประเสริฐ"})
	if err != nil {
		t.Fatal(err)
	}
	if u.Role != RoleEmployee || len(u.Permissions) != 0 {
		t.Fatalf("first login role = %s %v, want employee without permissions (D-003)", u.Role, u.Permissions)
	}
	if u.DisplayName() != "วรรณา สุขประเสริฐ" {
		t.Fatalf("name = %q", u.DisplayName())
	}

	repo.roles["600999"] = RoleTechnician // assigned before first login
	tech, err := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "600999"})
	if err != nil {
		t.Fatal(err)
	}
	if tech.Role != RoleTechnician || !slices.Equal(tech.Permissions, []string{"repair.ticket.view_all", "repair.ticket.work"}) {
		t.Fatalf("seeded role = %s %v, want technician with its stored permissions", tech.Role, tech.Permissions)
	}
	if tech.DisplayName() != "600999" {
		t.Fatalf("fallback name = %q", tech.DisplayName())
	}
}

// /me permissions = stored + fixed settings keys of the role key (CR-001); super_admin = all.
func TestEffectivePermissions(t *testing.T) {
	ctx := context.Background()
	svc, repo := newTestService()
	repo.roles["A1"] = RoleAdmin
	repo.roles["S1"] = RoleSuperAdmin
	admin, _ := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "A1"})
	if !slices.Equal(admin.Permissions, []string{"repair.ticket.view_all", "settings.assets.manage"}) {
		t.Fatalf("admin = %v", admin.Permissions)
	}
	super, _ := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "S1"})
	if len(super.Permissions) != 4 {
		t.Fatalf("super_admin = %v, want every key", super.Permissions)
	}
}

// BR-F25-2: env codes are super_admin at API start (before the first login) and on every login.
func TestEnvSuperAdmin(t *testing.T) {
	ctx := context.Background()
	svc, repo := newTestService("EMP0105")
	if err := svc.EnsureEnvSuperAdmins(ctx); err != nil {
		t.Fatal(err)
	}
	if repo.roles["EMP0105"] != RoleSuperAdmin {
		t.Fatal("not assigned at start")
	}
	repo.roles["EMP0105"] = RoleEmployee // someone changed it in the DB
	u, err := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: " EMP0105 "})
	if err != nil || u.Role != RoleSuperAdmin {
		t.Fatalf("login role = %s, %v, want super_admin", u.Role, err)
	}
	if !svc.IsEnvSuperAdmin("EMP0105") || svc.IsEnvSuperAdmin("600123") {
		t.Fatal("IsEnvSuperAdmin wrong")
	}
	if other, _ := svc.UpsertFromSSO(ctx, SSOClaims{EmployeeCode: "600123"}); other.Role != RoleEmployee {
		t.Fatalf("other user = %s", other.Role)
	}
}

func TestUpsertRequiresEmployeeCode(t *testing.T) {
	svc, _ := newTestService()
	_, err := svc.UpsertFromSSO(context.Background(), SSOClaims{EmployeeCode: "  "})
	if !errors.Is(err, ErrMissingEmployee) {
		t.Fatalf("err = %v, want ErrMissingEmployee", err)
	}
}

// P2: one row per role in role order; a role without a demo user shows the generated name.
func TestDemoUsersOnePerRoleInOrder(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService()
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
	var keys []string
	for _, d := range list {
		keys = append(keys, d.Role)
	}
	want := []string{RoleSuperAdmin, RoleEmployee, RoleHousekeeperLead, RoleSecurityLead, RoleTechnician, RoleAdmin, "r_7c21a9f0"}
	if !slices.Equal(keys, want) {
		t.Fatalf("roles = %v, want %v", keys, want)
	}
	if list[0].Name != "ณัฐพล อินทรวงศ์" || list[4].Name != "ธนากร พึ่งบุญ" || list[6].Name != "ผู้ใช้ตัวอย่าง หัวหน้าช่าง" {
		t.Fatalf("names = %+v", list)
	}
	if list[6].RoleName != "หัวหน้าช่าง" {
		t.Fatalf("role name = %q", list[6].RoleName)
	}
}

// P3: any existing role key; the demo user is created on the first switch.
func TestDemoUserForRole(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService()
	_ = svc.EnsureDemoUsers(ctx)
	// "executive" is gone since repair CR-024, so it is an unknown role like any other (→ 400).
	for _, key := range []string{"superuser", "executive"} {
		_, err := svc.DemoUserForRole(ctx, key)
		e, ok := apperr.As(err)
		if !ok || e.Code != "VALIDATION_FAILED" || e.Fields["role"] != "INVALID" {
			t.Fatalf("%s: err = %v, want VALIDATION_FAILED role INVALID", key, err)
		}
	}
	u, err := svc.DemoUserForRole(ctx, RoleAdmin)
	if err != nil || u.Role != RoleAdmin || !slices.Contains(u.Permissions, "settings.assets.manage") {
		t.Fatalf("admin demo = %+v, %v", u, err)
	}
	custom, err := svc.DemoUserForRole(ctx, "r_7c21a9f0")
	if err != nil || custom.Role != "r_7c21a9f0" || !custom.IsDemo || custom.DisplayName() != "ผู้ใช้ตัวอย่าง หัวหน้าช่าง" {
		t.Fatalf("custom demo = %+v, %v", custom, err)
	}
	again, _ := svc.DemoUserForRole(ctx, "r_7c21a9f0")
	if again.ID != custom.ID {
		t.Fatal("second switch created another demo user")
	}
}

func TestMeResponseShape(t *testing.T) {
	u := User{ID: uuid.New(), EmployeeCode: "600123", FirstNameTH: strPtr("วรรณา"), Role: RoleEmployee, RoleName: "พนักงานทั่วไป"}
	me := NewMeResponse(u, nil, "")
	if me.Environment != nil || me.TechnicianCategories == nil || me.Permissions == nil || me.Name != "วรรณา" || me.RoleName != "พนักงานทั่วไป" {
		t.Fatalf("unexpected me %+v", me)
	}
	if NewMeResponse(u, nil, "UAT").Environment == nil {
		t.Fatal("environment label missing")
	}
}
