package repair

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// ---- fakes ----

type fakeRepo struct {
	cats     map[uuid.UUID]bool               // id → active
	catDef   map[uuid.UUID]string             // category → default priority
	catOther map[uuid.UUID]bool               // the "อื่น ๆ" category (CR-014)
	symptoms map[uuid.UUID]uuid.UUID          // symptom → category
	symPrio  map[uuid.UUID]string             // symptom → priority
	recent   []RecentPlace                    // #28 result
	floors   map[uuid.UUID]uuid.UUID          // floor → building
	rooms    map[uuid.UUID]uuid.UUID          // active room → floor (CR-014)
	photos   map[uuid.UUID]*Photo             // all photos
	photoAt  map[uuid.UUID]time.Time          // created at
	format   TicketNumberFormat               // repair.settings
	counters map[int]int64                    // year → last number
	tickets  map[uuid.UUID]*TicketDetail      // by id
	order    []uuid.UUID                      // insertion order
	subs     map[uuid.UUID]map[uuid.UUID]bool // ticket → subscribers
	inserted []NewTicket
	events   []NewEvent // ticket events written by actions
	dash     *dashFake  // CR-016 dashboard and equipment (service_dashboard_test.go)
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		cats: map[uuid.UUID]bool{}, catDef: map[uuid.UUID]string{}, catOther: map[uuid.UUID]bool{},
		symptoms: map[uuid.UUID]uuid.UUID{}, symPrio: map[uuid.UUID]string{},
		floors: map[uuid.UUID]uuid.UUID{}, rooms: map[uuid.UUID]uuid.UUID{},
		photos: map[uuid.UUID]*Photo{}, photoAt: map[uuid.UUID]time.Time{},
		format:   TicketNumberFormat{Prefix: "RP", YearFormat: "be", Digits: 6},
		counters: map[int]int64{}, tickets: map[uuid.UUID]*TicketDetail{},
		subs: map[uuid.UUID]map[uuid.UUID]bool{},
		dash: newDashFake(),
	}
}

func (f *fakeRepo) ListCategories(context.Context) ([]Category, error) { return nil, nil }
func (f *fakeRepo) ListBuildings(context.Context) ([]Building, error)  { return nil, nil }
func (f *fakeRepo) ListRecentPlaces(context.Context, uuid.UUID) ([]RecentPlace, error) {
	return f.recent, nil
}

func (f *fakeRepo) InsertPhoto(_ context.Context, p NewPhoto) error {
	f.photos[p.ID] = &Photo{ID: p.ID, UploaderID: p.UploaderID, ContentType: p.ContentType, StorageKey: p.StorageKey,
		ThumbKey: p.ThumbKey, ThumbContentType: p.ThumbContentType}
	f.photoAt[p.ID] = time.Now()
	return nil
}

func (f *fakeRepo) GetPhoto(_ context.Context, id uuid.UUID) (Photo, error) {
	p, ok := f.photos[id]
	if !ok {
		return Photo{}, ErrPhotoNotFound
	}
	return *p, nil
}

func (f *fakeRepo) DeleteUnattachedPhotos(_ context.Context, olderThan time.Time) ([]string, error) {
	var keys []string
	for id, p := range f.photos {
		if p.TicketID == nil && f.photoAt[id].Before(olderThan) {
			keys = append(keys, p.StorageKey, p.ThumbKey)
			delete(f.photos, id)
		}
	}
	return keys, nil
}

func (f *fakeRepo) GetTicketAccess(_ context.Context, id, viewerID uuid.UUID) (ticketAccess, error) {
	t, ok := f.tickets[id]
	if !ok {
		return ticketAccess{}, ErrTicketNotFound
	}
	acc := ticketAccess{ReporterID: t.Reporter.ID, ViewerSubscribed: f.subs[id][viewerID]}
	if t.Technician != nil {
		acc.HolderID = &t.Technician.ID
	}
	return acc, nil
}

func (f *fakeRepo) GetTicket(_ context.Context, id, viewerID uuid.UUID) (TicketDetail, error) {
	t, ok := f.tickets[id]
	if !ok {
		return TicketDetail{}, ErrTicketNotFound
	}
	d := *t
	d.ViewerSubscribed = f.subs[id][viewerID]
	d.Timeline = append([]TimelineEvent(nil), t.Timeline...)
	return d, nil
}

func (f *fakeRepo) ListTickets(_ context.Context, viewerID uuid.UUID, flt TicketFilter) ([]TicketSummary, int64, error) {
	var out []TicketSummary
	for _, id := range f.order {
		t := f.tickets[id]
		if flt.ScopeAll || t.Reporter.ID == viewerID || f.subs[id][viewerID] {
			s := t.TicketSummary
			s.ViewerSubscribed = f.subs[id][viewerID]
			out = append(out, s)
		}
	}
	return out, int64(len(out)), nil
}

func (f *fakeRepo) CountTickets(context.Context, uuid.UUID, TicketFilter) (TicketCounts, error) {
	return TicketCounts{}, nil
}

