package repair

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
)

// CR-016: dashboard, floor plans and equipment (queries/assets.sql).

func (r *PgRepository) OverviewCounts(ctx context.Context, today, dayStart, weekStart time.Time) (OverviewCounts, error) {
	row, err := r.q.OverviewCounts(ctx, repairdb.OverviewCountsParams{
		Today: pgtype.Date{Time: today, Valid: true}, DayStart: dayStart, WeekStart: weekStart,
	})
	if err != nil {
		return OverviewCounts{}, err
	}
	c := OverviewCounts{
		Open: row.OpenCount, AwaitingAssessment: row.AwaitingAssessmentCount, InRepair: row.InRepairCount,
		Reworking: row.ReworkingCount, AwaitingRating: row.AwaitingRatingCount, Overdue: row.OverdueCount,
		ReportedToday: row.ReportedTodayCount, ClosedToday: row.ClosedTodayCount, ClosedLast7Days: row.ClosedLast7Count,
		RatedLast7Days: row.RatedLast7Count, RatingSumLast7Days: row.RatingSumLast7,
	}
	if c.OldestAwaitingAssessmentAt, err = optionalTime(r.q.OldestAwaitingAssessment(ctx)); err != nil {
		return OverviewCounts{}, err
	}
	if c.NextAutoCloseAt, err = optionalTime(r.q.NextAutoClose(ctx)); err != nil {
		return OverviewCounts{}, err
	}
	return c, nil
}

func optionalTime(t time.Time, err error) (*time.Time, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PgRepository) OverviewBuildings(ctx context.Context) ([]OverviewBuilding, error) {
	blds, err := r.q.ListActiveBuildings(ctx)
	if err != nil {
		return nil, err
	}
	floors, err := r.q.OverviewFloors(ctx)
	if err != nil {
		return nil, err
	}
	withPlans, err := r.q.BuildingsWithPlans(ctx)
	if err != nil {
		return nil, err
	}
	plans := make(map[uuid.UUID]repairdb.BuildingsWithPlansRow, len(withPlans))
	for _, p := range withPlans {
		plans[p.BuildingID] = p
	}
	byBuilding := map[uuid.UUID][]OverviewFloor{}
	for _, f := range floors {
		byBuilding[f.BuildingID] = append(byBuilding[f.BuildingID], OverviewFloor{
			ID: f.ID, BuildingID: f.BuildingID, Name: f.Name, Level: f.Level,
			Open:  PriorityCounts{Critical: f.CriticalCount, High: f.HighCount, Medium: f.MediumCount, Low: f.LowCount},
			Steps: StepCounts{AwaitingAssessment: f.AwaitingAssessmentCount, InRepair: f.InRepairCount, AwaitingRating: f.AwaitingRatingCount},
		})
	}
	out := make([]OverviewBuilding, 0, len(blds))
	for _, b := range blds {
		ob := OverviewBuilding{ID: b.ID, Name: b.Name, Floors: nonNil(byBuilding[b.ID])}
		if p, ok := plans[b.ID]; ok {
			w, d := p.WidthM, p.DepthM
			ob.HasModel, ob.WidthM, ob.DepthM = true, &w, &d
		}
		out = append(out, ob)
	}
	return out, nil
}

func (r *PgRepository) AttentionTicketIDs(ctx context.Context, today time.Time, limit int) ([]uuid.UUID, error) {
	return r.q.AttentionTicketIDs(ctx, repairdb.AttentionTicketIDsParams{
		Today: pgtype.Date{Time: today, Valid: true}, RowLimit: int32(limit), // #nosec G115 -- constant ≤ 5
	})
}

func (r *PgRepository) ListAssetTypes(ctx context.Context) ([]AssetType, error) {
	rows, err := r.q.ListActiveAssetTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AssetType, 0, len(rows))
	for _, t := range rows {
		out = append(out, AssetType{ID: t.ID, Key: t.Key, Name: t.Name, CodePrefix: t.CodePrefix, Icon: t.Icon, Mount: t.Mount})
	}
	return out, nil
}

