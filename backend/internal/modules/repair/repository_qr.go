package repair

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
)

// Stage 5 QR (F13-B): asset lookup #25 and the asset link of a new ticket (queries/assets.sql).

func (r *PgRepository) LookupAsset(ctx context.Context, code string) (AssetLookup, error) {
	row, err := r.q.LookupAssetByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssetLookup{}, ErrAssetNotFound
	}
	if err != nil {
		return AssetLookup{}, err
	}
	return AssetLookup{
		Code: row.Code, Name: row.Name, TypeID: row.AssetTypeID,
		Building: Ref{ID: row.BuildingID, Name: row.BuildingName},
		Floor:    Ref{ID: row.FloorID, Name: row.FloorName},
		Room:     Ref{ID: row.RoomID, Name: row.RoomName},
	}, nil
}

func (r *PgRepository) AssetTypeCategories(ctx context.Context, typeID, buildingID uuid.UUID) ([]AssetCategory, error) {
	rows, err := r.q.ListAssetTypeCategories(ctx, repairdb.ListAssetTypeCategoriesParams{AssetTypeID: typeID, BuildingID: buildingID})
	if err != nil {
		return nil, err
	}
	out := make([]AssetCategory, 0, len(rows))
	for _, c := range rows {
		out = append(out, AssetCategory{Ref: Ref{ID: c.ID, Name: c.Name}, IsOther: c.IsOther, UsedInBuilding: c.UsedInBuilding})
	}
	return out, nil
}

func (r *pgTxRepository) ActiveAssetIDByCode(ctx context.Context, code string) (uuid.UUID, bool, error) {
	id, err := r.q.ActiveAssetIDByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}
	return id, true, nil
}