// CR-005 actions and contractors are not covered by these unit tests yet (PROGRESS.md Open issues).
func (f *fakeRepo) AutoCloseDue(context.Context, time.Time) (int, error) { return 0, nil }
func (f *fakeRepo) ListContractorTypes(context.Context) ([]Ref, error)   { return nil, nil }
func (f *fakeRepo) EnsureContractorType(context.Context, string, uuid.UUID) (Ref, error) {
	return Ref{}, nil
}
func (f *fakeRepo) ListContractors(context.Context, ContractorFilter) ([]Contractor, int64, error) {
	return nil, 0, nil
}
func (f *fakeRepo) GetContractor(context.Context, uuid.UUID) (Contractor, error) {
	return Contractor{}, ErrContractorNotFound
}
func (f *fakeRepo) ListContractorJobs(context.Context, uuid.UUID, int, int) ([]ContractorJob, int64, error) {
	return nil, 0, nil
}
func (f *fakeRepo) LockTicket(_ context.Context, id uuid.UUID) (LockedTicket, error) {
	t, ok := f.tickets[id]
	if !ok {
		return LockedTicket{}, ErrTicketNotFound
	}
	return LockedTicket{ID: id, Status: t.Status, ReporterID: t.Reporter.ID, Assessed: t.ExpectedDoneOn != nil}, nil
}
func (f *fakeRepo) AssessTicket(context.Context, uuid.UUID, uuid.UUID, AssessInput, time.Time) error {
	return nil
}
func (f *fakeRepo) ResolveTicket(context.Context, uuid.UUID, uuid.UUID, ResolveInput, time.Time, time.Time) error {
	return nil
}
func (f *fakeRepo) ConfirmTicket(context.Context, uuid.UUID, int16, *string, time.Time) error {
	return nil
}
func (f *fakeRepo) SendBackTicket(context.Context, uuid.UUID, time.Time) error { return nil }
func (f *fakeRepo) AdminCloseTicket(_ context.Context, id uuid.UUID, now time.Time) error {
	t := f.tickets[id]
	reason := "admin_closed"
	t.Status, t.ClosedReason, t.ClosedAt, t.AutoCloseAt = StatusClosed, &reason, &now, nil
	return nil
}
func (f *fakeRepo) InsertEvent(_ context.Context, e NewEvent) error {
	f.events = append(f.events, e)
	return nil
}
func (f *fakeRepo) ActiveContractorExists(context.Context, uuid.UUID) (bool, error) { return true, nil }
func (f *fakeRepo) CountContractorTypes(_ context.Context, ids []uuid.UUID) (int, error) {
	return len(ids), nil
}
func (f *fakeRepo) InsertContractor(context.Context, uuid.UUID, ContractorInput, uuid.UUID) error {
	return nil
}
func (f *fakeRepo) UpdateContractor(context.Context, uuid.UUID, ContractorInput) (bool, error) {
	return true, nil
}
func (f *fakeRepo) SetContractorTypes(context.Context, uuid.UUID, []uuid.UUID) error { return nil }

func (f *fakeRepo) InTx(ctx context.Context, fn func(tx TxRepository) error) error {
	// Snapshot what the transaction may change so a failed create leaves no trace.
	counters := map[int]int64{}
	for k, v := range f.counters {
		counters[k] = v
	}
	if err := fn(f); err != nil {
		f.counters = counters
		return err
	}
	return nil
}

func (f *fakeRepo) LockActiveCategory(_ context.Context, id uuid.UUID) (ActiveCategory, bool, error) {
	if !f.cats[id] {
		return ActiveCategory{}, false, nil
	}
	return ActiveCategory{DefaultPriority: f.catDef[id], IsOther: f.catOther[id]}, true, nil
}

func (f *fakeRepo) ActiveSymptomPriorities(_ context.Context, categoryID uuid.UUID, ids []uuid.UUID) ([]string, error) {
	var out []string
	for _, id := range ids {
		if c, ok := f.symptoms[id]; ok && c == categoryID {
			out = append(out, f.symPrio[id])
		}
	}
	return out, nil
}

func (f *fakeRepo) ActiveFloorInBuilding(_ context.Context, floorID, buildingID uuid.UUID) (bool, error) {
	b, ok := f.floors[floorID]
	return ok && b == buildingID, nil
}

func (f *fakeRepo) ActiveRoomOnFloor(_ context.Context, roomID, floorID uuid.UUID) (bool, error) {
	fl, ok := f.rooms[roomID]
	return ok && fl == floorID, nil
}

func (f *fakeRepo) LockAttachablePhotos(_ context.Context, uploaderID uuid.UUID, ids []uuid.UUID, notBefore time.Time) (int, error) {
	n := 0
	for _, id := range ids {
		if p, ok := f.photos[id]; ok && p.UploaderID == uploaderID && p.TicketID == nil && f.photoAt[id].After(notBefore) {
			n++
		}
	}
	return n, nil
}

func (f *fakeRepo) TicketNumberFormat(context.Context) (TicketNumberFormat, error) {
	return f.format, nil
}

func (f *fakeRepo) NextTicketCounter(_ context.Context, year int) (int64, error) {
	f.counters[year]++
	return f.counters[year], nil
}

