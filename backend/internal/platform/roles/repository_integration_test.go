package roles

import (
	"context"
	"os"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
)

// Runs when TEST_DATABASE_URL points at a migrated database (CI backend job, `make test-db`).
// It checks the platform_roles migration: seeded roles in contract order, the seeded matrix equal
// to the catalog defaults, and no `executive` role left (repair CR-024).
func TestMigrationSeed(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	// The catalog as the modules register it; repeated here because platform cannot import modules.
	// settings CR-006 (migration 20261030000002): service access for every role but technician,
	// building3d for admin, the 8 settings keys stored for admin.
	settingsKeys := []string{"settings.assets.manage", "settings.audit.view", "settings.categories.manage", "settings.contractor_types.manage",
		"settings.locations.manage", "settings.roles.manage", "settings.users.manage", "settings.users.view"}
	stored := map[string][]string{
		"super_admin": append([]string{"car_booking.use", "repair.building3d.view", "repair.contractor.manage", "repair.overview.view", "repair.ticket.close_any",
			"repair.ticket.handover_any", "repair.ticket.report", "repair.ticket.team_handle", "repair.ticket.view_all", "repair.ticket.work", "room_booking.use"}, settingsKeys...),
		"employee":         {"car_booking.use", "repair.ticket.report", "room_booking.use"},
		"housekeeper_lead": {"car_booking.use", "repair.ticket.report", "repair.ticket.team_handle", "room_booking.use"},
		"security_lead":    {"car_booking.use", "repair.ticket.report", "repair.ticket.team_handle", "room_booking.use"},
		"technician":       {"repair.contractor.manage", "repair.ticket.view_all", "repair.ticket.work"},
		"admin": append([]string{"car_booking.use", "repair.building3d.view", "repair.overview.view", "repair.ticket.close_any", "repair.ticket.handover_any",
			"repair.ticket.report", "repair.ticket.view_all", "room_booking.use"}, settingsKeys...),
	}
	repo := NewRepository(pool)
	list, err := NewService(repo, permissions.MustRegistry()).List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var keys []string
	for _, r := range list {
		keys = append(keys, r.Key)
	}
	if want := []string{"super_admin", "employee", "housekeeper_lead", "security_lead", "technician", "admin"}; !slices.Equal(keys[:min(len(keys), 6)], want) {
		t.Fatalf("roles = %v, want %v first", keys, want)
	}
	for _, r := range list {
		want, seeded := stored[r.Key]
		if !seeded {
			continue
		}
		got, err := repo.StoredPermissions(ctx, r.ID)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(got, want) {
			t.Errorf("%s stored = %v, want %v", r.Key, got, want)
		}
	}
	if s, _ := repo.ByKey(ctx, "super_admin"); !s.IsSystem || !s.IsLocked {
		t.Errorf("super_admin flags = %+v", s)
	}
	if _, err := repo.ByKey(ctx, "executive"); err != ErrRoleNotFound {
		t.Errorf("executive role: %v, want ErrRoleNotFound (CR-024)", err)
	}
	var orphans int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM platform.user_roles ur LEFT JOIN platform.roles r ON r.id = ur.role_id WHERE r.id IS NULL`).Scan(&orphans); err != nil || orphans != 0 {
		t.Errorf("user_roles without a role: %d (%v)", orphans, err)
	}
}

// Stage 2 against Postgres: create (copy-from) → matrix save → name taken → delete with a demo user.
// Everything it creates is deleted again; the matrix version only moves forward.
func TestRoleLifecycle(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	repo := NewRepository(pool)
	s := NewService(repo, permissions.MustRegistry(permissions.System{Key: "repair", Name: "ระบบแจ้งซ่อม", Groups: []permissions.Group{{
		Key: "repair.ticket", Name: "งานซ่อม", Permissions: []permissions.Permission{
			{Key: "repair.ticket.view_all", Label: "ดูทุกงาน"}, {Key: "repair.ticket.work", Label: "ประเมินและบันทึกผล"},
			{Key: "repair.contractor.manage", Label: "จัดการช่างภายนอก"},
		}}}}))

	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, is_demo) VALUES ('IT-ROLES-ACTOR', true)
		ON CONFLICT (employee_code) DO UPDATE SET is_demo = true RETURNING id`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE employee_code = 'IT-ROLES-ACTOR'`) })

	tech, err := repo.ByKey(ctx, "technician")
	if err != nil {
		t.Fatal(err)
	}
	r, err := s.Create(ctx, actor, CreateInput{Name: "IT หัวหน้าช่าง", CopyFrom: &tech.ID})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM platform.roles WHERE id = $1`, r.ID) })
	if got, _ := repo.StoredPermissions(ctx, r.ID); !slices.Equal(got, []string{"repair.contractor.manage", "repair.ticket.view_all", "repair.ticket.work"}) {
		t.Fatalf("copied = %v", got)
	}
	if _, err := s.Create(ctx, actor, CreateInput{Name: "it หัวหน้าช่าง"}); err != ErrNameTaken {
		t.Fatalf("duplicate name: %v, want NAME_TAKEN", err)
	}

	before, err := s.Matrix(ctx)
	if err != nil {
		t.Fatal(err)
	}
	after, err := s.SaveMatrix(ctx, actor, before.Version, []Change{{RoleID: r.ID, Permission: "repair.contractor.manage", Granted: false}})
	if err != nil || after.Version != before.Version+1 || after.UpdatedBy == nil || after.UpdatedBy.ID != actor {
		t.Fatalf("save: %v, version %d → %d, by %+v", err, before.Version, after.Version, after.UpdatedBy)
	}
	if _, err := s.SaveMatrix(ctx, actor, before.Version, []Change{{RoleID: r.ID, Permission: "repair.ticket.work", Granted: false}}); err != ErrVersionConflict {
		t.Fatalf("stale save: %v, want VERSION_CONFLICT", err)
	}

	if _, err := pool.Exec(ctx, `INSERT INTO platform.users (employee_code, is_demo) VALUES ('IT-ROLES-DEMO', true)`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO platform.user_roles (employee_code, role_id) VALUES ('IT-ROLES-DEMO', $1)`, r.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(ctx, actor, r.ID); err != nil {
		t.Fatalf("delete with a demo user only: %v", err)
	}
	var left int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM platform.users WHERE employee_code = 'IT-ROLES-DEMO'`).Scan(&left)
	if left != 0 {
		t.Fatal("demo user of the deleted role is still there")
	}
	var audits int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM platform.audit_log WHERE target_type = 'role' AND target_id = $1`, r.ID.String()).Scan(&audits)
	if audits != 3 { // create, permissions_change, delete
		t.Fatalf("audit rows = %d, want 3", audits)
	}
}
