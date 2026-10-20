package repair

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// ---- CR-016 fakes ----

type fakeAsset struct {
	LockedAsset
}

type auditRow struct {
	actor  uuid.UUID
	action string
	id     uuid.UUID
	data   map[string]map[string]any
}

type dashFake struct {
	types      map[uuid.UUID]AssetType // active types
	rooms      map[uuid.UUID]PlacementRoom
	shapes     map[uuid.UUID][]RoomShape // floor → active rooms with outlines
	floorNames map[uuid.UUID]string
	assets     map[uuid.UUID]*fakeAsset
	audit      []auditRow
	// #27 inputs and what the service passed in
	counts                    OverviewCounts
	attention                 []uuid.UUID
	gotToday, gotDay, gotWeek time.Time
	gotLimit                  int
}

func newDashFake() *dashFake {
	return &dashFake{types: map[uuid.UUID]AssetType{}, rooms: map[uuid.UUID]PlacementRoom{},
		shapes: map[uuid.UUID][]RoomShape{}, floorNames: map[uuid.UUID]string{}, assets: map[uuid.UUID]*fakeAsset{}}
}

func (f *fakeRepo) OverviewCounts(_ context.Context, today, dayStart, weekStart time.Time) (OverviewCounts, error) {
	f.dash.gotToday, f.dash.gotDay, f.dash.gotWeek = today, dayStart, weekStart
	return f.dash.counts, nil
}
func (f *fakeRepo) OverviewBuildings(context.Context) ([]OverviewBuilding, error) { return nil, nil }
func (f *fakeRepo) AttentionTicketIDs(_ context.Context, _ time.Time, limit int) ([]uuid.UUID, error) {
	f.dash.gotLimit = limit
	return f.dash.attention, nil
}
func (f *fakeRepo) ListAssetTypes(context.Context) ([]AssetType, error) { return nil, nil }
func (f *fakeRepo) GetFloorPlan(_ context.Context, floorID uuid.UUID) (FloorPlan, error) {
	if _, ok := f.dash.floorNames[floorID]; !ok {
		return FloorPlan{}, ErrFloorNotFound
	}
	return FloorPlan{Floor: Floor{ID: floorID}}, nil
}
func (f *fakeRepo) GetAsset(_ context.Context, id uuid.UUID) (Asset, error) {
	a, ok := f.dash.assets[id]
	if !ok || !a.IsActive {
		return Asset{}, ErrAssetNotFound
	}
	return Asset{ID: a.ID, Code: a.Code, Name: a.Name, Room: Ref{ID: a.RoomID}, X: a.X, Z: a.Z, RotationDeg: a.RotationDeg}, nil
}
func (f *fakeRepo) ActiveFloorName(_ context.Context, id uuid.UUID) (string, error) {
	n, ok := f.dash.floorNames[id]
	if !ok {
		return "", ErrFloorNotFound
	}
	return n, nil
}
func (f *fakeRepo) ActiveAssetType(_ context.Context, id uuid.UUID) (AssetType, bool, error) {
	t, ok := f.dash.types[id]
	return t, ok, nil
}
func (f *fakeRepo) AssetCodesWithPrefix(_ context.Context, prefix string) ([]string, error) {
	var out []string
	for _, a := range f.dash.assets {
		if strings.HasPrefix(strings.ToLower(a.Code), strings.ToLower(prefix)) {
			out = append(out, a.Code)
		}
	}
	return out, nil
}
func (f *fakeRepo) PlacementRoom(_ context.Context, id uuid.UUID) (PlacementRoom, bool, error) {
	r, ok := f.dash.rooms[id]
	return r, ok, nil
}
func (f *fakeRepo) RoomShapesOnFloor(_ context.Context, floorID uuid.UUID) ([]RoomShape, error) {
	return f.dash.shapes[floorID], nil
}
func (f *fakeRepo) AssetCodeTaken(_ context.Context, code string, exclude uuid.UUID) (bool, error) {
	for id, a := range f.dash.assets {
		if id != exclude && strings.EqualFold(a.Code, code) {
			return true, nil
		}
	}
	return false, nil
}
func (f *fakeRepo) LockAsset(_ context.Context, id uuid.UUID) (LockedAsset, error) {
	a, ok := f.dash.assets[id]
	if !ok {
		return LockedAsset{}, ErrAssetNotFound
	}
	return a.LockedAsset, nil
}
func (f *fakeRepo) InsertAsset(_ context.Context, id uuid.UUID, in AssetInput, _ uuid.UUID) error {
	f.dash.assets[id] = &fakeAsset{LockedAsset: lockedFrom(id, in, int(rotation(in)), true)}
	return nil
}
func (f *fakeRepo) UpdateAsset(_ context.Context, id uuid.UUID, in AssetInput, _ uuid.UUID) error {
	a := f.dash.assets[id]
	a.Code, a.Name, a.RoomID, a.X, a.Z, a.RotationDeg = in.Code, in.Name, in.RoomID, in.X, in.Z, rotation(in)
	return nil
}
func (f *fakeRepo) DeactivateAsset(_ context.Context, id, _ uuid.UUID) error {
	f.dash.assets[id].IsActive = false
	return nil
}
func (f *fakeRepo) InsertAudit(_ context.Context, actor uuid.UUID, action string, id uuid.UUID, data []byte) error {
	row := auditRow{actor: actor, action: action, id: id}
	if err := json.Unmarshal(data, &row.data); err != nil {
		return err
	}
	f.dash.audit = append(f.dash.audit, row)
	return nil
}

