package repair

import (
	"context"
	"os"
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
	if _, err := svc.EnsureSampleData(ctx); err != nil {
		t.Fatal(err)
	}
	cats, err := svc.Categories(ctx)
	if err != nil || len(cats) == 0 {
		t.Fatalf("categories: %v", err)
	}
	blds, err := svc.Buildings(ctx)
	if err != nil || len(blds) == 0 || len(blds[0].Floors) == 0 {
		t.Fatalf("buildings: %v", err)
	}
	return &pgFixture{pool: pool, png: pngBytes(t, 32, 32), svc: svc, cat: cats[0], building: blds[0]}
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

// createWith fills the place and a fresh photo; the caller sets category, symptoms and location.
func (p *pgFixture) createWith(v Viewer, in CreateTicketInput) (TicketDetail, error) {
	ctx := context.Background()
	photo, err := p.svc.UploadPhoto(ctx, v, p.png)
	if err != nil {
		return TicketDetail{}, err
	}
	floor := p.building.Floors[0]
	in.BuildingID, in.FloorID, in.PhotoIDs = &p.building.ID, &floor.ID, []uuid.UUID{photo}
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

// CR-008: priority comes from the symptoms, the category default or the "อื่นๆ" default.
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

	other, err := p.createWith(reporter, CreateTicketInput{CategoryOther: "ลิฟต์", SymptomOther: "ค้างระหว่างชั้น"})
	if err != nil {
		t.Fatal(err)
	}
	if other.Category != nil || other.CategoryOther == nil || *other.CategoryOther != "ลิฟต์" ||
		other.Priority != PriorityMedium || other.PrioritySource != PrioritySourceDefault || len(other.Symptoms) != 0 {
		t.Fatalf("typed category: %+v", other.TicketSummary)
	}
	if _, err := p.svc.Ticket(ctx, reporter, other.ID); err != nil {
		t.Fatalf("open typed-category ticket: %v", err)
	}

	places, err := p.svc.RecentPlaces(ctx, reporter)
	if err != nil || len(places) != 1 || places[0].Building.ID != p.building.ID {
		t.Fatalf("recent places: %+v err=%v", places, err)
	}
}