func (f *fakeRepo) InsertTicket(_ context.Context, t NewTicket) error {
	f.inserted = append(f.inserted, t)
	for _, pid := range t.PhotoIDs {
		tid := t.ID
		f.photos[pid].TicketID = &tid
	}
	reporter := t.ReporterID
	f.tickets[t.ID] = &TicketDetail{
		TicketSummary: TicketSummary{
			ID: t.ID, TicketNo: t.TicketNo, Status: StatusInProgress, Priority: t.Priority, PrioritySource: t.PrioritySource,
			Category: &Ref{ID: t.CategoryID}, CategoryOther: t.CategoryOther, SymptomOther: t.SymptomOther,
			Room: &Ref{ID: t.RoomID}, LocationDetail: t.LocationDetail,
			Reporter: Person{ID: t.ReporterID}, CreatedAt: t.CreatedAt, UpdatedAt: t.CreatedAt,
		},
		Photos:   t.PhotoIDs,
		Timeline: []TimelineEvent{{ID: t.CreatedEventID, Type: EventCreated, Actor: &Person{ID: reporter}, At: t.CreatedAt}},
	}
	f.order = append(f.order, t.ID)
	return nil
}

type memStore struct {
	mu    sync.Mutex
	files map[string][]byte
}

func newMemStore() *memStore { return &memStore{files: map[string][]byte{}} }

func (m *memStore) Put(_ context.Context, key string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.files[key] = data
	return nil
}

func (m *memStore) Open(_ context.Context, key string) (io.ReadCloser, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.files[key]
	if !ok {
		return nil, errors.New("no file")
	}
	return io.NopCloser(bytes.NewReader(b)), nil
}

func (m *memStore) Delete(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.files, key)
	return nil
}

// ---- fixture ----

type fixture struct {
	repo     *fakeRepo
	store    *memStore
	svc      *Service
	now      time.Time
	cat      uuid.UUID
	sym1     uuid.UUID
	sym2     uuid.UUID
	building uuid.UUID
	floor    uuid.UUID
	room     uuid.UUID
	other    uuid.UUID // the "อื่น ๆ" category (CR-014)
	otherSym uuid.UUID // its critical symptom
	reporter Viewer
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{repo: newFakeRepo(), store: newMemStore(),
		now: time.Date(2026, 10, 14, 3, 15, 0, 0, time.UTC),
		cat: uuid.New(), sym1: uuid.New(), sym2: uuid.New(), building: uuid.New(), floor: uuid.New(), room: uuid.New(),
		other: uuid.New(), otherSym: uuid.New(),
		reporter: Viewer{ID: uuid.New(), Role: users.RoleEmployee},
	}
	f.repo.cats[f.cat] = true
	f.repo.catDef[f.cat] = PriorityLow
	f.repo.symptoms[f.sym1] = f.cat
	f.repo.symPrio[f.sym1] = PriorityMedium
	f.repo.symptoms[f.sym2] = f.cat
	f.repo.symPrio[f.sym2] = PriorityHigh
	f.repo.floors[f.floor] = f.building
	f.repo.rooms[f.room] = f.floor
	f.repo.cats[f.other], f.repo.catOther[f.other] = true, true
	f.repo.catDef[f.other] = PriorityMedium
	f.repo.symptoms[f.otherSym] = f.other
	f.repo.symPrio[f.otherSym] = PriorityCritical
	f.svc = NewService(f.repo, f.store)
	f.svc.now = func() time.Time { return f.now }
	return f
}

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(1, 1, color.RGBA{R: 200, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func (f *fixture) upload(t *testing.T, v Viewer) uuid.UUID {
	t.Helper()
	id, err := f.svc.UploadPhoto(context.Background(), v, pngBytes(t, 64, 48))
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	f.repo.photoAt[id] = f.now // the fake stamps uploads with the test clock
	return id
}

func (f *fixture) input(photos ...uuid.UUID) CreateTicketInput {
	return CreateTicketInput{
		CategoryID: &f.cat, SymptomIDs: []uuid.UUID{f.sym1, f.sym2}, BuildingID: &f.building, FloorID: &f.floor,
		RoomID: &f.room, LocationDetail: " ฝั่งหน้าต่าง ", Details: "น้ำหยดใส่โต๊ะประชุม", PhotoIDs: photos,
	}
}

func (f *fixture) create(t *testing.T) TicketDetail {
	t.Helper()
	d, err := f.svc.CreateTicket(context.Background(), f.reporter, f.input(f.upload(t, f.reporter)))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return d
}

func code(err error) string {
	if e, ok := apperr.As(err); ok {
		return e.Code
	}
	return ""
}

// ---- BR-F02-1: required fields and limits ----

func TestValidateCreate(t *testing.T) {
	f := newFixture(t)
	p := uuid.New()
	full := f.input(p)

	cases := []struct {
		name  string
		edit  func(*CreateTicketInput)
		field string
		code  string
	}{
		{"category", func(in *CreateTicketInput) { in.CategoryID = nil }, "categoryId", "REQUIRED"},
		{"symptoms", func(in *CreateTicketInput) { in.SymptomIDs = nil }, "symptomIds", "MIN_ITEMS"},
		{"building", func(in *CreateTicketInput) { in.BuildingID = nil }, "buildingId", "REQUIRED"},
		{"floor", func(in *CreateTicketInput) { in.FloorID = nil }, "floorId", "REQUIRED"},
		{"room (CR-014)", func(in *CreateTicketInput) { in.RoomID = nil }, "roomId", "REQUIRED"},
		{"typed category alone (CR-014)", func(in *CreateTicketInput) { in.CategoryID, in.CategoryOther = nil, "ลิฟต์" }, "categoryId", "REQUIRED"},
		{"category other too long", func(in *CreateTicketInput) { in.CategoryOther = strings.Repeat("ก", 101) }, "categoryOther", "TOO_LONG"},
		{"symptom other too long", func(in *CreateTicketInput) { in.SymptomOther = strings.Repeat("ก", 101) }, "symptomOther", "TOO_LONG"},
		{"no photo", func(in *CreateTicketInput) { in.PhotoIDs = nil }, "photoIds", "MIN_ITEMS"},
		{"six photos", func(in *CreateTicketInput) {
			in.PhotoIDs = []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()}
		}, "photoIds", "MAX_ITEMS"},
		{"location", func(in *CreateTicketInput) { in.LocationDetail = strings.Repeat("ก", 101) }, "locationDetail", "TOO_LONG"},
		{"details", func(in *CreateTicketInput) { in.Details = strings.Repeat("ก", 501) }, "details", "TOO_LONG"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := full
			tc.edit(&in)
			_, fields := validateCreate(in)
			if fields[tc.field] != tc.code || len(fields) != 1 {
				t.Fatalf("fields = %v, want only %s=%s", fields, tc.field, tc.code)
			}
		})
	}

	in := full
	in.LocationDetail = strings.Repeat("ก", 100) // Thai counts in characters, not bytes
	in.Details = strings.Repeat("ก", 500)
	in.PhotoIDs = []uuid.UUID{p, p, p, p, p, p} // duplicates collapse to one
	out, fields := validateCreate(in)
	if len(fields) != 0 || len(out.PhotoIDs) != 1 {
		t.Fatalf("limits: fields=%v photos=%d", fields, len(out.PhotoIDs))
	}

	_, err := f.svc.CreateTicket(context.Background(), f.reporter, CreateTicketInput{})
	// categoryId, symptomIds, buildingId, floorId, roomId, photoIds
	if e, ok := apperr.As(err); !ok || e.Code != "VALIDATION_FAILED" || len(e.Fields) != 6 {
		t.Fatalf("empty form: %v", err)
	}

	// CR-008: a typed symptom is enough.
	in = full
	in.SymptomIDs, in.SymptomOther = nil, " มีควัน "
	if out, fields = validateCreate(in); len(fields) != 0 || out.SymptomOther != "มีควัน" {
		t.Fatalf("typed symptom only: %v %q", fields, out.SymptomOther)
	}
	// CR-014: the typed category name is trimmed and kept; the service checks the category allows it.
	in = full
	in.CategoryOther = " ลิฟต์ "
	if out, fields = validateCreate(in); len(fields) != 0 || out.CategoryOther != "ลิฟต์" || len(out.SymptomIDs) != 2 {
		t.Fatalf("typed category name: %v %q", fields, out.CategoryOther)
	}
}