// ---- อาคาร 1 ชั้น 1 (the migration's outlines) ----

func rect(x0, z0, x1, z1 float64) Shape {
	return Shape{{x0, z0}, {x1, z0}, {x1, z1}, {x0, z1}}
}

type floorOne struct {
	floor, dd, hr3, wc, common uuid.UUID
	shapes                     []RoomShape
}

func newFloorOne() floorOne {
	f := floorOne{floor: uuid.New(), dd: uuid.New(), hr3: uuid.New(), wc: uuid.New(), common: uuid.New()}
	f.shapes = []RoomShape{
		{ID: f.dd, Shape: rect(0, 0, 12, 6)},
		{ID: f.hr3, Shape: rect(24, 9, 32, 15)},
		{ID: f.wc, Shape: rect(12, 0, 16, 6)},
		{ID: f.common, Shape: Shape{{12, 0}, {24, 0}, {24, 4.35}, {28, 4.35}, {28, 5.2}, {32, 5.2}, {32, 9}, {24, 9},
			{24, 15}, {12, 15}, {12, 9}, {4, 9}, {4, 6}, {12, 6}}},
	}
	return f
}

type assetFixture struct {
	*fixture
	plan    floorOne
	aircon  uuid.UUID
	admin   Viewer
	exec    Viewer
	noPlan  uuid.UUID // a room on a floor without a plan
	offRoom uuid.UUID // an inactive room
}

func newAssetFixture(t *testing.T) *assetFixture {
	t.Helper()
	a := &assetFixture{fixture: newFixture(t), plan: newFloorOne(), aircon: uuid.New(), noPlan: uuid.New(), offRoom: uuid.New(),
		admin: Viewer{ID: uuid.New(), Role: users.RoleAdmin}, exec: Viewer{ID: uuid.New(), Role: users.RoleExecutive}}
	d := a.repo.dash
	d.types[a.aircon] = AssetType{ID: a.aircon, Key: "aircon", CodePrefix: "AC"}
	d.floorNames[a.plan.floor] = "1"
	d.shapes[a.plan.floor] = a.plan.shapes
	for _, rs := range a.plan.shapes {
		d.rooms[rs.ID] = PlacementRoom{ID: rs.ID, FloorID: a.plan.floor, Shape: rs.Shape, HasPlan: true, WidthM: 32, DepthM: 15}
	}
	d.rooms[a.noPlan] = PlacementRoom{ID: a.noPlan, FloorID: uuid.New()}
	return a
}

