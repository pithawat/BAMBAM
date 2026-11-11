package locations

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

func TestValidName(t *testing.T) {
	var e *apperr.Error
	if _, err := validName("   "); !errors.As(err, &e) || e.Fields["name"] != "REQUIRED" {
		t.Errorf("blank: %v", err)
	}
	long := ""
	for i := 0; i < 101; i++ {
		long += "ก"
	}
	if _, err := validName(long); !errors.As(err, &e) || e.Fields["name"] != "TOO_LONG" {
		t.Errorf("long: %v", err)
	}
	if n, err := validName("  ห้องประชุม 1A  "); err != nil || n != "ห้องประชุม 1A" {
		t.Errorf("trim: %q %v", n, err)
	}
}

// Runs when TEST_DATABASE_URL points at a migrated database: F26 renames against Postgres (the tree moved to
// `platform` by 20261026000003_platform_locations.sql keeps its ids).
func TestRenames(t *testing.T) {
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
	suffix := uuid.NewString()[:4]
	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, first_name_th) VALUES ($1, 'ทดสอบ') RETURNING id`, "ITLO"+suffix).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	svc := NewService(NewRepository(pool))
	tree, err := svc.Tree(ctx)
	if err != nil || len(tree) == 0 {
		t.Fatalf("tree = %v, %v", tree, err)
	}
	var b Building
	for _, x := range tree {
		if len(x.Floors) > 0 && len(x.Floors[0].Rooms) > 1 {
			b = x
		}
	}
	if b.ID == uuid.Nil {
		t.Skip("no floor with two rooms")
	}
	for i := 1; i < len(b.Floors); i++ {
		if b.Floors[i].Level < b.Floors[i-1].Level {
			t.Errorf("floors not bottom first: %v", b.Floors)
		}
	}
	r1, r2 := b.Floors[0].Rooms[0], b.Floors[0].Rooms[1]
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `UPDATE platform.buildings SET name = $2 WHERE id = $1`, b.ID, b.Name)
		_, _ = pool.Exec(ctx, `UPDATE platform.rooms SET name = $2 WHERE id = $1`, r1.ID, r1.Name)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.audit_log WHERE actor_user_id = $1`, actor)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE id = $1`, actor)
	})

	renamed, err := svc.UpdateBuilding(ctx, actor, b.ID, BuildingInput{Name: b.Name + " " + suffix, UpdatedAt: b.UpdatedAt})
	if err != nil || renamed.ID != b.ID || renamed.Name != b.Name+" "+suffix || renamed.UpdatedBy == nil {
		t.Fatalf("rename building = %+v, %v", renamed, err)
	}
	if _, err := svc.UpdateBuilding(ctx, actor, b.ID, BuildingInput{Name: "อีกชื่อ", UpdatedAt: b.UpdatedAt}); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale building: %v", err)
	}
	if _, err := svc.RenameRoom(ctx, actor, r1.ID, r2.Name, r1.UpdatedAt); !errors.Is(err, ErrNameTaken) {
		t.Errorf("duplicate room on floor: %v", err)
	}
	room, err := svc.RenameRoom(ctx, actor, r1.ID, r1.Name+" "+suffix, r1.UpdatedAt)
	if err != nil || room.ID != r1.ID || room.ActiveAssetCount != r1.ActiveAssetCount {
		t.Fatalf("rename room = %+v, %v", room, err)
	}
	if _, err := svc.RenameRoom(ctx, actor, uuid.New(), "x", time.Now()); !errors.Is(err, ErrRoomNotFound) {
		t.Errorf("unknown room: %v", err)
	}
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM platform.audit_log WHERE actor_user_id = $1 AND action = 'update' AND target_type IN ('building', 'room')`, actor).Scan(&n)
	if n != 2 {
		t.Errorf("audit rows = %d, want 2", n)
	}
}
