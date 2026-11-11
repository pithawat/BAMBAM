package roles

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
)

// A small catalog: two editable repair keys and one fixed settings key granted to admin / super_admin.
var testRegistry = permissions.MustRegistry(
	permissions.System{Key: "repair", Name: "ระบบแจ้งซ่อม", Groups: []permissions.Group{{Key: "repair.ticket", Name: "งานซ่อม", Permissions: []permissions.Permission{
		{Key: "repair.ticket.view_all", Label: "ดูทุกงาน"},
		{Key: "repair.contractor.manage", Label: "จัดการช่างภายนอก"},
	}}}},
	permissions.System{Key: "settings", Name: "ตั้งค่าระบบ", Groups: []permissions.Group{{Key: "settings", Name: "ตั้งค่าระบบ", Fixed: true, Permissions: []permissions.Permission{
		{Key: "settings.locations.manage", Label: "อาคารและห้อง", FixedRoles: []string{"admin", "super_admin"}},
	}}}},
)

type fakeRepo struct {
	roles       []Role // in contract order
	stored      map[uuid.UUID][]string
	realUsers   map[uuid.UUID]int64
	version     int32
	audits      []audit.Entry
	demoGone    []uuid.UUID
	nameTakenOn string
}

func newFake() *fakeRepo {
	f := &fakeRepo{stored: map[uuid.UUID][]string{}, realUsers: map[uuid.UUID]int64{}, version: 12}
	t0 := time.Date(2026, 10, 14, 2, 0, 0, 0, time.UTC)
	for _, r := range []Role{
		{Key: "super_admin", Name: "Superadmin", IsSystem: true, IsLocked: true},
		{Key: "employee", Name: "พนักงานทั่วไป", IsSystem: true},
		{Key: "technician", Name: "ช่างเทคนิค"},
		{Key: "admin", Name: "Admin"},
	} {
		r.ID, r.UpdatedAt = uuid.New(), t0
		f.roles = append(f.roles, r)
	}
	f.stored[f.role("technician").ID] = []string{"repair.contractor.manage", "repair.ticket.view_all"}
	f.stored[f.role("admin").ID] = []string{"repair.ticket.view_all", "settings.locations.manage"} // a stray fixed row
	f.realUsers[f.role("admin").ID] = 2
	return f
}

func (f *fakeRepo) role(key string) Role {
	for _, r := range f.roles {
		if r.Key == key {
			return r
		}
	}
	return Role{}
}

func (f *fakeRepo) List(context.Context) ([]Role, error) {
	out := slices.Clone(f.roles)
	for i := range out {
		out[i].UserCount = f.realUsers[out[i].ID]
	}
	return out, nil
}
func (f *fakeRepo) ByKey(_ context.Context, key string) (Role, error) {
	if r := f.role(key); r.ID != uuid.Nil {
		return r, nil
	}
	return Role{}, ErrRoleNotFound
}
func (f *fakeRepo) StoredPermissions(_ context.Context, id uuid.UUID) ([]string, error) {
	return slices.Clone(f.stored[id]), nil
}
func (f *fakeRepo) AllStoredPermissions(context.Context) (map[uuid.UUID][]string, error) {
	return f.stored, nil
}
func (f *fakeRepo) MatrixMeta(context.Context) (MatrixMeta, error) {
	return MatrixMeta{Version: f.version}, nil
}
func (f *fakeRepo) InTx(_ context.Context, fn func(TxRepository) error) error { return fn(f) }