func pt(v float64) *float64 { return &v }

func (a *assetFixture) input(code string, room uuid.UUID, x, z float64) AssetInput {
	return AssetInput{AssetTypeID: a.aircon, Code: code, Name: "แอร์ห้อง HR", RoomID: room, X: pt(x), Z: pt(z)}
}

// ---- rules ----

func TestRoomAtPicksSmallestRoom(t *testing.T) {
	f := newFloorOne()
	cases := []struct {
		name string
		x, z float64
		want uuid.UUID
		ok   bool
	}{
		{"inside a room", 6, 3, f.dd, true},
		{"ห้องน้ำ inside the common area", 13, 3, f.wc, true},
		{"corridor", 18, 7.5, f.common, true},
		{"common area notch next to HR", 26, 7, f.common, true},
		{"on a room edge", 12, 3, f.wc, true},
		{"room corner", 32, 15, f.hr3, true},
		{"room not traced (HR 1)", 25, 2, uuid.Nil, false},
		{"outside the floor", 33, 5, uuid.Nil, false},
	}
	for _, c := range cases {
		got, ok := roomAt(c.x, c.z, f.shapes)
		if got != c.want || ok != c.ok {
			t.Errorf("%s: roomAt(%v, %v) = %v %v, want %v %v", c.name, c.x, c.z, got, ok, c.want, c.ok)
		}
	}
	if a := shapeArea(f.shapes[3].Shape); a < 237.79 || a > 237.81 {
		t.Errorf("common area = %v m², want 237.80 (PDF)", a)
	}
}

func TestValidateAsset(t *testing.T) {
	room := uuid.New()
	ok := AssetInput{Code: " AC-1_01 ", Name: "  แอร์   ห้อง HR ", RoomID: room}
	in, fields := validateAsset(ok)
	if len(fields) != 0 || in.Code != "AC-1_01" || in.Name != "แอร์ ห้อง HR" {
		t.Fatalf("valid input: %v %+v", fields, in)
	}
	rot := 360
	cases := []struct {
		name  string
		in    AssetInput
		field string
		code  string
	}{
		{"code required", AssetInput{Name: "x", RoomID: room}, "code", "REQUIRED"},
		{"code too long", AssetInput{Code: strings.Repeat("A", 51), Name: "x", RoomID: room}, "code", "TOO_LONG"},
		{"code with a space", AssetInput{Code: "AC 1", Name: "x", RoomID: room}, "code", "INVALID"},
		{"code in Thai", AssetInput{Code: "แอร์1", Name: "x", RoomID: room}, "code", "INVALID"},
		{"name required", AssetInput{Code: "A", Name: "  ", RoomID: room}, "name", "REQUIRED"},
		{"name too long (runes)", AssetInput{Code: "A", Name: strings.Repeat("แ", 101), RoomID: room}, "name", "TOO_LONG"},
		{"room required", AssetInput{Code: "A", Name: "x"}, "roomId", "REQUIRED"},
		{"x without z", AssetInput{Code: "A", Name: "x", RoomID: room, X: pt(1)}, "z", "REQUIRED"},
		{"rotation out of range", AssetInput{Code: "A", Name: "x", RoomID: room, RotationDeg: &rot}, "rotationDeg", "INVALID"},
	}
	for _, c := range cases {
		if _, fields := validateAsset(c.in); fields[c.field] != c.code {
			t.Errorf("%s: fields = %v, want %s=%s", c.name, fields, c.field, c.code)
		}
	}
	if _, fields := validateAsset(AssetInput{Code: strings.Repeat("A", 50), Name: strings.Repeat("แ", 100), RoomID: room}); len(fields) != 0 {
		t.Errorf("limits are inclusive: %v", fields)
	}
}

