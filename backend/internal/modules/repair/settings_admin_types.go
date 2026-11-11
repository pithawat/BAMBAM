package repair

import (
	"context"

	"github.com/google/uuid"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

// settings Stage 4P (CR-005, #53 / #54): the categories each building type uses. The types themselves are
// platform data (locations); repair owns repair.category_building_types.

// BuildingTypeCategories maps each building type to the categories used in it ("อื่น ๆ" is never listed).
func (a *SettingsAdmin) BuildingTypeCategories(ctx context.Context) (map[uuid.UUID][]uuid.UUID, error) {
	rows, err := a.q.AdminListBuildingTypeCategories(ctx)
	if err != nil {
		return nil, err
	}
	out := map[uuid.UUID][]uuid.UUID{}
	for _, r := range rows {
		out[r.BuildingTypeID] = append(out[r.BuildingTypeID], r.CategoryID)
	}
	return out, nil
}

// CheckTypeCategories validates #54 `categoryIds` before the type is created: every id is a known category
// that is not "อื่น ๆ" → else 400 `categoryIds: INVALID`.
func (a *SettingsAdmin) CheckTypeCategories(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	rows, err := a.q.AdminListCategories(ctx)
	if err != nil {
		return err
	}
	ok := map[uuid.UUID]bool{}
	for _, r := range rows {
		ok[r.ID] = !r.IsOther
	}
	for _, id := range ids {
		if !ok[id] {
			return apperr.Validation(map[string]string{"categoryIds": "INVALID"})
		}
	}
	return nil
}

// LinkBuildingType uses a new building type in the given categories (#54, after CheckTypeCategories).
func (a *SettingsAdmin) LinkBuildingType(ctx context.Context, typeID uuid.UUID, categoryIDs []uuid.UUID) error {
	if len(categoryIDs) == 0 {
		return nil
	}
	return a.q.AdminLinkBuildingTypeCategories(ctx, repairdb.AdminLinkBuildingTypeCategoriesParams{BuildingTypeID: typeID, CategoryIds: categoryIDs})
}
