package roles

import (
	"context"
	"os"
	"slices"
	"testing"

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
	stored := map[string][]string{
		"super_admin":      {"repair.contractor.manage", "repair.overview.view", "repair.ticket.close_any", "repair.ticket.handover_any", "repair.ticket.team_handle", "repair.ticket.view_all", "repair.ticket.work"},
		"employee":         {},
		"housekeeper_lead": {"repair.ticket.team_handle"},
		"security_lead":    {"repair.ticket.team_handle"},
		"technician":       {"repair.contractor.manage", "repair.ticket.view_all", "repair.ticket.work"},
		"admin":            {"repair.overview.view", "repair.ticket.close_any", "repair.ticket.handover_any", "repair.ticket.view_all"},
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