func TestNextAssetCode(t *testing.T) {
	if got := nextAssetCode("AC", "1", nil); got != "AC-1-001" {
		t.Errorf("first code = %s", got)
	}
	// case-insensitive, inactive codes included (they are in the list), lowest gap wins
	if got := nextAssetCode("AC", "1", []string{"AC-1-001", "ac-1-002", "AC-1-004"}); got != "AC-1-003" {
		t.Errorf("gap = %s", got)
	}
}

func TestPriorityCountsAndRatingAverage(t *testing.T) {
	if (PriorityCounts{}).Highest() != nil {
		t.Error("no open tickets → no highest priority")
	}
	if h := (PriorityCounts{High: 1, Low: 3}).Highest(); h == nil || *h != PriorityHigh {
		t.Errorf("highest = %v", h)
	}
	if (OverviewCounts{}).RatingAvgLast7Days() != nil {
		t.Error("no ratings → null average")
	}
	if avg := (OverviewCounts{RatedLast7Days: 3, RatingSumLast7Days: 14}).RatingAvgLast7Days(); avg == nil || *avg != 4.7 {
		t.Errorf("avg = %v, want 4.7", avg)
	}
}

// ---- permissions (D-079, BR-F23-2) ----

func TestDashboardAndAssetPermissions(t *testing.T) {
	a := newAssetFixture(t)
	ctx := context.Background()
	someAsset := uuid.New()
	for _, role := range []string{users.RoleEmployee, users.RoleTechnician, users.RoleHousekeeperLead, users.RoleSecurityLead} {
		v := Viewer{ID: uuid.New(), Role: role}
		if _, err := a.svc.Overview(ctx, v); !forbidden(err) {
			t.Errorf("%s overview: %v", role, err)
		}
		if _, err := a.svc.AssetTypes(ctx, v); !forbidden(err) {
			t.Errorf("%s asset types: %v", role, err)
		}
		if _, err := a.svc.FloorPlan(ctx, v, a.plan.floor); !forbidden(err) {
			t.Errorf("%s floor plan: %v", role, err)
		}
	}
	// The executive reads everything but writes nothing.
	if _, err := a.svc.Overview(ctx, a.exec); err != nil {
		t.Errorf("executive overview: %v", err)
	}
	if _, err := a.svc.FloorPlan(ctx, a.exec, a.plan.floor); err != nil {
		t.Errorf("executive floor plan: %v", err)
	}
	if _, err := a.svc.CreateAsset(ctx, a.exec, a.input("AC-1-001", a.plan.hr3, 28, 12)); !forbidden(err) {
		t.Errorf("executive create: %v", err)
	}
	if _, err := a.svc.UpdateAsset(ctx, a.exec, someAsset, a.input("AC-1-001", a.plan.hr3, 28, 12)); !forbidden(err) {
		t.Errorf("executive update: %v", err)
	}
	if err := a.svc.DeactivateAsset(ctx, a.exec, someAsset); !forbidden(err) {
		t.Errorf("executive deactivate: %v", err)
	}
	if _, err := a.svc.SuggestAssetCode(ctx, a.exec, a.aircon, a.plan.floor); !forbidden(err) {
		t.Errorf("executive suggest: %v", err)
	}
	if len(a.repo.dash.assets) != 0 || len(a.repo.dash.audit) != 0 {
		t.Error("a refused write changed data")
	}
}

func forbidden(err error) bool {
	e, ok := apperr.As(err)
	return ok && e.Kind == apperr.KindForbidden
}

// ---- F31: add, move, edit, deactivate ----

