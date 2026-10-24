package repair

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Integration tests against a migrated Postgres. They run when TEST_DATABASE_URL is set
// (CI backend job; locally: `make test-db` then `TEST_DATABASE_URL=… go test ./internal/modules/repair/`).

type pgFixture struct {
	pool     *pgxpool.Pool
	png      []byte
	svc      *Service
	cat      Category
	other    Category // the "อื่น ๆ" category (CR-014)
	building Building
}

func newPgFixture(t *testing.T) *pgFixture {
	t.Helper()
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
	svc := NewService(NewRepository(pool), newMemStore())
	cats, err := svc.Categories(ctx)
	if err != nil || len(cats) < 2 || !cats[len(cats)-1].IsOther {
		t.Fatalf("categories: %v", err)
	}
	blds, err := svc.Buildings(ctx)
	if err != nil || len(blds) == 0 || len(blds[0].Floors) == 0 || len(blds[0].Floors[0].Rooms) == 0 {
		t.Fatalf("buildings: %v", err)
	}
	return &pgFixture{pool: pool, png: pngBytes(t, 32, 32), svc: svc, cat: cats[0], other: cats[len(cats)-1], building: blds[0]}
}

// user inserts a throwaway platform user; its tickets and photos are removed after the test.
func (p *pgFixture) user(t *testing.T, role string) Viewer {
	t.Helper()
	ctx := context.Background()
	code := "TEST-" + uuid.NewString()[:8]
	var id uuid.UUID
	if err := p.pool.QueryRow(ctx,
		`INSERT INTO platform.users (employee_code, first_name_th, last_name_th, department) VALUES ($1, 'ทดสอบ', $1, 'ฝ่ายทดสอบ') RETURNING id`,
		code).Scan(&id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, q := range []string{
			`DELETE FROM repair.tickets WHERE reporter_id = $1`,
			`DELETE FROM repair.photos WHERE uploader_id = $1`,
			`DELETE FROM platform.users WHERE id = $1`,
		} {
			if _, err := p.pool.Exec(context.Background(), q, id); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})
	return Viewer{ID: id, Role: role}
}

// create is safe to call from goroutines (no t.Fatal).
func (p *pgFixture) create(v Viewer, location string) (TicketDetail, error) {
	return p.createWith(v, CreateTicketInput{CategoryID: &p.cat.ID, SymptomIDs: []uuid.UUID{p.cat.Symptoms[0].ID}, LocationDetail: location})
}

// createWith fills the place (first room of the first floor unless set) and a fresh photo; the
// caller sets category, symptoms and the extra spot.
func (p *pgFixture) createWith(v Viewer, in CreateTicketInput) (TicketDetail, error) {
	ctx := context.Background()
	photo, err := p.svc.UploadPhoto(ctx, v, p.png)
	if err != nil {
		return TicketDetail{}, err
	}
	floor := p.building.Floors[0]
	in.BuildingID, in.FloorID, in.PhotoIDs = &p.building.ID, &floor.ID, []uuid.UUID{photo}
	if in.RoomID == nil {
		in.RoomID = &floor.Rooms[0].ID
	}
	return p.svc.CreateTicket(ctx, v, in)
}

func TestPgConcurrentCreatesGetDistinctNumbers(t *testing.T) {
	p := newPgFixture(t)
	reporter := p.user(t, users.RoleEmployee)

	const n = 12
	var wg sync.WaitGroup
	nos := make(chan string, n)
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			d, err := p.create(reporter, "")
			if err != nil {
				errs <- err
				return
			}
			nos <- d.TicketNo
		}()
	}
	wg.Wait()
	close(nos)
	close(errs)
	for err := range errs {
		t.Fatalf("create: %v", err)
	}
	seen := map[string]bool{}
	for no := range nos {
		if seen[no] {
			t.Fatalf("duplicate ticket number %s", no)
		}
		seen[no] = true
		if !strings.HasPrefix(no, "RP-25") {
			t.Fatalf("unexpected format %s", no)
		}
	}
	if len(seen) != n {
		t.Fatalf("got %d numbers, want %d", len(seen), n)
	}
}