func (r *PgRepository) GetFloorPlan(ctx context.Context, floorID uuid.UUID) (FloorPlan, error) {
	f, err := r.q.GetFloorPlan(ctx, floorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return FloorPlan{}, ErrFloorNotFound
	}
	if err != nil {
		return FloorPlan{}, err
	}
	plan := FloorPlan{
		Floor:    Floor{ID: f.ID, Name: f.Name, Level: f.Level},
		Building: Ref{ID: f.BuildingID, Name: f.BuildingName},
	}
	if f.HasPlan {
		w, d := f.WidthM, f.DepthM
		plan.WidthM, plan.DepthM, plan.ModelFile = &w, &d, f.ModelFile
	}
	rooms, err := r.q.ListFloorRooms(ctx, floorID)
	if err != nil {
		return FloorPlan{}, err
	}
	plan.Rooms = make([]PlanRoom, 0, len(rooms))
	for _, rm := range rooms {
		shape, err := decodeShape(rm.PlanShape)
		if err != nil {
			return FloorPlan{}, err
		}
		if !f.HasPlan {
			shape = nil
		}
		plan.Rooms = append(plan.Rooms, PlanRoom{ID: rm.ID, Name: rm.Name, AreaType: rm.AreaType, Shape: shape,
			Open: PriorityCounts{Critical: rm.CriticalCount, High: rm.HighCount, Medium: rm.MediumCount, Low: rm.LowCount}})
	}
	assets, err := r.q.ListFloorAssets(ctx, floorID)
	if err != nil {
		return FloorPlan{}, err
	}
	plan.Assets = make([]Asset, 0, len(assets))
	for _, a := range assets {
		plan.Assets = append(plan.Assets, assetFrom(repairdb.GetAssetRow(a)))
	}
	return plan, nil
}

func (r *PgRepository) GetAsset(ctx context.Context, id uuid.UUID) (Asset, error) {
	row, err := r.q.GetAsset(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrAssetNotFound
	}
	if err != nil {
		return Asset{}, err
	}
	return assetFrom(row), nil
}

func assetFrom(a repairdb.GetAssetRow) Asset {
	out := Asset{ID: a.ID, Code: a.Code, Name: a.Name, Type: AssetTypeRef{ID: a.TypeID, Key: a.TypeKey, Name: a.TypeName},
		Room: Ref{ID: a.RoomID, Name: a.RoomName}, RotationDeg: a.RotationDeg, OpenTickets: a.OpenTickets}
	if a.Placed {
		x, z := a.PosX, a.PosZ
		out.X, out.Z = &x, &z
	}
	return out
}

func (r *PgRepository) ActiveFloorName(ctx context.Context, floorID uuid.UUID) (string, error) {
	name, err := r.q.GetActiveFloorName(ctx, floorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrFloorNotFound
	}
	return name, err
}

func (r *PgRepository) ActiveAssetType(ctx context.Context, id uuid.UUID) (AssetType, bool, error) {
	return activeAssetType(ctx, r.q, id)
}

func (r *PgRepository) AssetCodesWithPrefix(ctx context.Context, prefix string) ([]string, error) {
	return r.q.ListAssetCodesWithPrefix(ctx, prefix)
}

func activeAssetType(ctx context.Context, q *repairdb.Queries, id uuid.UUID) (AssetType, bool, error) {
	t, err := q.GetActiveAssetType(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssetType{}, false, nil
	}
	if err != nil {
		return AssetType{}, false, err
	}
	return AssetType{ID: t.ID, Key: t.Key, CodePrefix: t.CodePrefix}, true, nil
}

// decodeShape reads platform.rooms.plan_shape ([[x, z], …]); NULL → nil.
func decodeShape(raw []byte) (Shape, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var s Shape
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return s, nil
}

// ---- transaction ----

func (r *pgTxRepository) ActiveAssetType(ctx context.Context, id uuid.UUID) (AssetType, bool, error) {
	return activeAssetType(ctx, r.q, id)
}