func (f *fakeRepo) LockRole(_ context.Context, id uuid.UUID) (Role, error) {
	for _, r := range f.roles {
		if r.ID == id {
			return r, nil
		}
	}
	return Role{}, ErrRoleNotFound
}
func (f *fakeRepo) InsertRole(_ context.Context, key, name, desc string, _ uuid.UUID) (Role, error) {
	if name == f.nameTakenOn {
		return Role{}, ErrNameTaken
	}
	r := Role{ID: uuid.New(), Key: key, Name: name, Description: desc, UpdatedAt: time.Now()}
	f.roles = append(f.roles, r)
	return r, nil
}
func (f *fakeRepo) UpdateRole(_ context.Context, id uuid.UUID, name, desc string, _ uuid.UUID) (Role, error) {
	for i, r := range f.roles {
		if r.ID == id {
			f.roles[i].Name, f.roles[i].Description, f.roles[i].UpdatedAt = name, desc, time.Now()
			return f.roles[i], nil
		}
	}
	return Role{}, ErrRoleNotFound
}
func (f *fakeRepo) DeleteRole(_ context.Context, id uuid.UUID) error {
	f.roles = slices.DeleteFunc(f.roles, func(r Role) bool { return r.ID == id })
	return nil
}
func (f *fakeRepo) RealUserCount(_ context.Context, r Role) (int64, error) {
	return f.realUsers[r.ID], nil
}
func (f *fakeRepo) DeleteDemoUsers(_ context.Context, id uuid.UUID) error {
	f.demoGone = append(f.demoGone, id)
	return nil
}
func (f *fakeRepo) Grant(_ context.Context, id uuid.UUID, k string) error {
	if !slices.Contains(f.stored[id], k) {
		f.stored[id] = append(f.stored[id], k)
	}
	return nil
}
func (f *fakeRepo) Revoke(_ context.Context, id uuid.UUID, k string) error {
	f.stored[id] = slices.DeleteFunc(f.stored[id], func(s string) bool { return s == k })
	return nil
}
func (f *fakeRepo) LockMatrix(context.Context) (int32, error) { return f.version, nil }
func (f *fakeRepo) BumpMatrix(context.Context, uuid.UUID) error {
	f.version++
	return nil
}
func (f *fakeRepo) Audit(_ context.Context, e audit.Entry) error {
	f.audits = append(f.audits, e)
	return nil
}

var actor = uuid.New()

func svc(f *fakeRepo) *Service {
	s := NewService(f, testRegistry)
	s.newKey = func() string { return "r_0a1b2c3d" }
	return s
}

func wantCode(t *testing.T, err error, code string) {
	t.Helper()
	e, ok := apperr.As(err)
	if !ok || e.Code != code {
		t.Fatalf("err = %v, want %s", err, code)
	}
}

func wantField(t *testing.T, err error, field, code string) {
	t.Helper()
	e, ok := apperr.As(err)
	if !ok || e.Code != "VALIDATION_FAILED" || e.Fields[field] != code {
		t.Fatalf("err = %v (%v), want %s: %s", err, e, field, code)
	}
}

func TestCreateValidation(t *testing.T) {
	s := svc(newFake())
	_, err := s.Create(context.Background(), actor, CreateInput{Name: "   "})
	wantField(t, err, "name", "REQUIRED")
	_, err = s.Create(context.Background(), actor, CreateInput{Name: string(make([]rune, 51))})
	wantField(t, err, "name", "TOO_LONG")
	long := make([]rune, 201)
	for i := range long {
		long[i] = 'ก'
	}
	_, err = s.Create(context.Background(), actor, CreateInput{Name: "หัวหน้าช่าง", Description: string(long)})
	wantField(t, err, "description", "TOO_LONG")
	missing := uuid.New()
	_, err = s.Create(context.Background(), actor, CreateInput{Name: "หัวหน้าช่าง", CopyFrom: &missing})
	wantField(t, err, "copyFromRoleId", "INVALID")
}

func TestCreateNameTaken(t *testing.T) {
	f := newFake()
	f.nameTakenOn = "Admin"
	_, err := svc(f).Create(context.Background(), actor, CreateInput{Name: " Admin "})
	wantCode(t, err, "NAME_TAKEN")
}

