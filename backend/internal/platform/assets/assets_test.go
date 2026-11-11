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

// BR-F13A-4: the label status from the printed snapshot vs today's data.
func TestLabelStatus(t *testing.T) {
	room := uuid.New()
	now := LabelSnapshot{Code: "AC-5-012", Name: "แอร์ห้องประชุม 5B", BuildingName: "อาคาร 1", FloorName: "5", RoomID: room, RoomName: "ห้องประชุม 5B"}
	with := func(f func(s *LabelSnapshot)) *LabelSnapshot {
		s := now
		f(&s)
		return &s
	}
	cases := []struct {
		name    string
		printed *LabelSnapshot
		want    string
	}{
		{"never printed", nil, LabelNever},
		{"same text", with(func(*LabelSnapshot) {}), LabelCurrent},
		{"other room", with(func(s *LabelSnapshot) { s.RoomID, s.RoomName = uuid.New(), "ห้องอื่น" }), LabelMoved},
		{"other room, same name", with(func(s *LabelSnapshot) { s.RoomID = uuid.New() }), LabelMoved},
		{"asset renamed", with(func(s *LabelSnapshot) { s.Name = "แอร์เก่า" }), LabelChanged},
		{"room renamed", with(func(s *LabelSnapshot) { s.RoomName = "ห้อง 5B" }), LabelChanged},
		{"floor renamed", with(func(s *LabelSnapshot) { s.FloorName = "ชั้น 5" }), LabelChanged},
		{"building renamed", with(func(s *LabelSnapshot) { s.BuildingName = "อาคาร 1 (สำนักงานใหญ่)" }), LabelChanged},
	}
	for _, tc := range cases {
		if got := LabelStatus(tc.printed, now); got != tc.want {
			t.Errorf("%s = %s, want %s", tc.name, got, tc.want)
		}
	}
	if parseSnapshot(nil) != nil || parseSnapshot([]byte("not json")) != nil {
		t.Error("empty / bad snapshot should read as never printed")
	}
	if s := parseSnapshot([]byte(`{"code":"AC-1","roomId":"` + room.String() + `"}`)); s == nil || s.RoomID != room {
		t.Errorf("parse = %+v", s)
	}
}

