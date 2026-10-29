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
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
)

// CR-005 rules with an in-memory repository: building type changes and building type edits.

var t0 = time.Date(2026, 10, 27, 3, 0, 0, 0, time.UTC)

type memRepo struct {
	building LockedBuilding
	types    map[uuid.UUID]LockedType
	audits   []audit.Entry
	updated  *uuid.UUID // the building's type after UpdateBuilding
}

func (m *memRepo) Tree(context.Context) ([]Building, error) {
	return []Building{{ID: bID, Name: m.building.Name, Type: m.building.Type}}, nil
}
func (m *memRepo) Types(context.Context) ([]BuildingType, error) {
	out := []BuildingType{}
	for id, t := range m.types {
		out = append(out, BuildingType{ID: id, Name: t.Name, IsActive: t.IsActive})
	}
	return out, nil
}
func (m *memRepo) Place(context.Context, uuid.UUID) (Place, bool, error) { return Place{}, false, nil }
func (m *memRepo) InTx(_ context.Context, fn func(tx TxRepository) error) error {
	return fn(m)
}
func (m *memRepo) LockBuilding(context.Context, uuid.UUID) (LockedBuilding, error) {
	return m.building, nil
}
func (m *memRepo) BuildingNameTaken(_ context.Context, name string, _ uuid.UUID) (bool, error) {
	return name == "อาคาร 2", nil
}
func (m *memRepo) ActiveType(_ context.Context, id uuid.UUID) (TypeRef, bool, error) {
	t, ok := m.types[id]
	if !ok || !t.IsActive {
		return TypeRef{}, false, nil
	}
	return TypeRef{ID: id, Name: t.Name}, true, nil
}
func (m *memRepo) UpdateBuilding(_ context.Context, _ uuid.UUID, _ string, typeID, _ uuid.UUID) error {
	m.updated = &typeID
	return nil
}
func (m *memRepo) LockRoom(context.Context, uuid.UUID) (LockedRoom, error) {
	return LockedRoom{}, ErrRoomNotFound
}
func (m *memRepo) RoomNameTaken(context.Context, uuid.UUID, string, uuid.UUID) (bool, error) {
	return false, nil
}
func (m *memRepo) RenameRoom(context.Context, uuid.UUID, string, uuid.UUID) error { return nil }
func (m *memRepo) LockType(_ context.Context, id uuid.UUID) (LockedType, error) {
	t, ok := m.types[id]
	if !ok {
		return LockedType{}, ErrTypeNotFound
	}
	return t, nil
}
func (m *memRepo) TypeNameTaken(_ context.Context, name string, self uuid.UUID) (bool, error) {
	for id, t := range m.types {
		if id != self && t.Name == name {
			return true, nil
		}
	}
	return false, nil
}
func (m *memRepo) InsertType(_ context.Context, id uuid.UUID, name string, _ uuid.UUID) error {
	m.types[id] = LockedType{Name: name, IsActive: true, UpdatedAt: t0}
	return nil
}
func (m *memRepo) UpdateType(_ context.Context, id uuid.UUID, name string, active bool, _ uuid.UUID) error {
	t := m.types[id]
	t.Name, t.IsActive = name, active
	m.types[id] = t
	return nil
}
func (m *memRepo) Audit(_ context.Context, e audit.Entry) error {
	m.audits = append(m.audits, e)
	return nil
}

var (
	bID, office, store, closed, used = uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
)

func newMem() *memRepo {
	return &memRepo{
		building: LockedBuilding{Name: "อาคาร 1", UpdatedAt: t0, Type: TypeRef{ID: office, Name: "อาคารสำนักงาน"}},
		types: map[uuid.UUID]LockedType{
			office: {Name: "อาคารสำนักงาน", IsActive: true, InUse: true, UpdatedAt: t0},
			store:  {Name: "โกดังเก็บของ", IsActive: true, UpdatedAt: t0},
			closed: {Name: "เลิกใช้", IsActive: false, UpdatedAt: t0},
			used:   {Name: "โรงงาน", IsActive: true, InUse: true, UpdatedAt: t0},
		},
	}
}