func (r *pgTxRepository) PlacementRoom(ctx context.Context, roomID uuid.UUID) (PlacementRoom, bool, error) {
	row, err := r.q.GetPlacementRoom(ctx, roomID)
	if errors.Is(err, pgx.ErrNoRows) {
		return PlacementRoom{}, false, nil
	}
	if err != nil {
		return PlacementRoom{}, false, err
	}
	shape, err := decodeShape(row.PlanShape)
	if err != nil {
		return PlacementRoom{}, false, err
	}
	return PlacementRoom{ID: row.ID, FloorID: row.FloorID, Shape: shape, HasPlan: row.HasPlan,
		WidthM: row.WidthM, DepthM: row.DepthM}, true, nil
}

func (r *pgTxRepository) RoomShapesOnFloor(ctx context.Context, floorID uuid.UUID) ([]RoomShape, error) {
	rows, err := r.q.ListRoomShapesOnFloor(ctx, floorID)
	if err != nil {
		return nil, err
	}
	out := make([]RoomShape, 0, len(rows))
	for _, rm := range rows {
		shape, err := decodeShape(rm.PlanShape)
		if err != nil {
			return nil, err
		}
		out = append(out, RoomShape{ID: rm.ID, Shape: shape})
	}
	return out, nil
}

func (r *pgTxRepository) AssetCodeTaken(ctx context.Context, code string, excludeID uuid.UUID) (bool, error) {
	return r.q.AssetCodeTaken(ctx, repairdb.AssetCodeTakenParams{Code: code, ExcludeID: excludeID})
}

func (r *pgTxRepository) LockAsset(ctx context.Context, id uuid.UUID) (LockedAsset, error) {
	a, err := r.q.LockAsset(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockedAsset{}, ErrAssetNotFound
	}
	if err != nil {
		return LockedAsset{}, err
	}
	out := LockedAsset{ID: a.ID, AssetTypeID: a.AssetTypeID, RoomID: a.RoomID, Code: a.Code, Name: a.Name,
		RotationDeg: a.RotationDeg, IsActive: a.IsActive}
	if a.Placed {
		x, z := a.PosX, a.PosZ
		out.X, out.Z = &x, &z
	}
	return out, nil
}

func (r *pgTxRepository) InsertAsset(ctx context.Context, id uuid.UUID, in AssetInput, by uuid.UUID) error {
	return codeTaken(r.q.InsertAsset(ctx, repairdb.InsertAssetParams{
		ID: id, Code: in.Code, Name: in.Name, AssetTypeID: in.AssetTypeID, RoomID: in.RoomID, PosX: in.X, PosZ: in.Z,
		RotationDeg: rotation(in), ActorID: &by,
	}))
}

func (r *pgTxRepository) UpdateAsset(ctx context.Context, id uuid.UUID, in AssetInput, by uuid.UUID) error {
	return codeTaken(r.q.UpdateAsset(ctx, repairdb.UpdateAssetParams{
		ID: id, Code: in.Code, Name: in.Name, RoomID: in.RoomID, PosX: in.X, PosZ: in.Z,
		RotationDeg: rotation(in), ActorID: &by,
	}))
}

func (r *pgTxRepository) DeactivateAsset(ctx context.Context, id, by uuid.UUID) error {
	return r.q.DeactivateAsset(ctx, repairdb.DeactivateAssetParams{ID: id, ActorID: &by})
}

func (r *pgTxRepository) InsertAudit(ctx context.Context, actor uuid.UUID, action string, assetID uuid.UUID, data []byte) error {
	target := assetID.String()
	return r.q.InsertAssetAudit(ctx, repairdb.InsertAssetAuditParams{ActorID: &actor, Action: action, TargetID: &target, Data: data})
}

func rotation(in AssetInput) int16 {
	if in.RotationDeg == nil {
		return 0
	}
	return int16(*in.RotationDeg) // #nosec G115 -- validated 0–359
}

// codeTaken maps the unique index on lower(code) to ASSET_CODE_TAKEN (two admins saving the same code).
func codeTaken(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "assets_code_key" {
		return ErrAssetCodeTaken
	}
	return err
}
