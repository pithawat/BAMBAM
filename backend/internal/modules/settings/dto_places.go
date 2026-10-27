package settings

import (
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/platform/assets"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

// ---- Stage 4: plan locations, assets, asset types (F26) — 04-api-contract.md "Stage 4" ----

// PlanBuildingResponse = `PlanBuilding`.
type PlanBuildingResponse struct {
	ID        string              `json:"id"`
	Name      string              `json:"name"`
	UpdatedAt time.Time           `json:"updatedAt"`
	UpdatedBy *people.Ref         `json:"updatedBy"`
	Floors    []PlanFloorResponse `json:"floors"`
}

type PlanFloorResponse struct {
	ID    string             `json:"id"`
	Name  string             `json:"name"`
	Level int32              `json:"level"`
	Rooms []PlanRoomResponse `json:"rooms"`
}

type PlanRoomResponse struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	AreaType         string      `json:"areaType"`
	IsCommonArea     bool        `json:"isCommonArea"`
	ActiveAssetCount int64       `json:"activeAssetCount"`
	UpdatedAt        time.Time   `json:"updatedAt"`
	UpdatedBy        *people.Ref `json:"updatedBy"`
}

func newPlanRoomResponse(r locations.Room) PlanRoomResponse {
	return PlanRoomResponse{ID: r.ID.String(), Name: r.Name, AreaType: r.AreaType, IsCommonArea: r.AreaType == locations.AreaCommon,
		ActiveAssetCount: r.ActiveAssetCount, UpdatedAt: r.UpdatedAt.UTC(), UpdatedBy: r.UpdatedBy}
}

func newPlanBuildingResponse(b locations.Building) PlanBuildingResponse {
	out := PlanBuildingResponse{ID: b.ID.String(), Name: b.Name, UpdatedAt: b.UpdatedAt.UTC(), UpdatedBy: b.UpdatedBy, Floors: make([]PlanFloorResponse, 0, len(b.Floors))}
	for _, f := range b.Floors {
		fr := PlanFloorResponse{ID: f.ID.String(), Name: f.Name, Level: f.Level, Rooms: make([]PlanRoomResponse, 0, len(f.Rooms))}
		for _, r := range f.Rooms {
			fr.Rooms = append(fr.Rooms, newPlanRoomResponse(r))
		}
		out.Floors = append(out.Floors, fr)
	}
	return out
}

// RenameRequest is #15 / #27.
type RenameRequest struct {
	Name      string     `json:"name"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

// AssetAdminResponse = `AssetAdmin`.
type AssetAdminResponse struct {
	ID              string           `json:"id"`
	Code            string           `json:"code"`
	Name            string           `json:"name"`
	IsActive        bool             `json:"isActive"`
	Type            AssetTypeRefResp `json:"type"`
	RoomID          string           `json:"roomId"`
	Placed          bool             `json:"placed"`
	OpenTicketCount int64            `json:"openTicketCount"`
	UpdatedAt       time.Time        `json:"updatedAt"`
	UpdatedBy       *people.Ref      `json:"updatedBy"`
}

type AssetTypeRefResp struct {
	ID   string `json:"id"`
	Key  string `json:"key"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}

func newAssetAdminResponse(a assets.Asset) AssetAdminResponse {
	return AssetAdminResponse{ID: a.ID.String(), Code: a.Code, Name: a.Name, IsActive: a.IsActive,
		Type:   AssetTypeRefResp{ID: a.Type.ID.String(), Key: a.Type.Key, Name: a.Type.Name, Icon: a.Type.Icon},
		RoomID: a.RoomID.String(), Placed: a.Placed, OpenTicketCount: a.OpenTicketCount, UpdatedAt: a.UpdatedAt.UTC(), UpdatedBy: a.UpdatedBy}
}

// AssetRequest is #47 (all fields) and #48 (only the changing ones + updatedAt).
type AssetRequest struct {
	RoomID      *string    `json:"roomId"`
	AssetTypeID *string    `json:"assetTypeId"`
	Code        *string    `json:"code"`
	Name        *string    `json:"name"`
	IsActive    *bool      `json:"isActive"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// AssetTypeAdminResponse = `AssetTypeAdmin`.
type AssetTypeAdminResponse struct {
	ID               string      `json:"id"`
	Key              string      `json:"key"`
	Name             string      `json:"name"`
	CodePrefix       string      `json:"codePrefix"`
	Icon             string      `json:"icon"`
	Mount            string      `json:"mount"`
	SortOrder        int32       `json:"sortOrder"`
	ActiveAssetCount int64       `json:"activeAssetCount"`
	UpdatedAt        time.Time   `json:"updatedAt"`
	UpdatedBy        *people.Ref `json:"updatedBy"`
}

func newAssetTypeAdminResponse(t assets.AssetType) AssetTypeAdminResponse {
	return AssetTypeAdminResponse{ID: t.ID.String(), Key: t.Key, Name: t.Name, CodePrefix: t.CodePrefix, Icon: t.Icon, Mount: t.Mount,
		SortOrder: t.SortOrder, ActiveAssetCount: t.ActiveAssetCount, UpdatedAt: t.UpdatedAt.UTC(), UpdatedBy: t.UpdatedBy}
}

// AssetTypeRequest is #51 / #52.
type AssetTypeRequest struct {
	Name       *string    `json:"name"`
	CodePrefix *string    `json:"codePrefix"`
	Icon       *string    `json:"icon"`
	Mount      *string    `json:"mount"`
	UpdatedAt  *time.Time `json:"updatedAt"`
}