func TestCreateAssetRules(t *testing.T) {
	a := newAssetFixture(t)
	ctx := context.Background()

	created, err := a.svc.CreateAsset(ctx, a.admin, a.input("AC-1-001", a.plan.hr3, 28, 12))
	if err != nil {
		t.Fatal(err)
	}
	if created.Code != "AC-1-001" || created.Room.ID != a.plan.hr3 || created.X == nil || *created.X != 28 {
		t.Fatalf("created = %+v", created)
	}
	if n := len(a.repo.dash.audit); n != 1 || a.repo.dash.audit[0].action != AuditAssetCreated ||
		a.repo.dash.audit[0].actor != a.admin.ID || a.repo.dash.audit[0].data["after"]["code"] != "AC-1-001" {
		t.Fatalf("audit = %+v", a.repo.dash.audit)
	}

	// Without a point the asset is in the room, not placed (F31 step 5).
	unplaced, err := a.svc.CreateAsset(ctx, a.admin, AssetInput{AssetTypeID: a.aircon, Code: "AC-1-002", Name: "แอร์", RoomID: a.plan.dd})
	if err != nil || unplaced.X != nil || unplaced.Z != nil {
		t.Fatalf("unplaced = %+v, %v", unplaced, err)
	}

	cases := []struct {
		name string
		in   AssetInput
		want string
	}{
		{"same code in another case", a.input("ac-1-001", a.plan.dd, 6, 3), "ASSET_CODE_TAKEN"},
		{"point in another room", a.input("AC-1-010", a.plan.hr3, 6, 3), "POINT_OUTSIDE_ROOM"},
		{"point in ห้องน้ำ saved as the common area", a.input("AC-1-011", a.plan.common, 13, 3), "POINT_OUTSIDE_ROOM"},
		{"point outside the plan", a.input("AC-1-012", a.plan.hr3, 33, 12), "VALIDATION_FAILED"},
		{"point on a floor without a plan", a.input("AC-1-013", a.noPlan, 1, 1), "VALIDATION_FAILED"},
		{"inactive room", a.input("AC-1-014", a.offRoom, 1, 1), "MASTER_DATA_CHANGED"},
		{"inactive type", AssetInput{AssetTypeID: uuid.New(), Code: "X-1", Name: "x", RoomID: a.plan.dd}, "MASTER_DATA_CHANGED"},
		{"type missing", AssetInput{Code: "X-2", Name: "x", RoomID: a.plan.dd}, "VALIDATION_FAILED"},
	}
	for _, c := range cases {
		if _, err := a.svc.CreateAsset(ctx, a.admin, c.in); code(err) != c.want {
			t.Errorf("%s: err = %v, want %s", c.name, err, c.want)
		}
	}
	if len(a.repo.dash.assets) != 2 {
		t.Errorf("refused adds were saved: %d assets", len(a.repo.dash.assets))
	}
}