// ---- BR-F02-2 (CR-008): the system sets the priority ----

func TestTicketPriority(t *testing.T) {
	cases := []struct {
		name         string
		syms         []string
		def          string
		want, source string
	}{
		{"most urgent symptom", []string{PriorityLow, PriorityCritical, PriorityMedium}, PriorityLow, PriorityCritical, PrioritySourceSymptom},
		{"one symptom", []string{PriorityHigh}, PriorityLow, PriorityHigh, PrioritySourceSymptom},
		{"typed symptom only", nil, PriorityHigh, PriorityHigh, PrioritySourceCategory},
		{"no category default", nil, "", PriorityMedium, PrioritySourceDefault},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p, src := ticketPriority(tc.syms, tc.def)
			if p != tc.want || src != tc.source {
				t.Fatalf("got %s/%s, want %s/%s", p, src, tc.want, tc.source)
			}
		})
	}
}

func TestCreateTicketSetsPriority(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	d := f.create(t) // sym1 medium + sym2 high
	if d.Priority != PriorityHigh || d.PrioritySource != PrioritySourceSymptom {
		t.Fatalf("symptoms: %s/%s", d.Priority, d.PrioritySource)
	}

	in := f.input(f.upload(t, f.reporter))
	in.SymptomIDs, in.SymptomOther = nil, "มีควัน"
	d, err := f.svc.CreateTicket(ctx, f.reporter, in)
	if err != nil || d.Priority != PriorityLow || d.PrioritySource != PrioritySourceCategory || *d.SymptomOther != "มีควัน" {
		t.Fatalf("typed symptom: %s/%s err=%v", d.Priority, d.PrioritySource, err)
	}

	// CR-014 AC2: "อื่น ๆ" + typed name + typed symptom → category อื่น ๆ with the name as its value.
	in = f.input(f.upload(t, f.reporter))
	in.CategoryID, in.SymptomIDs, in.CategoryOther = &f.other, nil, "ลิฟต์"
	in.SymptomOther = "ค้างระหว่างชั้น"
	d, err = f.svc.CreateTicket(ctx, f.reporter, in)
	if err != nil || d.Category == nil || d.Category.ID != f.other || *d.CategoryOther != "ลิฟต์" ||
		d.Priority != PriorityMedium || d.PrioritySource != PrioritySourceCategory {
		t.Fatalf("อื่น ๆ with typed name: %+v err=%v", d.TicketSummary, err)
	}
	in = f.input(f.upload(t, f.reporter))
	in.CategoryID, in.SymptomIDs = &f.other, []uuid.UUID{f.otherSym}
	d, err = f.svc.CreateTicket(ctx, f.reporter, in)
	if err != nil || d.Priority != PriorityCritical || d.PrioritySource != PrioritySourceSymptom || d.CategoryOther != nil {
		t.Fatalf("อื่น ๆ with a critical symptom: %+v err=%v", d.TicketSummary, err)
	}
}

