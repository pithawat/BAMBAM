package locations

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

type PgRepository struct {
	pool *pgxpool.Pool
	q    *platformdb.Queries
}

func NewRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool, q: platformdb.New(pool)}
}

// Tree assembles three flat queries (buildings, floors bottom first, rooms in order).
func (r *PgRepository) Tree(ctx context.Context) ([]Building, error) {
	bs, err := r.q.ListPlanBuildings(ctx)
	if err != nil {
		return nil, err
	}
	fs, err := r.q.ListPlanFloors(ctx)
	if err != nil {
		return nil, err
	}
	rs, err := r.q.ListPlanRooms(ctx)
	if err != nil {
		return nil, err
	}
	rooms := map[uuid.UUID][]Room{}
	for _, x := range rs {
		rooms[x.FloorID] = append(rooms[x.FloorID], Room{ID: x.ID, FloorID: x.FloorID, Name: x.Name, AreaType: x.AreaType,
			ActiveAssetCount: x.ActiveAssetCount, UpdatedAt: x.UpdatedAt,
			UpdatedBy: people.NewRef(x.UpdatedByUserID, x.UpdatedByEmployeeCode, x.UpdatedByFirstNameTh, x.UpdatedByLastNameTh, x.UpdatedByFirstNameEn, x.UpdatedByLastNameEn, x.UpdatedByDepartment)})
	}
	floors := map[uuid.UUID][]Floor{}
	for _, f := range fs {
		rr := rooms[f.ID]
		if rr == nil {
			rr = []Room{}
		}
		floors[f.BuildingID] = append(floors[f.BuildingID], Floor{ID: f.ID, Name: f.Name, Level: f.Level, Rooms: rr})
	}
	out := make([]Building, 0, len(bs))
	for _, b := range bs {
		ff := floors[b.ID]
		if ff == nil {
			ff = []Floor{}
		}
		out = append(out, Building{ID: b.ID, Name: b.Name, Type: TypeRef{ID: b.BuildingTypeID, Name: b.BuildingTypeName}, UpdatedAt: b.UpdatedAt, Floors: ff,
			UpdatedBy: people.NewRef(b.UpdatedByUserID, b.UpdatedByEmployeeCode, b.UpdatedByFirstNameTh, b.UpdatedByLastNameTh, b.UpdatedByFirstNameEn, b.UpdatedByLastNameEn, b.UpdatedByDepartment)})
	}
	return out, nil
}

func (r *PgRepository) Types(ctx context.Context) ([]BuildingType, error) {
	rows, err := r.q.ListBuildingTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]BuildingType, 0, len(rows))
	for _, x := range rows {
		out = append(out, BuildingType{ID: x.ID, Name: x.Name, SortOrder: x.SortOrder, IsActive: x.IsActive, BuildingCount: x.BuildingCount, UpdatedAt: x.UpdatedAt,
			UpdatedBy: people.NewRef(x.UpdatedByUserID, x.UpdatedByEmployeeCode, x.UpdatedByFirstNameTh, x.UpdatedByLastNameTh, x.UpdatedByFirstNameEn, x.UpdatedByLastNameEn, x.UpdatedByDepartment)})
	}
	return out, nil
}

func (r *PgRepository) Place(ctx context.Context, roomID uuid.UUID) (Place, bool, error) {
	row, err := r.q.GetRoomPlace(ctx, roomID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Place{}, false, nil
	}
	if err != nil {
		return Place{}, false, err
	}
	return Place{RoomID: row.ID, FloorID: row.FloorID, BuildingID: row.BuildingID, Room: row.Name, Floor: row.FloorName, Building: row.BuildingName}, true, nil
}

func (r *PgRepository) InTx(ctx context.Context, fn func(tx TxRepository) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&pgTx{tx: tx, q: platformdb.New(tx)})
	})
}

type pgTx struct {
	tx pgx.Tx
	q  *platformdb.Queries
}

func (t *pgTx) LockBuilding(ctx context.Context, id uuid.UUID) (LockedBuilding, error) {
	row, err := t.q.LockBuilding(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedBuilding{}, ErrBuildingNotFound
	}
	if err != nil {
		return LockedBuilding{}, err
	}
	return LockedBuilding{Name: row.Name, UpdatedAt: row.UpdatedAt, Type: TypeRef{ID: row.BuildingTypeID, Name: row.BuildingTypeName}}, nil
}

func (t *pgTx) BuildingNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error) {
	return t.q.BuildingNameTaken(ctx, platformdb.BuildingNameTakenParams{Name: name, SelfID: self})
}

func (t *pgTx) ActiveType(ctx context.Context, id uuid.UUID) (TypeRef, bool, error) {
	row, err := t.q.GetActiveBuildingType(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return TypeRef{}, false, nil
	}
	if err != nil {
		return TypeRef{}, false, err
	}
	return TypeRef{ID: row.ID, Name: row.Name}, true, nil
}

func (t *pgTx) UpdateBuilding(ctx context.Context, id uuid.UUID, name string, typeID, actor uuid.UUID) error {
	return t.q.UpdateBuilding(ctx, platformdb.UpdateBuildingParams{ID: id, Name: name, BuildingTypeID: typeID, ActorID: &actor})
}

func (t *pgTx) LockType(ctx context.Context, id uuid.UUID) (LockedType, error) {
	row, err := t.q.LockBuildingType(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedType{}, ErrTypeNotFound
	}
	if err != nil {
		return LockedType{}, err
	}
	return LockedType{Name: row.Name, IsActive: row.IsActive, InUse: row.InUse, UpdatedAt: row.UpdatedAt}, nil
}

func (t *pgTx) TypeNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error) {
	return t.q.BuildingTypeNameTaken(ctx, platformdb.BuildingTypeNameTakenParams{Name: name, SelfID: self})
}

func (t *pgTx) InsertType(ctx context.Context, id uuid.UUID, name string, actor uuid.UUID) error {
	return t.q.InsertBuildingType(ctx, platformdb.InsertBuildingTypeParams{ID: id, Name: name, ActorID: &actor})
}

func (t *pgTx) UpdateType(ctx context.Context, id uuid.UUID, name string, active bool, actor uuid.UUID) error {
	return t.q.UpdateBuildingType(ctx, platformdb.UpdateBuildingTypeParams{ID: id, Name: name, IsActive: active, ActorID: &actor})
}

func (t *pgTx) LockRoom(ctx context.Context, id uuid.UUID) (LockedRoom, error) {
	row, err := t.q.LockRoom(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedRoom{}, ErrRoomNotFound
	}
	if err != nil {
		return LockedRoom{}, err
	}
	return LockedRoom{ID: row.ID, FloorID: row.FloorID, Name: row.Name, UpdatedAt: row.UpdatedAt, Floor: row.FloorName, Building: row.BuildingName}, nil
}

func (t *pgTx) RoomNameTaken(ctx context.Context, floorID uuid.UUID, name string, self uuid.UUID) (bool, error) {
	return t.q.RoomNameTaken(ctx, platformdb.RoomNameTakenParams{FloorID: floorID, Name: name, SelfID: self})
}

func (t *pgTx) RenameRoom(ctx context.Context, id uuid.UUID, name string, actor uuid.UUID) error {
	return t.q.RenameRoom(ctx, platformdb.RenameRoomParams{ID: id, Name: name, ActorID: &actor})
}

func (t *pgTx) Audit(ctx context.Context, e audit.Entry) error { return audit.Write(ctx, t.tx, e) }