func TestPgListCountsAndVisibility(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	reporter := p.user(t, users.RoleEmployee)
	other := p.user(t, users.RoleHousekeeperLead)
	admin := p.user(t, users.RoleAdmin)

	marker := "ห้อง-" + uuid.NewString()[:6]
	high, err := p.create(reporter, marker+" A")
	if err != nil {
		t.Fatal(err)
	}
	critical, err := p.create(reporter, marker+" B")
	if err != nil {
		t.Fatal(err)
	}
	if len(critical.Symptoms) != 1 || len(critical.Photos) != 1 || len(critical.Timeline) != 1 || critical.Reporter.Name == "" {
		t.Fatalf("detail incomplete: %+v", critical)
	}

	q := escapeLike(marker)
	mine, total, err := p.svc.Tickets(ctx, reporter, TicketFilter{Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 20})
	if err != nil || total != 2 || len(mine) != 2 || mine[0].ThumbPhotoID == nil || len(mine[0].Symptoms) != 1 {
		t.Fatalf("mine: total=%d err=%v", total, err)
	}
	none, total, _ := p.svc.Tickets(ctx, other, TicketFilter{Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 20})
	if total != 0 || len(none) != 0 {
		t.Fatalf("other user sees %d tickets", total)
	}
	all, total, err := p.svc.Tickets(ctx, admin, TicketFilter{ScopeAll: true, Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 20})
	if err != nil || total != 2 || len(all) != 2 {
		t.Fatalf("admin scope=all: total=%d err=%v", total, err)
	}

	byNo := escapeLike(high.TicketNo)
	one, total, _ := p.svc.Tickets(ctx, reporter, TicketFilter{Relation: "all", Q: &byNo, Sort: "updatedAt:desc", Page: 1, PageSize: 20})
	if total != 1 || one[0].ID != high.ID {
		t.Fatalf("search by ticket number: total=%d", total)
	}

	// #35 (CR-019): the S06 page — slim rows, same total, page size honoured, title joined in SQL.
	rows, total, err := p.svc.MyTickets(ctx, reporter, TicketFilter{Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 1})
	if err != nil || total != 2 || len(rows) != 1 || rows[0].Title != mine[0].Symptoms[0].Name || !rows[0].IsReporter || rows[0].Step() != StepAwaitingAssessment {
		t.Fatalf("my tickets page 1: total=%d rows=%+v err=%v", total, rows, err)
	}
	if rows, total, _ := p.svc.MyTickets(ctx, other, TicketFilter{Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 10}); total != 0 || len(rows) != 0 {
		t.Fatalf("other user sees %d of my tickets", total)
	}

	counts, err := p.svc.TicketCounts(ctx, reporter, TicketFilter{Relation: "all", Q: &q})
	if err != nil || counts.AwaitingAssessment != 2 || counts.InProgress != 2 {
		t.Fatalf("counts: %+v err=%v", counts, err)
	}

	if _, err := p.svc.Ticket(ctx, other, high.ID); err == nil {
		t.Fatal("unrelated lead can open the ticket")
	}
	if _, err := p.svc.Ticket(ctx, admin, high.ID); err != nil {
		t.Fatalf("admin: %v", err)
	}
	if _, _, err := p.svc.OpenPhoto(ctx, other, high.Photos[0], true); err == nil {
		t.Fatal("unrelated lead can open the photo")
	}

}