// BR-F02-1 / BR-F02-7 (CR-014): the room and the typed category name are checked in the transaction.
func TestCreateTicketRoomAndOtherRules(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		name  string
		edit  func(f *fixture, in *CreateTicketInput)
		code  string
		field string
	}{
		{"room of another floor", func(f *fixture, in *CreateTicketInput) {
			otherFloor := uuid.New()
			f.repo.floors[otherFloor] = f.building
			r := uuid.New()
			f.repo.rooms[r] = otherFloor
			in.RoomID = &r
		}, "MASTER_DATA_CHANGED", ""},
		{"inactive or unknown room", func(_ *fixture, in *CreateTicketInput) {
			r := uuid.New()
			in.RoomID = &r
		}, "MASTER_DATA_CHANGED", ""},
		{"typed name on a normal category", func(_ *fixture, in *CreateTicketInput) { in.CategoryOther = "ลิฟต์" }, "VALIDATION_FAILED", "categoryOther"},
		{"symptom of another category", func(f *fixture, in *CreateTicketInput) { in.SymptomIDs = []uuid.UUID{f.otherSym} }, "MASTER_DATA_CHANGED", ""},
		{"inactive category", func(f *fixture, _ *CreateTicketInput) { f.repo.cats[f.cat] = false }, "MASTER_DATA_CHANGED", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			in := f.input(f.upload(t, f.reporter))
			tc.edit(f, &in)
			_, err := f.svc.CreateTicket(ctx, f.reporter, in)
			e, ok := apperr.As(err)
			if !ok || e.Code != tc.code || (tc.field != "" && e.Fields[tc.field] != "NOT_ALLOWED") {
				t.Fatalf("err = %v, want %s %s", err, tc.code, tc.field)
			}
			if len(f.repo.inserted) != 0 || len(f.repo.counters) != 0 {
				t.Fatal("a rejected ticket was inserted or used a number")
			}
		})
	}

	f := newFixture(t)
	d := f.create(t)
	if ins := f.repo.inserted[0]; ins.RoomID != f.room || *ins.LocationDetail != "ฝั่งหน้าต่าง" || d.Room == nil {
		t.Fatalf("room / extra spot not stored: %+v", ins)
	}
}

func TestRecentPlaces(t *testing.T) {
	f := newFixture(t)
	f.repo.recent = []RecentPlace{{Building: Ref{ID: f.building}, Floor: Ref{ID: f.floor}}}
	got, err := f.svc.RecentPlaces(context.Background(), f.reporter)
	if err != nil || len(got) != 1 || got[0].Floor.ID != f.floor {
		t.Fatalf("recent places: %v %v", got, err)
	}
}

// ---- BR-F02-4 / BR-F02-5: ticket number ----

func TestFormatTicketNo(t *testing.T) {
	cases := []struct {
		f    TicketNumberFormat
		n    int64
		want string
	}{
		{TicketNumberFormat{"RP", "be", 6}, 1, "RP-2569-000001"},
		{TicketNumberFormat{"RP", "be", 6}, 142, "RP-2569-000142"},
		{TicketNumberFormat{"RP", "ce", 6}, 142, "RP-2026-000142"},
		{TicketNumberFormat{"FX", "be", 4}, 7, "FX-2569-0007"},
		{TicketNumberFormat{"", "be", 6}, 7, "2569-000007"},
		{TicketNumberFormat{"RP", "be", 3}, 1234, "RP-2569-1234"}, // never truncated
	}
	for _, tc := range cases {
		got, err := FormatTicketNo(tc.f, 2026, tc.n)
		if err != nil || got != tc.want {
			t.Errorf("FormatTicketNo(%+v, %d) = %q, %v; want %q", tc.f, tc.n, got, err, tc.want)
		}
	}
	if _, err := FormatTicketNo(TicketNumberFormat{"RP", "xx", 6}, 2026, 1); err == nil {
		t.Error("unknown year format accepted")
	}
}

func TestTicketYearUsesBangkok(t *testing.T) {
	// 31 Dec 2026 17:00 UTC is 1 Jan 2027 00:00 in Bangkok.
	if y := ticketYear(time.Date(2026, 12, 31, 17, 0, 0, 0, time.UTC)); y != 2027 {
		t.Fatalf("year = %d, want 2027", y)
	}
	if y := ticketYear(time.Date(2026, 12, 31, 16, 59, 0, 0, time.UTC)); y != 2026 {
		t.Fatalf("year = %d, want 2026", y)
	}
}

func TestCreateTicketNumbersRestartEachYear(t *testing.T) {
	f := newFixture(t)
	if no := f.create(t).TicketNo; no != "RP-2569-000001" {
		t.Fatalf("first = %s", no)
	}
	if no := f.create(t).TicketNo; no != "RP-2569-000002" {
		t.Fatalf("second = %s", no)
	}
	f.now = time.Date(2026, 12, 31, 17, 30, 0, 0, time.UTC) // new year in Bangkok
	if no := f.create(t).TicketNo; no != "RP-2570-000001" {
		t.Fatalf("new year = %s", no)
	}
}