// #57 input rules before the database: 1–500 distinct ids.
func TestMarkLabelsPrintedInput(t *testing.T) {
	svc := NewService(nil, nil)
	var fe *apperr.Error
	if _, err := svc.MarkLabelsPrinted(context.Background(), uuid.New(), nil); !errors.As(err, &fe) || fe.Fields["assetIds"] != "REQUIRED" {
		t.Errorf("empty: %v", err)
	}
	many := make([]uuid.UUID, MaxLabelsPerPrint+1)
	for i := range many {
		many[i] = uuid.New()
	}
	if _, err := svc.MarkLabelsPrinted(context.Background(), uuid.New(), many); !errors.As(err, &fe) || fe.Fields["assetIds"] != "TOO_MANY" {
		t.Errorf("501: %v", err)
	}
	id := uuid.New()
	if got := uniqueIDs([]uuid.UUID{id, id}); len(got) != 1 {
		t.Errorf("duplicates kept: %v", got)
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

// Stage 5B (repair CR-036): #56 / #57 / #48 on Postgres — never → current after a print, moved via #48,
// changed after a room rename, code locked, inactive id saves nothing, filters and order.
func TestAssetLabels(t *testing.T) {
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

	// two active rooms on the same floor of one building
	var building, floor, roomA, roomB uuid.UUID
	var roomAName string
	if err := pool.QueryRow(ctx, `SELECT b.id, f.id, r.id, r.name FROM platform.rooms r JOIN platform.floors f ON f.id = r.floor_id AND f.is_active
		JOIN platform.buildings b ON b.id = f.building_id AND b.is_active
		WHERE r.is_active AND (SELECT count(*) FROM platform.rooms x WHERE x.floor_id = f.id AND x.is_active) >= 2
		ORDER BY b.sort_order, f.level, r.sort_order LIMIT 1`).Scan(&building, &floor, &roomA, &roomAName); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT id FROM platform.rooms WHERE floor_id = $1 AND is_active AND id <> $2 ORDER BY sort_order LIMIT 1`, floor, roomA).Scan(&roomB); err != nil {
		t.Fatal(err)
	}
	var typeID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM platform.asset_types WHERE is_active ORDER BY sort_order LIMIT 1`).Scan(&typeID); err != nil {
		t.Fatal(err)
	}
	suffix := uuid.NewString()[:6]
	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, first_name_th) VALUES ($1, 'ทดสอบป้าย') RETURNING id`, "ITLB"+suffix).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	svc := NewService(NewRepository(pool), locations.NewService(locations.NewRepository(pool)))
	str := func(s string) *string { return &s }
	var ids []uuid.UUID
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `UPDATE platform.rooms SET name = $2 WHERE id = $1`, roomA, roomAName)
		_, _ = pool.Exec(context.Background(), `DELETE FROM platform.audit_log WHERE actor_user_id = $1`, actor)
		for _, id := range ids {
			_, _ = pool.Exec(context.Background(), `DELETE FROM platform.assets WHERE id = $1`, id)
		}
		_, _ = pool.Exec(context.Background(), `DELETE FROM platform.users WHERE id = $1`, actor)
	})
	mk := func(code string, room uuid.UUID) Asset {
		a, err := svc.CreateAsset(ctx, actor, AssetInput{RoomID: &room, AssetTypeID: &typeID, Code: str(code), Name: str("ป้ายทดสอบ " + code)})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, a.ID)
		return a
	}
	a1, a2 := mk("TLB2-"+suffix, roomA), mk("TLB1-"+suffix, roomA)
	off := mk("TLB3-"+suffix, roomB)
	if a1.LabelStatus != LabelNever || a1.LabelPrintedAt != nil {
		t.Errorf("new asset = %s", a1.LabelStatus)
	}

	mine := func(list []LabelAsset) []LabelAsset {
		out := []LabelAsset{}
		for _, x := range list {
			for _, id := range ids {
				if x.ID == id {
					out = append(out, x)
				}
			}
		}
		return out
	}
	list, err := svc.LabelAssets(ctx, LabelFilter{BuildingID: building, RoomID: &roomA})
	if err != nil {
		t.Fatal(err)
	}
	if got := mine(list); len(got) != 2 || got[0].ID != a2.ID || got[0].LabelStatus != LabelNever || got[0].BuildingID != building {
		t.Fatalf("#56 room = %+v", got)
	}
	if _, err := svc.LabelAssets(ctx, LabelFilter{BuildingID: uuid.New()}); !errors.Is(err, locations.ErrBuildingNotFound) {
		t.Errorf("unknown building: %v", err)
	}

	// an inactive id saves nothing
	offAt := off.UpdatedAt
	if _, err := svc.UpdateAsset(ctx, actor, off.ID, AssetInput{IsActive: ptr(false), UpdatedAt: offAt}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.MarkLabelsPrinted(ctx, actor, []uuid.UUID{a1.ID, off.ID}); !errors.Is(err, ErrAssetNotActive) {
		t.Fatalf("inactive in the print: %v", err)
	}
	if cur, _ := NewRepository(pool).Asset(ctx, a1.ID); cur.LabelStatus != LabelNever {
		t.Fatalf("rolled back = %s", cur.LabelStatus)
	}
	if list, _ := svc.LabelAssets(ctx, LabelFilter{BuildingID: building, FloorID: &floor}); len(mine(list)) != 2 {
		t.Errorf("#56 lists the inactive asset: %+v", mine(list))
	}

	printed, err := svc.MarkLabelsPrinted(ctx, actor, []uuid.UUID{a1.ID, a2.ID, a1.ID})
	if err != nil || len(printed) != 2 || printed[0].LabelStatus != LabelCurrent || printed[0].LabelPrintedAt == nil {
		t.Fatalf("#57 = %+v, %v", printed, err)
	}
	if printed[0].UpdatedAt != a1.UpdatedAt {
		t.Errorf("printing changed updatedAt")
	}
	var audits int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM platform.audit_log WHERE actor_user_id = $1 AND action = 'asset.label_printed' AND (data->>'count')::int = 2`, actor).Scan(&audits)
	if audits != 1 {
		t.Errorf("audit rows = %d", audits)
	}

	// code locked; a rename keeps working and shows `changed`; a move shows `moved`
	if _, err := svc.UpdateAsset(ctx, actor, a1.ID, AssetInput{Code: str("TLB9-" + suffix), UpdatedAt: a1.UpdatedAt}); !errors.Is(err, ErrCodeLocked) {
		t.Fatalf("code change after print: %v", err)
	}
	renamed, err := svc.UpdateAsset(ctx, actor, a1.ID, AssetInput{Code: str(a1.Code), Name: str("ป้ายทดสอบ ใหม่"), UpdatedAt: a1.UpdatedAt})
	if err != nil || renamed.LabelStatus != LabelChanged {
		t.Fatalf("rename = %s, %v", renamed.LabelStatus, err)
	}
	moved, err := svc.UpdateAsset(ctx, actor, a1.ID, AssetInput{RoomID: &roomB, UpdatedAt: renamed.UpdatedAt})
	if err != nil || moved.LabelStatus != LabelMoved {
		t.Fatalf("move = %s, %v", moved.LabelStatus, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE platform.rooms SET name = name || ' (ใหม่)' WHERE id = $1`, roomA); err != nil {
		t.Fatal(err)
	}
	if cur, _ := NewRepository(pool).Asset(ctx, a2.ID); cur.LabelStatus != LabelChanged {
		t.Errorf("after room rename = %s", cur.LabelStatus)
	}
	// reprint clears it
	if again, err := svc.MarkLabelsPrinted(ctx, actor, []uuid.UUID{a1.ID, a2.ID}); err != nil || again[0].LabelStatus != LabelCurrent || again[1].LabelStatus != LabelCurrent {
		t.Fatalf("reprint = %+v, %v", again, err)
	}
}