// CR-008 / CR-014: priority comes from the symptoms or the category default; "อื่น ๆ" is a DB category.
func TestPgPriorityAndOther(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	reporter := p.user(t, users.RoleEmployee)

	best := p.cat.Symptoms[0]
	ids := make([]uuid.UUID, 0, len(p.cat.Symptoms))
	for _, s := range p.cat.Symptoms {
		ids = append(ids, s.ID)
		if priorityRank(s.Priority) < priorityRank(best.Priority) {
			best = s
		}
	}
	all, err := p.createWith(reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomIDs: ids})
	if err != nil {
		t.Fatal(err)
	}
	if all.Priority != best.Priority || all.PrioritySource != PrioritySourceSymptom {
		t.Fatalf("all symptoms: %s/%s, want %s/symptom", all.Priority, all.PrioritySource, best.Priority)
	}

	typed, err := p.createWith(reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomOther: "มีควันออกมา"})
	if err != nil {
		t.Fatal(err)
	}
	if typed.Priority != p.cat.DefaultPriority || typed.PrioritySource != PrioritySourceCategory || typed.SymptomOther == nil {
		t.Fatalf("typed symptom: %s/%s other=%v", typed.Priority, typed.PrioritySource, typed.SymptomOther)
	}

	// AC2: อื่น ๆ + ใช้งานไม่ได้ + typed ลิฟต์ → category อื่น ๆ, categoryOther ลิฟต์, priority ปกติ.
	other, err := p.createWith(reporter, CreateTicketInput{
		CategoryID: &p.other.ID, SymptomIDs: []uuid.UUID{p.other.Symptoms[0].ID}, CategoryOther: "ลิฟต์", LocationDetail: "ฝั่งหน้าต่าง",
	})
	if err != nil {
		t.Fatal(err)
	}
	if other.Category == nil || other.Category.ID != p.other.ID || other.CategoryOther == nil || *other.CategoryOther != "ลิฟต์" ||
		other.Priority != PriorityMedium || len(other.Symptoms) != 1 || other.Room == nil {
		t.Fatalf("อื่น ๆ category: %+v", other.TicketSummary)
	}
	if _, err := p.createWith(reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomOther: "x", CategoryOther: "ลิฟต์"}); code(err) != "VALIDATION_FAILED" {
		t.Fatalf("typed name on a normal category: %v", err)
	}

	// #28: one room → one place, with the room and the newest extra spot.
	places, err := p.svc.RecentPlaces(ctx, reporter)
	if err != nil || len(places) != 1 || places[0].Building.ID != p.building.ID || places[0].Room.ID != p.building.Floors[0].Rooms[0].ID ||
		places[0].LocationDetail == nil || *places[0].LocationDetail != "ฝั่งหน้าต่าง" {
		t.Fatalf("recent places: %+v err=%v", places, err)
	}

	// #6 q matches the room name.
	q := escapeLike(p.building.Floors[0].Rooms[0].Name)
	if _, total, err := p.svc.Tickets(ctx, reporter, TicketFilter{Relation: "all", Q: &q, Sort: "updatedAt:desc", Page: 1, PageSize: 20}); err != nil || total != 3 {
		t.Fatalf("search by room: total=%d err=%v", total, err)
	}
}

// CR-014 BR-F02-7: the room must be active and on the picked floor.
func TestPgRoomRules(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	reporter := p.user(t, users.RoleEmployee)
	if len(p.building.Floors) < 2 {
		t.Skip("needs two floors")
	}
	wrong := p.building.Floors[1].Rooms[0].ID
	if _, err := p.createWith(reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomOther: "x", RoomID: &wrong}); code(err) != "MASTER_DATA_CHANGED" {
		t.Fatalf("room of another floor: %v", err)
	}

	var inactive uuid.UUID
	if err := p.pool.QueryRow(ctx,
		`INSERT INTO platform.rooms (floor_id, name, area_type, is_active) VALUES ($1, $2, 'other', false) RETURNING id`,
		p.building.Floors[0].ID, "ปิดใช้งาน-"+uuid.NewString()[:6]).Scan(&inactive); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = p.pool.Exec(context.Background(), `DELETE FROM platform.rooms WHERE id = $1`, inactive) })
	if _, err := p.createWith(reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomOther: "x", RoomID: &inactive}); code(err) != "MASTER_DATA_CHANGED" {
		t.Fatalf("inactive room: %v", err)
	}
}