func TestUpdateBuildingType(t *testing.T) {
	ctx, actor := context.Background(), uuid.New()
	var fe *apperr.Error

	m := newMem()
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 1", TypeID: &closed, UpdatedAt: t0}); !errors.As(err, &fe) || fe.Fields["buildingTypeId"] != "INVALID" {
		t.Errorf("inactive type: %v", err)
	}
	unknown := uuid.New()
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 1", TypeID: &unknown, UpdatedAt: t0}); !errors.As(err, &fe) || fe.Fields["buildingTypeId"] != "INVALID" {
		t.Errorf("unknown type: %v", err)
	}
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 1", TypeID: &store, UpdatedAt: t0.Add(time.Second)}); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale: %v", err)
	}
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 2", UpdatedAt: t0}); !errors.Is(err, ErrNameTaken) {
		t.Errorf("name taken: %v", err)
	}
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 1", TypeID: &office, UpdatedAt: t0}); err != nil || m.updated != nil || len(m.audits) != 0 {
		t.Errorf("no change wrote: %v %v %d", err, m.updated, len(m.audits))
	}
	if _, err := NewService(m).UpdateBuilding(ctx, actor, bID, BuildingInput{Name: "อาคาร 1", TypeID: &store, UpdatedAt: t0}); err != nil {
		t.Fatal(err)
	}
	if m.updated == nil || *m.updated != store || len(m.audits) != 1 {
		t.Fatalf("type change: %v %d", m.updated, len(m.audits))
	}
	ch := m.audits[0].Data.(renameData).Changes
	if len(ch) != 1 || ch[0].Field != "buildingType" || *ch[0].Before != "อาคารสำนักงาน" || *ch[0].After != "โกดังเก็บของ" {
		t.Errorf("audit changes = %+v", ch)
	}
}

func TestBuildingTypeRules(t *testing.T) {
	ctx, actor := context.Background(), uuid.New()
	f, tr := false, true
	str := func(s string) *string { return &s }
	m := newMem()
	svc := NewService(m)

	if _, err := svc.CreateType(ctx, actor, " โกดังเก็บของ "); !errors.Is(err, ErrNameTaken) {
		t.Errorf("create taken: %v", err)
	}
	created, err := svc.CreateType(ctx, actor, "  โรงอาหาร ")
	if err != nil || created.Name != "โรงอาหาร" || m.audits[0].Action != "create" || m.audits[0].TargetType != "building_type" {
		t.Errorf("create: %+v %v", created, err)
	}
	if _, err := svc.UpdateType(ctx, actor, used, TypeInput{IsActive: &f, UpdatedAt: t0}); !errors.Is(err, ErrTypeInUse) {
		t.Errorf("deactivate in use: %v", err)
	}
	if _, err := svc.UpdateType(ctx, actor, store, TypeInput{IsActive: &f, UpdatedAt: t0.Add(time.Second)}); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale: %v", err)
	}
	if _, err := svc.UpdateType(ctx, actor, store, TypeInput{Name: str("อาคารสำนักงาน"), UpdatedAt: t0}); !errors.Is(err, ErrNameTaken) {
		t.Errorf("rename taken: %v", err)
	}
	if _, err := svc.UpdateType(ctx, actor, uuid.New(), TypeInput{UpdatedAt: t0}); !errors.Is(err, ErrTypeNotFound) {
		t.Errorf("unknown: %v", err)
	}
	var fe *apperr.Error
	if _, err := svc.UpdateType(ctx, actor, store, TypeInput{Name: str(" "), UpdatedAt: t0}); !errors.As(err, &fe) || fe.Fields["name"] != "REQUIRED" {
		t.Errorf("blank: %v", err)
	}
	n := len(m.audits)
	if _, err := svc.UpdateType(ctx, actor, store, TypeInput{IsActive: &f, UpdatedAt: t0}); err != nil || m.audits[n].Action != "deactivate" {
		t.Errorf("deactivate unused: %v", err)
	}
	if _, err := svc.UpdateType(ctx, actor, closed, TypeInput{IsActive: &tr, UpdatedAt: t0}); err != nil || m.audits[n+1].Action != "activate" {
		t.Errorf("activate: %v", err)
	}
	if _, err := svc.UpdateType(ctx, actor, used, TypeInput{Name: str("โรงงาน"), UpdatedAt: t0}); err != nil || len(m.audits) != n+2 {
		t.Errorf("no-op wrote audit: %v", err)
	}
}