func TestPrefixChangeAffectsNewTicketsOnly(t *testing.T) {
	f := newFixture(t)
	first := f.create(t)
	f.repo.format.Prefix = "FX"
	second := f.create(t)
	if second.TicketNo != "FX-2569-000002" {
		t.Fatalf("after change = %s", second.TicketNo)
	}
	again, err := f.svc.Ticket(context.Background(), f.reporter, first.ID)
	if err != nil || again.TicketNo != "RP-2569-000001" {
		t.Fatalf("old number changed: %s %v", again.TicketNo, err)
	}
}

// ---- create: master data, photos, team handled ----

func TestCreateTicketRejectsChangedMasterData(t *testing.T) {
	f := newFixture(t)
	other := uuid.New()
	cases := map[string]func(*CreateTicketInput){
		"inactive category":         func(in *CreateTicketInput) { f.repo.cats[f.cat] = false },
		"symptom of other category": func(in *CreateTicketInput) { in.SymptomIDs = []uuid.UUID{f.sym1, other} },
		"floor of other building":   func(in *CreateTicketInput) { in.BuildingID = &other },
	}
	for name, edit := range cases {
		t.Run(name, func(t *testing.T) {
			f.repo.cats[f.cat] = true
			in := f.input(f.upload(t, f.reporter))
			edit(&in)
			_, err := f.svc.CreateTicket(context.Background(), f.reporter, in)
			if code(err) != "MASTER_DATA_CHANGED" {
				t.Fatalf("err = %v", err)
			}
		})
	}
	if len(f.repo.inserted) != 0 || len(f.repo.counters) != 0 {
		t.Fatal("failed creates must not insert or use a ticket number")
	}
}

func TestCreateTicketRejectsPhotosNotAttachable(t *testing.T) {
	f := newFixture(t)
	someoneElse := Viewer{ID: uuid.New(), Role: users.RoleEmployee}
	cases := map[string]func() uuid.UUID{
		"unknown":      func() uuid.UUID { return uuid.New() },
		"other user's": func() uuid.UUID { return f.upload(t, someoneElse) },
		"expired (24h)": func() uuid.UUID {
			id := f.upload(t, f.reporter)
			f.repo.photoAt[id] = f.now.Add(-25 * time.Hour)
			return id
		},
		"already used": func() uuid.UUID {
			id := f.upload(t, f.reporter)
			if _, err := f.svc.CreateTicket(context.Background(), f.reporter, f.input(id)); err != nil {
				t.Fatal(err)
			}
			return id
		},
	}
	for name, photo := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := f.svc.CreateTicket(context.Background(), f.reporter, f.input(photo()))
			if e, ok := apperr.As(err); !ok || e.Code != "PHOTO_NOT_FOUND" || e.Kind != apperr.KindBusinessRule {
				t.Fatalf("err = %v, want 422 PHOTO_NOT_FOUND", err)
			}
		})
	}
}

func TestCreateTicketTeamHandledNotInStage1(t *testing.T) {
	f := newFixture(t)
	in := f.input(f.upload(t, f.reporter))
	in.TeamHandled = true
	_, err := f.svc.CreateTicket(context.Background(), Viewer{ID: f.reporter.ID, Role: users.RoleHousekeeperLead}, in)
	if code(err) != "TEAM_HANDLED_NOT_ALLOWED" {
		t.Fatalf("err = %v", err)
	}
}

func TestCreateTicketResult(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	ins := f.repo.inserted[0]
	if d.Status != StatusInProgress || d.Step() != StepAwaitingAssessment || d.ViewerRelation != RelationReporter || d.Timeline[0].Type != EventCreated {
		t.Fatalf("detail: status=%s relation=%s timeline=%v", d.Status, d.ViewerRelation, d.Timeline)
	}
	if *ins.LocationDetail != "ฝั่งหน้าต่าง" || ins.AssetCode != nil {
		t.Fatalf("normalised input: location=%q asset=%v", *ins.LocationDetail, ins.AssetCode)
	}
	if len(d.AllowedActions) != 0 || d.BlockedActions == nil {
		t.Fatalf("reporter actions while in progress: %v %v", d.AllowedActions, d.BlockedActions)
	}
}

// ---- BR-F06-1: visibility ----