// F29 step 4: copy-from takes the editable permissions only; fixed keys never (BR-F29-8).
func TestCreateCopyFrom(t *testing.T) {
	f := newFake()
	s := svc(f)
	from := f.role("technician").ID
	r, err := s.Create(context.Background(), actor, CreateInput{Name: "หัวหน้าช่าง", Description: "ดูแลงานซ่อม", CopyFrom: &from})
	if err != nil {
		t.Fatal(err)
	}
	if r.Key != "r_0a1b2c3d" || r.Name != "หัวหน้าช่าง" || r.IsSystem || r.IsLocked {
		t.Fatalf("role = %+v", r)
	}
	if got := s.reg.Effective(r.Key, f.stored[r.ID]); !slices.Equal(got, []string{"repair.ticket.view_all", "repair.contractor.manage"}) {
		t.Fatalf("copied = %v", got)
	}
	if len(f.audits) != 1 || f.audits[0].Action != "create" || f.audits[0].TargetType != "role" {
		t.Fatalf("audits = %+v", f.audits)
	}

	admin := f.role("admin").ID
	r2, _ := s.Create(context.Background(), actor, CreateInput{Name: "Admin 2", CopyFrom: &admin})
	if got := f.stored[r2.ID]; !slices.Equal(got, []string{"repair.ticket.view_all"}) {
		t.Fatalf("copy from admin = %v, want no settings key", got)
	}
	super := f.role("super_admin").ID
	r3, _ := s.Create(context.Background(), actor, CreateInput{Name: "เกือบ Superadmin", CopyFrom: &super})
	if got := f.stored[r3.ID]; !slices.Equal(got, []string{"repair.ticket.view_all", "repair.contractor.manage"}) {
		t.Fatalf("copy from super_admin = %v, want every editable key", got)
	}
	r4, _ := s.Create(context.Background(), actor, CreateInput{Name: "ว่าง"})
	if len(f.stored[r4.ID]) != 0 {
		t.Fatalf("blank role has %v", f.stored[r4.ID])
	}
}

func TestUpdate(t *testing.T) {
	f := newFake()
	s := svc(f)
	emp := f.role("employee")
	name := "พนักงาน"
	r, err := s.Update(context.Background(), actor, emp.ID, UpdateInput{Name: &name, UpdatedAt: emp.UpdatedAt})
	if err != nil || r.Name != "พนักงาน" {
		t.Fatalf("rename employee (BR-F29-5): %+v, %v", r, err)
	}
	if len(f.audits) != 1 || f.audits[0].Action != "update" {
		t.Fatalf("audits = %+v", f.audits)
	}
	d := f.audits[0].Data.(auditData)
	if len(d.Changes) != 1 || d.Changes[0].Field != "name" || *d.Changes[0].Before != "พนักงานทั่วไป" || *d.Changes[0].After != "พนักงาน" {
		t.Fatalf("changes = %+v", d.Changes)
	}

	_, err = s.Update(context.Background(), actor, emp.ID, UpdateInput{Name: &name, UpdatedAt: emp.UpdatedAt})
	wantCode(t, err, "VERSION_CONFLICT")

	sa := f.role("super_admin")
	_, err = s.Update(context.Background(), actor, sa.ID, UpdateInput{Name: &name, UpdatedAt: sa.UpdatedAt})
	wantCode(t, err, "SYSTEM_ROLE")

	_, err = s.Update(context.Background(), actor, uuid.New(), UpdateInput{Name: &name, UpdatedAt: sa.UpdatedAt})
	wantCode(t, err, "ROLE_NOT_FOUND")

	_, err = s.Update(context.Background(), actor, emp.ID, UpdateInput{Name: &name})
	wantField(t, err, "updatedAt", "REQUIRED")

	tech := f.role("technician")
	same := tech.Name
	if _, err := s.Update(context.Background(), actor, tech.ID, UpdateInput{Name: &same, UpdatedAt: tech.UpdatedAt}); err != nil || len(f.audits) != 1 {
		t.Fatalf("no-op update: %v, audits %d", err, len(f.audits))
	}
}

// BR-F29-5 / BR-F29-6: system roles never; roles with real users not; demo users go with the role.
func TestDelete(t *testing.T) {
	f := newFake()
	s := svc(f)
	wantCode(t, s.Delete(context.Background(), actor, f.role("employee").ID), "SYSTEM_ROLE")
	wantCode(t, s.Delete(context.Background(), actor, f.role("super_admin").ID), "SYSTEM_ROLE")
	wantCode(t, s.Delete(context.Background(), actor, f.role("admin").ID), "ROLE_IN_USE")
	wantCode(t, s.Delete(context.Background(), actor, uuid.New()), "ROLE_NOT_FOUND")

	tech := f.role("technician").ID
	if err := s.Delete(context.Background(), actor, tech); err != nil {
		t.Fatal(err)
	}
	if f.role("technician").ID != uuid.Nil || !slices.Equal(f.demoGone, []uuid.UUID{tech}) {
		t.Fatalf("role still there or demo users kept: %v", f.demoGone)
	}
	if len(f.audits) != 1 || f.audits[0].Action != "delete" || f.audits[0].Data.(auditData).EntityName != "ช่างเทคนิค" {
		t.Fatalf("audits = %+v", f.audits)
	}
}