// Runs when TEST_DATABASE_URL points at a migrated database: the CR-005 types against Postgres — seeded counts,
// add, rename taken, deactivate in use, change a building's type and back.
func TestBuildingTypesPg(t *testing.T) {
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
	tag := uuid.NewString()[:4]
	var actor uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO platform.users (employee_code, first_name_th) VALUES ($1, 'ทดสอบ') RETURNING id`, "ITBT"+tag).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	svc := NewService(NewRepository(pool))
	warehouse := uuid.MustParse("c025b1d0-0000-4000-8000-000000000001")
	officeID := uuid.MustParse("c025b700-0000-4000-8000-000000000001")
	storeID := uuid.MustParse("c025b700-0000-4000-8000-000000000002")
	var created uuid.UUID
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `UPDATE platform.buildings SET building_type_id = $2 WHERE id = $1`, warehouse, storeID)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.building_types WHERE id = $1`, created)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.audit_log WHERE actor_user_id = $1`, actor)
		_, _ = pool.Exec(ctx, `DELETE FROM platform.users WHERE id = $1`, actor)
	})

	types, err := svc.Types(ctx)
	if err != nil || len(types) < 3 {
		t.Fatalf("types = %v, %v", types, err)
	}
	for _, x := range types[:3] {
		if x.BuildingCount < 1 {
			t.Errorf("%s has no building", x.Name)
		}
	}
	bt, err := svc.CreateType(ctx, actor, "โรงงาน "+tag)
	if err != nil {
		t.Fatal(err)
	}
	created = bt.ID
	if bt.BuildingCount != 0 || !bt.IsActive || bt.UpdatedBy == nil {
		t.Errorf("created = %+v", bt)
	}
	if _, err := svc.CreateType(ctx, actor, "โรงงาน "+tag); !errors.Is(err, ErrNameTaken) {
		t.Errorf("duplicate: %v", err)
	}
	f := false
	var at time.Time
	for _, x := range types {
		if x.ID == officeID {
			at = x.UpdatedAt
		}
	}
	if _, err := svc.UpdateType(ctx, actor, officeID, TypeInput{IsActive: &f, UpdatedAt: at}); !errors.Is(err, ErrTypeInUse) {
		t.Errorf("deactivate office: %v", err)
	}

	tree, err := svc.Tree(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var b Building
	for _, x := range tree {
		if x.ID == warehouse {
			b = x
		}
	}
	if b.Type.ID != storeID {
		t.Skipf("mock warehouse type = %v", b.Type)
	}
	changed, err := svc.UpdateBuilding(ctx, actor, b.ID, BuildingInput{Name: b.Name, TypeID: &officeID, UpdatedAt: b.UpdatedAt})
	if err != nil || changed.Type.ID != officeID || changed.Type.Name != "อาคารสำนักงาน" {
		t.Fatalf("change type = %+v, %v", changed.Type, err)
	}
	if _, err := svc.UpdateBuilding(ctx, actor, b.ID, BuildingInput{Name: b.Name, TypeID: &storeID, UpdatedAt: changed.UpdatedAt}); err != nil {
		t.Errorf("change back: %v", err)
	}
}