func TestTicketVisibilityMatrix(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	subscriber := uuid.New()
	f.repo.subs[d.ID] = map[uuid.UUID]bool{subscriber: true}
	holder := uuid.New()
	f.repo.tickets[d.ID].Technician = &Person{ID: holder}

	cases := []struct {
		name     string
		v        Viewer
		visible  bool
		relation string
	}{
		{"reporter", f.reporter, true, RelationReporter},
		{"subscriber", Viewer{ID: subscriber, Role: users.RoleEmployee}, true, RelationSubscriber},
		{"holder technician", Viewer{ID: holder, Role: users.RoleTechnician}, true, RelationTechnician},
		{"admin", Viewer{ID: uuid.New(), Role: users.RoleAdmin}, true, RelationNone},
		{"executive", Viewer{ID: uuid.New(), Role: users.RoleExecutive}, true, RelationNone},
		{"other employee", Viewer{ID: uuid.New(), Role: users.RoleEmployee}, false, ""},
		{"housekeeper lead", Viewer{ID: uuid.New(), Role: users.RoleHousekeeperLead}, false, ""},
		{"security lead", Viewer{ID: uuid.New(), Role: users.RoleSecurityLead}, false, ""},
		{"any technician (CR-005)", Viewer{ID: uuid.New(), Role: users.RoleTechnician}, true, RelationTechnician},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := f.svc.Ticket(context.Background(), tc.v, d.ID)
			if !tc.visible {
				if !errors.Is(err, apperr.ErrForbidden) {
					t.Fatalf("err = %v, want FORBIDDEN", err)
				}
				return
			}
			if err != nil || got.ViewerRelation != tc.relation {
				t.Fatalf("relation = %q err = %v, want %q", got.ViewerRelation, err, tc.relation)
			}
		})
	}

	if _, err := f.svc.Ticket(context.Background(), f.reporter, uuid.New()); code(err) != "TICKET_NOT_FOUND" {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestTicketHidesContractorFromReporter(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	stored := f.repo.tickets[d.ID]
	stored.Contractor = &Ref{ID: uuid.New(), Name: "ช่างแอร์ ก."}
	score := int16(4)
	stored.Result = &TicketResult{Note: "ล้างแอร์", ContractorRating: &score}

	mine, _ := f.svc.Ticket(context.Background(), f.reporter, d.ID)
	if mine.Contractor != nil || mine.Result.ContractorRating != nil {
		t.Fatalf("reporter sees contractor=%v rating=%v (BR-F24-4)", mine.Contractor, mine.Result.ContractorRating)
	}
	admin, _ := f.svc.Ticket(context.Background(), Viewer{ID: uuid.New(), Role: users.RoleAdmin}, d.ID)
	if admin.Contractor == nil || admin.Result.ContractorRating == nil {
		t.Fatal("admin must see the contractor and its rating")
	}
}

func TestListScopeAndDecoration(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	f.repo.tickets[d.ID].Status = StatusResolved

	for _, role := range []string{users.RoleEmployee, users.RoleHousekeeperLead, users.RoleSecurityLead} {
		_, _, err := f.svc.Tickets(context.Background(), Viewer{ID: uuid.New(), Role: role}, TicketFilter{ScopeAll: true})
		if !errors.Is(err, apperr.ErrForbidden) {
			t.Fatalf("%s scope=all: %v", role, err)
		}
		if _, err := f.svc.TicketCounts(context.Background(), Viewer{ID: uuid.New(), Role: role}, TicketFilter{ScopeAll: true}); !errors.Is(err, apperr.ErrForbidden) {
			t.Fatalf("%s counts scope=all: %v", role, err)
		}
	}
	for _, role := range []string{users.RoleAdmin, users.RoleExecutive, users.RoleTechnician} {
		if _, _, err := f.svc.Tickets(context.Background(), Viewer{ID: uuid.New(), Role: role}, TicketFilter{ScopeAll: true}); err != nil {
			t.Fatalf("%s scope=all: %v", role, err)
		}
	}

	list, total, err := f.svc.Tickets(context.Background(), f.reporter, TicketFilter{})
	if err != nil || total != 1 {
		t.Fatalf("mine: total=%d err=%v", total, err)
	}
	if !list[0].AwaitingMyConfirmation || list[0].ViewerRelation != RelationReporter {
		t.Fatalf("decoration: %+v", list[0])
	}
}

// ---- photos (D-022) ----

func TestUploadPhoto(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	if _, err := f.svc.UploadPhoto(ctx, f.reporter, []byte("%PDF-1.7 not an image")); code(err) != "PHOTO_TYPE_NOT_ALLOWED" {
		t.Fatalf("pdf: %v", err)
	}
	if _, err := f.svc.UploadPhoto(ctx, f.reporter, make([]byte, MaxPhotoBytes+1)); code(err) != "PHOTO_TOO_LARGE" {
		t.Fatalf("too large: %v", err)
	}

	id, err := f.svc.UploadPhoto(ctx, f.reporter, pngBytes(t, 1920, 1080))
	if err != nil {
		t.Fatal(err)
	}
	p := f.repo.photos[id]
	if p.ContentType != "image/png" || p.ThumbContentType != "image/jpeg" || p.ThumbKey == p.StorageKey {
		t.Fatalf("photo row: %+v", p)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(f.store.files[p.ThumbKey]))
	if err != nil || cfg.Width != thumbLongEdge || cfg.Height != 270 {
		t.Fatalf("thumbnail %dx%d err=%v", cfg.Width, cfg.Height, err)
	}

	heic := append([]byte{0, 0, 0, 24}, []byte("ftypheic0000mif1heic")...)
	hid, err := f.svc.UploadPhoto(ctx, f.reporter, heic)
	if err != nil || f.repo.photos[hid].ThumbKey != f.repo.photos[hid].StorageKey {
		t.Fatalf("heic: %v", err)
	}
}

func TestOpenPhotoPermissions(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	other := Viewer{ID: uuid.New(), Role: users.RoleEmployee}

	loose := f.upload(t, f.reporter)
	if _, _, err := f.svc.OpenPhoto(ctx, other, loose, true); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("unattached photo by other user: %v", err)
	}
	rc, ct, err := f.svc.OpenPhoto(ctx, f.reporter, loose, true)
	if err != nil || ct != "image/jpeg" {
		t.Fatalf("uploader thumb: ct=%s err=%v", ct, err)
	}
	_ = rc.Close()

	d := f.create(t)
	attached := d.Photos[0]
	if _, _, err := f.svc.OpenPhoto(ctx, other, attached, false); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("attached photo by unrelated user: %v", err)
	}
	if _, _, err := f.svc.OpenPhoto(ctx, Viewer{ID: uuid.New(), Role: users.RoleAdmin}, attached, false); err != nil {
		t.Fatalf("admin: %v", err)
	}
	if _, _, err := f.svc.OpenPhoto(ctx, f.reporter, uuid.New(), false); code(err) != "PHOTO_NOT_FOUND" {
		t.Fatalf("unknown: %v", err)
	}
}

