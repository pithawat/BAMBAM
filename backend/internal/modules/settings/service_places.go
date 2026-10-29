package settings

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/assets"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
)

// Stage 4 (F26, CR-001 / CR-002): plan locations (#13, #15, #27), assets (#46–#49), asset types (#50–#52).

// Locations is the platform building plan: the active tree and renames.
type Locations interface {
	Tree(ctx context.Context) ([]locations.Building, error)
	UpdateBuilding(ctx context.Context, actor, id uuid.UUID, in locations.BuildingInput) (locations.Building, error)
	RenameRoom(ctx context.Context, actor, id uuid.UUID, name string, updatedAt time.Time) (locations.Room, error)
	Types(ctx context.Context) ([]locations.BuildingType, error)
	CreateType(ctx context.Context, actor uuid.UUID, name string) (locations.BuildingType, error)
	UpdateType(ctx context.Context, actor, id uuid.UUID, in locations.TypeInput) (locations.BuildingType, error)
}

// Assets is the platform equipment service.
type Assets interface {
	RoomAssets(ctx context.Context, in assets.ListInput) ([]assets.Asset, error)
	CreateAsset(ctx context.Context, actor uuid.UUID, in assets.AssetInput) (assets.Asset, error)
	UpdateAsset(ctx context.Context, actor, id uuid.UUID, in assets.AssetInput) (assets.Asset, error)
	SuggestCode(ctx context.Context, typeID, roomID uuid.UUID) (string, error)
	Types(ctx context.Context) ([]assets.AssetType, error)
	CreateType(ctx context.Context, actor uuid.UUID, in assets.TypeInput) (assets.AssetType, error)
	UpdateType(ctx context.Context, actor, id uuid.UUID, in assets.TypeInput) (assets.AssetType, error)
}

// RepairUsage is repair's SettingsAdmin as far as Stage 4 needs it.
type RepairUsage interface {
	OpenTicketCounts(ctx context.Context, assetIDs []uuid.UUID) (map[uuid.UUID]int64, error)
}

// Buildings implements #13: the plan tree. S20 needs it for renames (locations) and for assets.
func (s *Service) Buildings(ctx context.Context, v Viewer) ([]locations.Building, error) {
	if !v.Can(PermLocations) && !v.Can(PermAssets) {
		return nil, apperr.ErrForbidden
	}
	return s.locations.Tree(ctx)
}

// UpdateBuilding implements #15 (rename, CR-005 building type).
func (s *Service) UpdateBuilding(ctx context.Context, v Viewer, id uuid.UUID, in locations.BuildingInput) (locations.Building, error) {
	if !v.Can(PermLocations) {
		return locations.Building{}, apperr.ErrForbidden
	}
	return s.locations.UpdateBuilding(ctx, v.ID, id, in)
}

// BuildingTypeAdmin is #53–#55's `BuildingTypeAdmin`: the platform type with the categories used in it (repair).
type BuildingTypeAdmin struct {
	locations.BuildingType
	CategoryIDs []uuid.UUID
}

func (s *Service) withCategories(ctx context.Context, list []locations.BuildingType) ([]BuildingTypeAdmin, error) {
	links, err := s.master.BuildingTypeCategories(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]BuildingTypeAdmin, 0, len(list))
	for _, t := range list {
		ids := links[t.ID]
		if ids == nil {
			ids = []uuid.UUID{}
		}
		out = append(out, BuildingTypeAdmin{BuildingType: t, CategoryIDs: ids})
	}
	return out, nil
}

func (s *Service) oneWithCategories(ctx context.Context, t locations.BuildingType, err error) (BuildingTypeAdmin, error) {
	if err != nil {
		return BuildingTypeAdmin{}, err
	}
	list, err := s.withCategories(ctx, []locations.BuildingType{t})
	if err != nil {
		return BuildingTypeAdmin{}, err
	}
	return list[0], nil
}

// BuildingTypes implements #53 (S20 tab; S22 needs the names for its check boxes).
func (s *Service) BuildingTypes(ctx context.Context, v Viewer) ([]BuildingTypeAdmin, error) {
	if !v.Can(PermLocations) && !v.Can(PermCategories) {
		return nil, apperr.ErrForbidden
	}
	list, err := s.locations.Types(ctx)
	if err != nil {
		return nil, err
	}
	return s.withCategories(ctx, list)
}