func TestMatrix(t *testing.T) {
	f := newFake()
	m, err := svc(f).Matrix(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if m.Version != 12 || len(m.Systems) != 2 || len(m.Roles) != 4 {
		t.Fatalf("matrix = %+v", m)
	}
	got := map[string][]string{}
	for _, r := range m.Roles {
		got[r.Key] = r.Permissions
	}
	want := map[string][]string{
		"super_admin": {"repair.ticket.view_all", "repair.contractor.manage", "settings.locations.manage"},
		"employee":    {},
		"technician":  {"repair.ticket.view_all", "repair.contractor.manage"},
		"admin":       {"repair.ticket.view_all", "settings.locations.manage"},
	}
	for k, w := range want {
		if !slices.Equal(got[k], w) {
			t.Errorf("%s = %v, want %v", k, got[k], w)
		}
	}
	if m.Roles[3].UserCount != 2 {
		t.Errorf("admin userCount = %d", m.Roles[3].UserCount)
	}
}

// AC2: untick ช่างเทคนิค → จัดการช่างภายนอก; one audit row per changed role with labels.
func TestSaveMatrix(t *testing.T) {
	f := newFake()
	s := svc(f)
	tech, emp := f.role("technician").ID, f.role("employee").ID
	m, err := s.SaveMatrix(context.Background(), actor, 12, []Change{
		{RoleID: tech, Permission: "repair.contractor.manage", Granted: false},
		{RoleID: emp, Permission: "repair.ticket.view_all", Granted: true},
		{RoleID: emp, Permission: "repair.contractor.manage", Granted: false}, // already off: no-op
	})
	if err != nil {
		t.Fatal(err)
	}
	if m.Version != 13 {
		t.Fatalf("version = %d, want 13", m.Version)
	}
	if !slices.Equal(f.stored[tech], []string{"repair.ticket.view_all"}) || !slices.Equal(f.stored[emp], []string{"repair.ticket.view_all"}) {
		t.Fatalf("stored = %v", f.stored)
	}
	if len(f.audits) != 2 {
		t.Fatalf("audits = %d, want 2", len(f.audits))
	}
	c := f.audits[0].Data.(auditData).Changes[0]
	if f.audits[0].Action != "permissions_change" || c.Field != "permissions" || len(*c.Added) != 0 || !slices.Equal(*c.Removed, []string{"จัดการช่างภายนอก"}) {
		t.Fatalf("audit = %+v %+v", f.audits[0], c)
	}
	if c := f.audits[1].Data.(auditData).Changes[0]; !slices.Equal(*c.Added, []string{"ดูทุกงาน"}) || len(*c.Removed) != 0 {
		t.Fatalf("employee audit = %+v", c)
	}
}

func TestSaveMatrixErrors(t *testing.T) {
	f := newFake()
	s := svc(f)
	tech := f.role("technician").ID
	ctx := context.Background()

	_, err := s.SaveMatrix(ctx, actor, 12, nil)
	wantField(t, err, "changes", "REQUIRED")
	_, err = s.SaveMatrix(ctx, actor, 12, []Change{{RoleID: tech, Permission: "repair.ticket.set_priority", Granted: true}})
	wantCode(t, err, "UNKNOWN_PERMISSION")
	_, err = s.SaveMatrix(ctx, actor, 12, []Change{{RoleID: tech, Permission: "settings.locations.manage", Granted: true}})
	wantCode(t, err, "FIXED_PERMISSION")
	_, err = s.SaveMatrix(ctx, actor, 11, []Change{{RoleID: tech, Permission: "repair.ticket.view_all", Granted: false}})
	wantCode(t, err, "VERSION_CONFLICT") // AC5: tab B saves on an old version
	_, err = s.SaveMatrix(ctx, actor, 12, []Change{{RoleID: f.role("super_admin").ID, Permission: "repair.ticket.view_all", Granted: false}})
	wantCode(t, err, "SYSTEM_ROLE")
	_, err = s.SaveMatrix(ctx, actor, 12, []Change{{RoleID: uuid.New(), Permission: "repair.ticket.view_all", Granted: true}})
	if !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("err = %v, want ROLE_NOT_FOUND", err)
	}
	if len(f.audits) != 0 {
		t.Fatalf("a refused save wrote audits: %+v", f.audits)
	}
}