// CR-014: #1 is the attachment's master (7 categories, อื่น ๆ last) and #2 lists rooms per floor with
// one common area; re-running the master data part of the migration changes nothing.
func TestPgMasterData(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()

	check := func() {
		cats, err := p.svc.Categories(ctx)
		if err != nil {
			t.Fatal(err)
		}
		want := []string{"ไฟฟ้าและแสงสว่าง", "ระบบปรับอากาศ", "ประปาและสุขาภิบาล", "ห้องประชุมและโสตทัศนูปกรณ์", "อาคารและพื้นที่ส่วนกลาง", "ลานจอด / ไม้กั้น", "อื่น ๆ"}
		symptoms := 0
		if len(cats) != len(want) {
			t.Fatalf("got %d categories, want %d", len(cats), len(want))
		}
		for i, c := range cats {
			symptoms += len(c.Symptoms)
			if c.Name != want[i] || c.IsOther != (i == 6) {
				t.Fatalf("category %d = %s other=%v", i, c.Name, c.IsOther)
			}
			for _, s := range c.Symptoms {
				if strings.HasPrefix(s.Name, "อื่นๆ") {
					t.Fatalf("%s has an อื่นๆ symptom row", c.Name)
				}
			}
		}
		if symptoms != 38 || len(cats[5].AreaTypes) != 1 || cats[5].AreaTypes[0] != AreaParking || len(cats[6].AreaTypes) != 0 {
			t.Fatalf("symptoms=%d parking areas=%v other areas=%v", symptoms, cats[5].AreaTypes, cats[6].AreaTypes)
		}
	}
	check()

	up, err := os.ReadFile(filepath.Join("..", "..", "..", "db", "migrations", "20261019000001_repair_cr014.sql"))
	if err != nil {
		t.Fatal(err)
	}
	body := string(up)
	start, end := strings.Index(body, "-- ---- master data"), strings.Index(body, "-- +goose Down")
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var before, after int
	countSQL := `SELECT (SELECT count(*) FROM repair.categories) + (SELECT count(*) FROM repair.symptoms) + (SELECT count(*) FROM platform.rooms)`
	if err := tx.QueryRow(ctx, countSQL).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, body[start:end]); err != nil {
		t.Fatalf("re-run master data: %v", err)
	}
	if err := tx.QueryRow(ctx, countSQL).Scan(&after); err != nil || before != after {
		t.Fatalf("re-run added rows: %d → %d (%v)", before, after, err)
	}

	blds, err := p.svc.Buildings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	parking := false
	for _, b := range blds {
		for _, f := range b.Floors {
			common := 0
			for _, rm := range f.Rooms {
				if rm.AreaType == AreaCommon {
					common++
				}
				parking = parking || rm.AreaType == AreaParking
			}
			if len(f.Rooms) == 0 || (b.Name != "พื้นที่ภายนอกอาคาร" && common != 1) {
				t.Fatalf("%s ชั้น %s: rooms=%d common=%d", b.Name, f.Name, len(f.Rooms), common)
			}
		}
	}
	if !parking {
		t.Fatal("no parking room")
	}
}

// CR-016 ids from migration 20261020000001.
var (
	b1Building = uuid.MustParse("c016b1d0-0000-4000-8000-000000000001")
	b1Floor1   = uuid.MustParse("c016f100-0000-4000-8000-000000000001")
	b1HR3      = uuid.MustParse("c016e001-0000-4000-8000-000000000006")
	b1WC       = uuid.MustParse("c016e001-0000-4000-8000-000000000007")
	b1DD       = uuid.MustParse("c016e001-0000-4000-8000-000000000001")
	acType     = uuid.MustParse("c016a700-0000-4000-8000-000000000001")
)