func TestUpdateAndDeactivateAsset(t *testing.T) {
	a := newAssetFixture(t)
	ctx := context.Background()
	created, err := a.svc.CreateAsset(ctx, a.admin, a.input("AC-1-001", a.plan.hr3, 28, 12))
	if err != nil {
		t.Fatal(err)
	}
	other, err := a.svc.CreateAsset(ctx, a.admin, a.input("AC-1-002", a.plan.dd, 6, 3))
	if err != nil {
		t.Fatal(err)
	}

	// Move to another room (F31 step 3): the type stays, the rotation is kept when not sent.
	a.repo.dash.assets[created.ID].RotationDeg = 90
	moved, err := a.svc.UpdateAsset(ctx, a.admin, created.ID, AssetInput{AssetTypeID: uuid.New(), Code: "AC-1-001",
		Name: "แอร์ห้อง HR", RoomID: a.plan.dd, X: pt(2), Z: pt(2)})
	if err != nil {
		t.Fatal(err)
	}
	if moved.Room.ID != a.plan.dd || moved.RotationDeg != 90 || a.repo.dash.assets[created.ID].AssetTypeID != a.aircon {
		t.Fatalf("moved = %+v", moved)
	}
	last := a.repo.dash.audit[len(a.repo.dash.audit)-1]
	if last.action != AuditAssetUpdated || last.data["before"]["roomId"] != a.plan.hr3.String() ||
		last.data["after"]["roomId"] != a.plan.dd.String() {
		t.Fatalf("audit = %+v", last)
	}

	// Keeping its own code is fine; taking another asset's code is not.
	if _, err := a.svc.UpdateAsset(ctx, a.admin, created.ID, a.input("ac-1-001", a.plan.dd, 2, 2)); err != nil {
		t.Errorf("own code: %v", err)
	}
	if _, err := a.svc.UpdateAsset(ctx, a.admin, created.ID, a.input("AC-1-002", a.plan.dd, 2, 2)); code(err) != "ASSET_CODE_TAKEN" {
		t.Errorf("other's code: %v", err)
	}

	// Deactivate (BR-F31-4): gone from reads and writes, the code stays taken.
	if err := a.svc.DeactivateAsset(ctx, a.admin, other.ID); err != nil {
		t.Fatal(err)
	}
	if last := a.repo.dash.audit[len(a.repo.dash.audit)-1]; last.action != AuditAssetDeactivated || last.data["after"]["isActive"] != false {
		t.Errorf("audit = %+v", last)
	}
	if err := a.svc.DeactivateAsset(ctx, a.admin, other.ID); code(err) != "ASSET_NOT_FOUND" {
		t.Errorf("deactivate twice: %v", err)
	}
	if _, err := a.svc.UpdateAsset(ctx, a.admin, other.ID, a.input("AC-1-002", a.plan.dd, 6, 3)); code(err) != "ASSET_NOT_FOUND" {
		t.Errorf("update inactive: %v", err)
	}
	if _, err := a.svc.CreateAsset(ctx, a.admin, a.input("AC-1-002", a.plan.dd, 6, 3)); code(err) != "ASSET_CODE_TAKEN" {
		t.Errorf("reuse inactive code: %v", err)
	}
	if code, err := a.svc.SuggestAssetCode(ctx, a.admin, a.aircon, a.plan.floor); err != nil || code != "AC-1-003" {
		t.Errorf("suggest = %s, %v (inactive AC-1-002 stays taken)", code, err)
	}
	if _, err := a.svc.SuggestAssetCode(ctx, a.admin, a.aircon, uuid.New()); code(err) != "FLOOR_NOT_FOUND" {
		t.Errorf("suggest on unknown floor: %v", err)
	}
}

// ---- #27 ----

func TestOverviewUsesBangkokDayAndDecoratesAttention(t *testing.T) {
	a := newAssetFixture(t)
	ctx := context.Background()
	// 19 Oct 18:30 UTC = 20 Oct 01:30 in Bangkok: "today" is the 20th.
	a.now = time.Date(2026, 10, 19, 18, 30, 0, 0, time.UTC)
	ticket := a.create(t)
	a.repo.dash.attention = []uuid.UUID{ticket.ID}
	a.repo.dash.counts = OverviewCounts{Open: 1, AwaitingAssessment: 1}

	o, err := a.svc.Overview(ctx, a.admin)
	if err != nil {
		t.Fatal(err)
	}
	d := a.repo.dash
	if !d.gotToday.Equal(time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("today = %v", d.gotToday)
	}
	if !d.gotDay.Equal(time.Date(2026, 10, 19, 17, 0, 0, 0, time.UTC)) || !d.gotWeek.Equal(time.Date(2026, 10, 13, 17, 0, 0, 0, time.UTC)) {
		t.Errorf("day start = %v, week start = %v (Bangkok midnights of the 20th and the 14th)", d.gotDay, d.gotWeek)
	}
	if d.gotLimit != AttentionLimit || len(o.Attention) != 1 || o.Attention[0].ViewerRelation != "none" {
		t.Errorf("attention = %+v (limit %d)", o.Attention, d.gotLimit)
	}
	if o.Counts.Open != 1 {
		t.Errorf("counts = %+v", o.Counts)
	}
}
