package assets

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
)

func TestNextCode(t *testing.T) {
	if got := NextCode("AC-1-", []string{"ac-1-001", "AC-1-002", "AC-1-004"}); got != "AC-1-003" {
		t.Errorf("NextCode = %s", got)
	}
	if got := NextCode("PRN-ชั้น 2-", nil); got != "PRN-ชั้น 2-001" {
		t.Errorf("NextCode empty = %s", got)
	}
}

func TestValidateType(t *testing.T) {
	str := func(s string) *string { return &s }
	cases := []struct {
		in   TypeInput
		want map[string]string
	}{
		{TypeInput{}, map[string]string{"name": "REQUIRED", "codePrefix": "REQUIRED"}},
		{TypeInput{Name: str("เครื่องพิมพ์"), CodePrefix: str("p")}, map[string]string{"codePrefix": "INVALID"}},
		{TypeInput{Name: str("เครื่องพิมพ์"), CodePrefix: str("prn"), Icon: str("printer"), Mount: str("roof")}, map[string]string{"icon": "INVALID", "mount": "INVALID"}},
		{TypeInput{Name: str("เครื่องพิมพ์"), CodePrefix: str(" prn ")}, map[string]string{}},
	}
	for i, tc := range cases {
		fields := map[string]string{}
		in := tc.in
		validateType(fields, &in, true)
		if len(fields) != len(tc.want) {
			t.Errorf("#%d fields = %v, want %v", i, fields, tc.want)
		}
		for k, v := range tc.want {
			if fields[k] != v {
				t.Errorf("#%d %s = %q, want %q", i, k, fields[k], v)
			}
		}
		if len(tc.want) == 0 && *in.CodePrefix != "PRN" {
			t.Errorf("prefix not upper-cased: %q", *in.CodePrefix)
		}
	}
}

func TestAssetAuditAction(t *testing.T) {
	cur := LockedAsset{ID: uuid.New(), Code: "AC-1-001", Name: "แอร์", RoomID: uuid.New(), IsActive: true}
	off := cur
	off.IsActive = false
	if e := assetAudit(uuid.New(), cur, off, locations.Place{}, locations.Place{}); e.Action != "deactivate" {
		t.Errorf("deactivate = %s", e.Action)
	}
	if e := assetAudit(uuid.New(), off, cur, locations.Place{}, locations.Place{}); e.Action != "activate" {
		t.Errorf("activate = %s", e.Action)
	}
	renamed := cur
	renamed.Name = "แอร์ตัวซ้าย"
	e := assetAudit(uuid.New(), cur, renamed, locations.Place{}, locations.Place{})
	if d := e.Data.(assetData); e.Action != "update" || len(d.Changes) != 1 || d.Changes[0].Field != "name" {
		t.Errorf("update = %s %+v", e.Action, e.Data)
	}
}

