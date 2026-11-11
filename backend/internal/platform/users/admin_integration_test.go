package users

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
)

// Runs when TEST_DATABASE_URL points at a migrated database (CI backend job, `make test-db`).
// F15 / F30 against Postgres: search (demo users excluded, Thai order, role filter), a role change
// writes its audit row in the same transaction, the audit list and role history read it back.
func TestUserAdminLifecycle(t *testing.T) {
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

	suffix := uuid.NewString()[:6]
	codes := []string{"ITA" + suffix, "ITB" + suffix, "ITD" + suffix}
	t.Cleanup(func() {
		for _, c := range codes {
			_, _ = pool.Exec(ctx, `DELETE FROM platform.user_roles WHERE employee_code = $1`, c)
			_, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE employee_code = $1`, c)
		}
	})
	// ข (B) sorts after ก (A) in Thai even though its code sorts first; the demo user is never listed.
	ins := `INSERT INTO platform.users (employee_code, first_name_th, last_name_th, is_demo) VALUES ($1, $2, $3, $4) RETURNING id`
	var idA, idB, actor uuid.UUID
	if err := pool.QueryRow(ctx, ins, codes[1], "ขวัญ", "ทดสอบ"+suffix, false).Scan(&idB); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, ins, codes[0], "กมล", "ทดสอบ"+suffix, false).Scan(&idA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, ins, codes[2], "ตัวอย่าง", "ทดสอบ"+suffix, true).Scan(&actor); err != nil {
		t.Fatal(err)
	}

	admin := NewAdmin(NewAdminRepository(pool), envCodes{codes[1]})
	list, total, err := admin.Search(ctx, SearchInput{Q: "ทดสอบ" + suffix, Page: 1, PageSize: 20})
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || len(list) != 2 || list[0].ID != idA || list[1].ID != idB {
		t.Fatalf("search = %d %+v", total, list)
	}
	if list[0].RoleRef.Key != RoleEmployee || !list[1].RoleLockedByEnv {
		t.Errorf("role / lock = %+v / %v", list[0].RoleRef, list[1].RoleLockedByEnv)
	}

	var technician uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM platform.roles WHERE key = 'technician'`).Scan(&technician); err != nil {
		t.Fatal(err)
	}
	got, err := admin.ChangeRole(ctx, actor, idA, technician)
	if err != nil || got.RoleRef.Key != RoleTechnician {
		t.Fatalf("change = %+v, %v", got.RoleRef, err)
	}
	if _, err := admin.ChangeRole(ctx, actor, idB, technician); err != ErrRoleLocked {
		t.Errorf("env-locked: %v", err)
	}
	byRole, _, err := admin.Search(ctx, SearchInput{Q: "ทดสอบ" + suffix, RoleID: &technician, Page: 1, PageSize: 20})
	if err != nil || len(byRole) != 1 || byRole[0].ID != idA {
		t.Errorf("role filter = %+v, %v", byRole, err)
	}

	reader := audit.NewReader(pool)
	hist, err := reader.RoleHistory(ctx, idA)
	if err != nil || len(hist) != 1 || hist[0].From != "พนักงานทั่วไป" || hist[0].To != "ช่างเทคนิค" || hist[0].Actor == nil || hist[0].Actor.ID != actor {
		t.Errorf("history = %+v, %v", hist, err)
	}
	q := "กมล ทดสอบ" + suffix
	items, n, err := reader.List(ctx, audit.Filter{Types: audit.UsersTypes, Q: &q, ActorID: &actor, Page: 1, PageSize: 50})
	if err != nil || n != 1 || items[0].Action != "role_change" || !items[0].Exists || len(items[0].Changes) != 1 {
		t.Errorf("audit = %d %+v, %v", n, items, err)
	}
	if items, _, _ := reader.List(ctx, audit.Filter{Types: audit.MasterTypes, Q: &q, Page: 1, PageSize: 50}); len(items) != 0 {
		t.Errorf("master filter listed a role change: %+v", items)
	}
	actors, err := reader.Actors(ctx)
	found := false
	for _, a := range actors {
		found = found || a.ID == actor
	}
	if err != nil || !found {
		t.Errorf("actors miss the actor: %v", err)
	}
}