// CreateBuildingType implements #54: categoryIds are checked first (repair), then the type is created (platform)
// and used in those categories.
func (s *Service) CreateBuildingType(ctx context.Context, v Viewer, name string, categoryIDs []uuid.UUID) (BuildingTypeAdmin, error) {
	if !v.Can(PermLocations) {
		return BuildingTypeAdmin{}, apperr.ErrForbidden
	}
	if _, err := locations.ValidTypeName(name); err != nil {
		return BuildingTypeAdmin{}, err
	}
	if err := s.master.CheckTypeCategories(ctx, categoryIDs); err != nil {
		return BuildingTypeAdmin{}, err
	}
	t, err := s.locations.CreateType(ctx, v.ID, name)
	if err != nil {
		return BuildingTypeAdmin{}, err
	}
	if err := s.master.LinkBuildingType(ctx, t.ID, categoryIDs); err != nil {
		return BuildingTypeAdmin{}, err
	}
	return s.oneWithCategories(ctx, t, nil)
}

// UpdateBuildingType implements #55.
func (s *Service) UpdateBuildingType(ctx context.Context, v Viewer, id uuid.UUID, in locations.TypeInput) (BuildingTypeAdmin, error) {
	if !v.Can(PermLocations) {
		return BuildingTypeAdmin{}, apperr.ErrForbidden
	}
	t, err := s.locations.UpdateType(ctx, v.ID, id, in)
	return s.oneWithCategories(ctx, t, err)
}

// RenameRoom implements #27.
func (s *Service) RenameRoom(ctx context.Context, v Viewer, id uuid.UUID, name string, updatedAt time.Time) (locations.Room, error) {
	if !v.Can(PermLocations) {
		return locations.Room{}, apperr.ErrForbidden
	}
	return s.locations.RenameRoom(ctx, v.ID, id, name, updatedAt)
}

// RoomAssets implements #46 with repair's open ticket counts.
func (s *Service) RoomAssets(ctx context.Context, v Viewer, in assets.ListInput) ([]assets.Asset, error) {
	if !v.Can(PermAssets) {
		return nil, apperr.ErrForbidden
	}
	list, err := s.assets.RoomAssets(ctx, in)
	if err != nil {
		return nil, err
	}
	return s.withOpenTickets(ctx, list)
}

func (s *Service) withOpenTickets(ctx context.Context, list []assets.Asset) ([]assets.Asset, error) {
	ids := make([]uuid.UUID, 0, len(list))
	for _, a := range list {
		ids = append(ids, a.ID)
	}
	counts, err := s.repair.OpenTicketCounts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].OpenTicketCount = counts[list[i].ID]
	}
	return list, nil
}

func (s *Service) oneWithOpenTickets(ctx context.Context, a assets.Asset, err error) (assets.Asset, error) {
	if err != nil {
		return assets.Asset{}, err
	}
	list, err := s.withOpenTickets(ctx, []assets.Asset{a})
	if err != nil {
		return assets.Asset{}, err
	}
	return list[0], nil
}

// CreateAsset implements #47.
func (s *Service) CreateAsset(ctx context.Context, v Viewer, in assets.AssetInput) (assets.Asset, error) {
	if !v.Can(PermAssets) {
		return assets.Asset{}, apperr.ErrForbidden
	}
	a, err := s.assets.CreateAsset(ctx, v.ID, in)
	return s.oneWithOpenTickets(ctx, a, err)
}

// UpdateAsset implements #48.
func (s *Service) UpdateAsset(ctx context.Context, v Viewer, id uuid.UUID, in assets.AssetInput) (assets.Asset, error) {
	if !v.Can(PermAssets) {
		return assets.Asset{}, apperr.ErrForbidden
	}
	a, err := s.assets.UpdateAsset(ctx, v.ID, id, in)
	return s.oneWithOpenTickets(ctx, a, err)
}

// SuggestAssetCode implements #49.
func (s *Service) SuggestAssetCode(ctx context.Context, v Viewer, typeID, roomID uuid.UUID) (string, error) {
	if !v.Can(PermAssets) {
		return "", apperr.ErrForbidden
	}
	return s.assets.SuggestCode(ctx, typeID, roomID)
}

// AssetTypes implements #50.
func (s *Service) AssetTypes(ctx context.Context, v Viewer) ([]assets.AssetType, error) {
	if !v.Can(PermAssets) {
		return nil, apperr.ErrForbidden
	}
	return s.assets.Types(ctx)
}

// CreateAssetType implements #51.
func (s *Service) CreateAssetType(ctx context.Context, v Viewer, in assets.TypeInput) (assets.AssetType, error) {
	if !v.Can(PermAssets) {
		return assets.AssetType{}, apperr.ErrForbidden
	}
	return s.assets.CreateType(ctx, v.ID, in)
}

// UpdateAssetType implements #52.
func (s *Service) UpdateAssetType(ctx context.Context, v Viewer, id uuid.UUID, in assets.TypeInput) (assets.AssetType, error) {
	if !v.Can(PermAssets) {
		return assets.AssetType{}, apperr.ErrForbidden
	}
	return s.assets.UpdateType(ctx, v.ID, id, in)
}