// CR-016: #27 numbers equal S11 (BR-F23-1), อาคาร 1 has 6 traced floors, and the asset rules hold
// against the real SQL (unique code ignoring case, point in polygon, deactivate, audit log).
func TestPgDashboardAndAssets(t *testing.T) {
	p := newPgFixture(t)
	ctx := context.Background()
	admin := p.user(t, users.RoleAdmin)
	reporter := p.user(t, users.RoleEmployee)
	t.Cleanup(func() {
		for _, q := range []string{
			`DELETE FROM platform.audit_log WHERE actor_user_id = $1`,
			`DELETE FROM platform.assets WHERE created_by = $1`,
		} {
			if _, err := p.pool.Exec(context.Background(), q, admin.ID); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})

	photo, err := p.svc.UploadPhoto(ctx, reporter, p.png)
	if err != nil {
		t.Fatal(err)
	}
	b, f, r := b1Building, b1Floor1, b1HR3
	if _, err := p.svc.CreateTicket(ctx, reporter, CreateTicketInput{CategoryID: &p.cat.ID, SymptomIDs: []uuid.UUID{p.cat.Symptoms[0].ID},
		BuildingID: &b, FloorID: &f, RoomID: &r, PhotoIDs: []uuid.UUID{photo}}); err != nil {
		t.Fatal(err)
	}

	o, err := p.svc.Overview(ctx, admin)
	if err != nil {
		t.Fatal(err)
	}
	s11, err := p.svc.TicketCounts(ctx, admin, TicketFilter{ScopeAll: true, Relation: "all"})
	if err != nil {
		t.Fatal(err)
	}
	if o.Counts.AwaitingAssessment != s11.AwaitingAssessment || o.Counts.InRepair != s11.InRepair ||
		o.Counts.AwaitingRating != s11.Resolved || o.Counts.Open != s11.InProgress+s11.Resolved {
		t.Fatalf("#27 %+v ≠ S11 %+v", o.Counts, s11)
	}
	if o.Counts.ReportedToday < 1 {
		t.Errorf("reportedToday = %d", o.Counts.ReportedToday)
	}
	var b1 *OverviewBuilding
	for i := range o.Buildings {
		if o.Buildings[i].ID == b1Building {
			b1 = &o.Buildings[i]
		}
	}
	if b1 == nil || !b1.HasModel || len(b1.Floors) != 6 || b1.Floors[0].Open.Total() < 1 {
		t.Fatalf("อาคาร 1 = %+v", b1)
	}
	if b1.WidthM == nil || *b1.WidthM != 32 || b1.DepthM == nil || *b1.DepthM != 15 {
		t.Errorf("อาคาร 1 footprint = %v × %v, want 32 × 15", b1.WidthM, b1.DepthM)
	}
	for _, f := range b1.Floors { // CR-017: steps split the same open tickets
		if st := f.Steps; st.AwaitingAssessment+st.InRepair+st.AwaitingRating != f.Open.Total() {
			t.Errorf("floor %s steps %+v ≠ open %d", f.Name, st, f.Open.Total())
		}
	}

	plan, err := p.svc.FloorPlan(ctx, admin, b1Floor1)
	if err != nil {
		t.Fatal(err)
	}
	if plan.WidthM == nil || *plan.WidthM != 32 || len(plan.Rooms) != 8 {
		t.Fatalf("plan = %+v", plan)
	}
	area := 0.0
	for _, rm := range plan.Rooms {
		if rm.AreaType != AreaRestroom {
			area += shapeArea(rm.Shape)
		}
	}
	if area < 479.99 || area > 480.01 {
		t.Errorf("floor 1 rooms add up to %v m², want 480", area)
	}

	code1 := "TST-" + uuid.NewString()[:6]
	x, z := 28.0, 12.0
	a, err := p.svc.CreateAsset(ctx, admin, AssetInput{AssetTypeID: acType, Code: code1, Name: "แอร์ทดสอบ", RoomID: b1HR3, X: &x, Z: &z})
	if err != nil {
		t.Fatal(err)
	}
	if a.X == nil || *a.X != 28 || a.Type.Key != "aircon" || a.Room.ID != b1HR3 {
		t.Fatalf("asset = %+v", a)
	}
	if _, err := p.svc.CreateAsset(ctx, admin, AssetInput{AssetTypeID: acType, Code: strings.ToLower(code1), Name: "x", RoomID: b1DD}); code(err) != "ASSET_CODE_TAKEN" {
		t.Errorf("duplicate code: %v", err)
	}
	if _, err := p.svc.UpdateAsset(ctx, admin, a.ID, AssetInput{Code: code1, Name: "แอร์ทดสอบ", RoomID: b1HR3, X: &[]float64{6}[0], Z: &[]float64{3}[0]}); code(err) != "POINT_OUTSIDE_ROOM" {
		t.Errorf("point in another room: %v", err)
	}
	wx, wz := 13.0, 3.0
	moved, err := p.svc.UpdateAsset(ctx, admin, a.ID, AssetInput{Code: code1, Name: "แอร์ทดสอบ", RoomID: b1WC, X: &wx, Z: &wz})
	if err != nil || moved.Room.ID != b1WC {
		t.Fatalf("move into ห้องน้ำ: %+v %v", moved, err)
	}
	if err := p.svc.DeactivateAsset(ctx, admin, a.ID); err != nil {
		t.Fatal(err)
	}
	plan, err = p.svc.FloorPlan(ctx, admin, b1Floor1)
	if err != nil {
		t.Fatal(err)
	}
	for _, as := range plan.Assets {
		if as.ID == a.ID {
			t.Error("deactivated asset still on the plan")
		}
	}
	var audits int
	if err := p.pool.QueryRow(ctx, `SELECT count(*) FROM platform.audit_log WHERE target_type = 'asset' AND target_id = $1`, a.ID.String()).Scan(&audits); err != nil || audits != 3 {
		t.Errorf("audit rows = %d, %v (created, updated, deactivated)", audits, err)
	}
	if suggested, err := p.svc.SuggestAssetCode(ctx, admin, acType, b1Floor1); err != nil || !strings.HasPrefix(suggested, "AC-1-") {
		t.Errorf("suggest = %s, %v", suggested, err)
	}
}