func TestPurgeUnattachedPhotos(t *testing.T) {
	f := newFixture(t)
	old := f.upload(t, f.reporter)
	f.repo.photoAt[old] = f.now.Add(-25 * time.Hour)
	fresh := f.upload(t, f.reporter)
	f.repo.photoAt[fresh] = f.now.Add(-time.Hour)
	used := f.create(t).Photos[0]
	f.repo.photoAt[used] = f.now.Add(-48 * time.Hour)

	n, err := f.svc.PurgeUnattachedPhotos(context.Background())
	if err != nil || n != 2 { // storage + thumb key of one photo
		t.Fatalf("purged %d keys, err=%v", n, err)
	}
	if _, ok := f.repo.photos[old]; ok {
		t.Fatal("old unattached photo kept")
	}
	if _, ok := f.repo.photos[fresh]; !ok {
		t.Fatal("fresh photo purged")
	}
	if _, ok := f.repo.photos[used]; !ok {
		t.Fatal("attached photo purged")
	}
}

func TestAdminClose(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	admin := Viewer{ID: uuid.New(), Role: users.RoleAdmin}
	ctx := context.Background()

	for _, role := range []string{users.RoleExecutive, users.RoleTechnician, users.RoleEmployee, users.RoleHousekeeperLead} {
		if _, err := f.svc.Close(ctx, Viewer{ID: uuid.New(), Role: role}, d.ID, "ปิด"); !errors.Is(err, apperr.ErrForbidden) {
			t.Fatalf("%s close: %v, want FORBIDDEN", role, err)
		}
	}
	if _, err := f.svc.Close(ctx, admin, d.ID, "   "); code(err) != "VALIDATION_FAILED" {
		t.Fatalf("blank reason: %v", err)
	}
	if _, err := f.svc.Close(ctx, admin, d.ID, strings.Repeat("ก", MaxNoteChars+1)); code(err) != "VALIDATION_FAILED" {
		t.Fatalf("long reason: %v", err)
	}
	if _, err := f.svc.Close(ctx, admin, uuid.New(), "ปิด"); code(err) != "TICKET_NOT_FOUND" {
		t.Fatalf("unknown ticket: %v", err)
	}

	before, _ := f.svc.Ticket(ctx, admin, d.ID)
	if !contains(before.AllowedActions, ActionClose) {
		t.Fatalf("admin actions on an open ticket: %v", before.AllowedActions)
	}
	got, err := f.svc.Close(ctx, admin, d.ID, "  ส่งเรื่องเปลี่ยนเครื่องใหม่แล้ว  ")
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if got.Status != StatusClosed || got.ClosedReason == nil || *got.ClosedReason != "admin_closed" || contains(got.AllowedActions, ActionClose) {
		t.Fatalf("after close: status=%s reason=%v actions=%v", got.Status, got.ClosedReason, got.AllowedActions)
	}
	last := f.repo.events[len(f.repo.events)-1]
	if last.Type != EventAdminClosed || last.Note == nil || *last.Note != "ส่งเรื่องเปลี่ยนเครื่องใหม่แล้ว" || *last.ActorID != admin.ID {
		t.Fatalf("event: %+v", last)
	}
	if _, err := f.svc.Close(ctx, admin, d.ID, "อีกครั้ง"); code(err) != "TICKET_CLOSED" {
		t.Fatalf("close twice: %v", err)
	}
}

// Every status that is not closed can be closed by admin (BR-F08B-1).
func TestAdminCloseFromAnyOpenStatus(t *testing.T) {
	for _, status := range []string{StatusInProgress, StatusResolved} {
		f := newFixture(t)
		d := f.create(t)
		f.repo.tickets[d.ID].Status = status
		if _, err := f.svc.Close(context.Background(), Viewer{ID: uuid.New(), Role: users.RoleAdmin}, d.ID, "ปิด"); err != nil {
			t.Fatalf("%s: %v", status, err)
		}
	}
}

// BR-F22-6: the executive sees every ticket but gets no actions.
func TestExecutiveHasNoActions(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	for _, status := range []string{StatusInProgress, StatusResolved, StatusClosed} {
		f.repo.tickets[d.ID].Status = status
		got, err := f.svc.Ticket(context.Background(), Viewer{ID: uuid.New(), Role: users.RoleExecutive}, d.ID)
		if err != nil || len(got.AllowedActions) != 0 {
			t.Fatalf("%s: actions=%v err=%v", status, got.AllowedActions, err)
		}
	}
}