// Runs when TEST_DATABASE_URL points at a migrated database: F26 asset and type rules against Postgres
// (seed rooms of อาคาร 1 from the repair CR-014 / CR-016 migrations).
func TestAssetLifecycle(t *testing.T) {
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

	var roomA, roomB uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT r.id FROM platform.rooms r JOIN platform.floors f ON f.id = r.floor_id WHERE r.is_active AND f.is_active AND f.name ~ '^[0-9]+$' ORDER BY f.level, r.sort_order LIMIT 1`).Scan(&roomA); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT r.id FROM platform.rooms r JOIN platform.floors f ON f.id = r.floor_id WHERE r.is_active AND f.is_active AND f.name ~ '^[0-9]+$' AND r.id <> $1 ORDER BY f.level, r.sort_order LIMIT 1`, roomA).Scan(&roomB); err != nil {
		t.Fatal(err)
	}
	suffix := uuid.NewString()[:4]
	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, first_name_th) VALUES ($1, 'ทดสอบ') RETURNING id`, "ITAS"+suffix).Scan(&actor); err != nil {
		t.Fatal(err)
	}

	svc := NewService(NewRepository(pool), locations.NewService(locations.NewRepository(pool)))
	name := "เครื่องพิมพ์ " + suffix
	prefix := "Q" + string(rune('A'+suffix[0]%26)) + string(rune('A'+suffix[1]%26))
	str := func(s string) *string { return &s }

	typ, err := svc.CreateType(ctx, actor, TypeInput{Name: str(name), CodePrefix: str(prefix)})
	if err != nil {
		t.Fatal(err)
	}
	var assetIDs []uuid.UUID
	t.Cleanup(func() {
		for _, id := range assetIDs {
			_, _ = pool.Exec(ctx, `DELETE FROM platform.assets WHERE id = $1`, id)
		}
		_, _ = pool.Exec(ctx, `DELETE FROM platform.asset_types WHERE id = $1`, typ.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE id = $1`, actor)
	})
	if typ.Icon != "box" || typ.Mount != "floor" || len(typ.Key) != 10 {
		t.Errorf("defaults = %+v", typ)
	}
	if _, err := svc.CreateType(ctx, actor, TypeInput{Name: str(name), CodePrefix: str("ZZ" + suffix[:1])}); !errors.Is(err, ErrNameTaken) {
		t.Errorf("duplicate name: %v", err)
	}
	if _, err := svc.CreateType(ctx, actor, TypeInput{Name: str(name + " 2"), CodePrefix: str(prefix)}); !errors.Is(err, ErrPrefixTaken) {
		t.Errorf("duplicate prefix: %v", err)
	}

	code, err := svc.SuggestCode(ctx, typ.ID, roomA)
	if err != nil {
		t.Fatal(err)
	}
	a, err := svc.CreateAsset(ctx, actor, AssetInput{RoomID: &roomA, AssetTypeID: &typ.ID, Code: str(code), Name: str("เครื่องพิมพ์ชั้นล่าง")})
	if err != nil {
		t.Fatal(err)
	}
	assetIDs = append(assetIDs, a.ID)
	if a.Placed || a.Type.ID != typ.ID {
		t.Errorf("created = %+v", a)
	}
	next, _ := svc.SuggestCode(ctx, typ.ID, roomA)
	if next == code {
		t.Errorf("suggestion did not move on: %s", next)
	}
	lower := str(toLower(code))
	if _, err := svc.CreateAsset(ctx, actor, AssetInput{RoomID: &roomA, AssetTypeID: &typ.ID, Code: lower, Name: str("ซ้ำ")}); !errors.Is(err, ErrCodeTaken) {
		t.Errorf("duplicate code (case): %v", err)
	}

	// placed, then moved: the position is cleared
	if _, err := pool.Exec(ctx, `UPDATE platform.assets SET pos_x = 1, pos_z = 1 WHERE id = $1`, a.ID); err != nil {
		t.Fatal(err)
	}
	cur, _ := NewRepository(pool).Asset(ctx, a.ID)
	moved, err := svc.UpdateAsset(ctx, actor, a.ID, AssetInput{RoomID: &roomB, UpdatedAt: cur.UpdatedAt})
	if err != nil || moved.Placed || moved.RoomID != roomB || moved.Code != code {
		t.Fatalf("move = %+v, %v", moved, err)
	}
	if _, err := svc.UpdateAsset(ctx, actor, a.ID, AssetInput{Name: str("x"), UpdatedAt: cur.UpdatedAt}); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale updatedAt: %v", err)
	}
	off, err := svc.UpdateAsset(ctx, actor, a.ID, AssetInput{IsActive: ptr(false), UpdatedAt: moved.UpdatedAt})
	if err != nil || off.IsActive {
		t.Fatalf("deactivate = %+v, %v", off, err)
	}
	if _, err := svc.UpdateAsset(ctx, actor, a.ID, AssetInput{Name: str("y"), UpdatedAt: off.UpdatedAt}); !errors.Is(err, ErrAssetNotFound) {
		t.Errorf("edit inactive: %v", err)
	}
	var actions []string
	rows, _ := pool.Query(ctx, `SELECT action FROM platform.audit_log WHERE target_type = 'asset' AND target_id = $1 ORDER BY created_at`, a.ID.String())
	for rows.Next() {
		var s string
		_ = rows.Scan(&s)
		actions = append(actions, s)
	}
	if len(actions) != 3 || actions[0] != "create" || actions[1] != "update" || actions[2] != "deactivate" {
		t.Errorf("audit actions = %v", actions)
	}

	if _, err := svc.RoomAssets(ctx, ListInput{RoomID: uuid.New()}); !errors.Is(err, locations.ErrRoomNotFound) {
		t.Errorf("unknown room: %v", err)
	}
	var fe *apperr.Error
	if _, err := svc.CreateAsset(ctx, actor, AssetInput{RoomID: ptr(uuid.New()), AssetTypeID: &typ.ID, Code: str("X-1"), Name: str("x")}); !errors.As(err, &fe) || fe.Fields["roomId"] != "INVALID" {
		t.Errorf("unknown room on create: %v", err)
	}
}

func ptr[T any](v T) *T { return &v }

func toLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}
