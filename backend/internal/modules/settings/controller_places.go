package settings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/assets"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
)

// Stage 4 handlers (#13, #15, #27, #46–#52).

// pathID reads :id; a malformed id is notFound.
func pathID(c *gin.Context, notFound error) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, notFound)
		return uuid.Nil, false
	}
	return id, true
}

// optionalID parses an optional id; a malformed one is `field: INVALID`.
func optionalID(fields map[string]string, field string, raw *string) *uuid.UUID {
	if raw == nil {
		return nil
	}
	id, err := uuid.Parse(*raw)
	if err != nil {
		fields[field] = "INVALID"
		return nil
	}
	return &id
}

// Buildings handles #13 GET /api/v1/settings/buildings.
func (ctl *Controller) Buildings(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	tree, err := ctl.svc.Buildings(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]PlanBuildingResponse, 0, len(tree))
	for _, b := range tree {
		out = append(out, newPlanBuildingResponse(b))
	}
	httpx.OK(c, out)
}

func bindRename(c *gin.Context) (RenameRequest, bool) {
	var req RenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return req, false
	}
	if req.UpdatedAt == nil {
		httpx.Error(c, apperr.Validation(map[string]string{"updatedAt": "REQUIRED"}))
		return req, false
	}
	return req, true
}

// UpdateBuilding handles #15 PATCH /api/v1/settings/buildings/{id} (rename, CR-005 building type).
func (ctl *Controller) UpdateBuilding(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, locations.ErrBuildingNotFound)
	if !ok {
		return
	}
	var req BuildingRequest
	if !bindJSON(c, &req) {
		return
	}
	fields := map[string]string{}
	if req.UpdatedAt == nil {
		fields["updatedAt"] = "REQUIRED"
	}
	if req.BuildingTypeID != nil && *req.BuildingTypeID == "" {
		fields["buildingTypeId"] = "REQUIRED"
	}
	var typeID *uuid.UUID
	if _, done := fields["buildingTypeId"]; !done {
		typeID = optionalID(fields, "buildingTypeId", req.BuildingTypeID)
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	b, err := ctl.svc.UpdateBuilding(c.Request.Context(), v, id, locations.BuildingInput{Name: req.Name, TypeID: typeID, UpdatedAt: *req.UpdatedAt})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newPlanBuildingResponse(b))
}

// RenameRoom handles #27 PATCH /api/v1/settings/rooms/{id}.
func (ctl *Controller) RenameRoom(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, locations.ErrRoomNotFound)
	if !ok {
		return
	}
	req, ok := bindRename(c)
	if !ok {
		return
	}
	r, err := ctl.svc.RenameRoom(c.Request.Context(), v, id, req.Name, *req.UpdatedAt)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newPlanRoomResponse(r))
}

// RoomAssets handles #46 GET /api/v1/settings/rooms/{id}/assets?q=&assetTypeId=&includeInactive=.
func (ctl *Controller) RoomAssets(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, locations.ErrRoomNotFound)
	if !ok {
		return
	}
	in := assets.ListInput{RoomID: id, Q: c.Query("q"), IncludeInactive: c.Query("includeInactive") == "true"}
	fields := map[string]string{}
	if raw := c.Query("assetTypeId"); raw != "" {
		in.AssetTypeID = optionalID(fields, "assetTypeId", &raw)
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	list, err := ctl.svc.RoomAssets(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]AssetAdminResponse, 0, len(list))
	for _, a := range list {
		out = append(out, newAssetAdminResponse(a))
	}
	httpx.OK(c, out)
}

func bindAsset(c *gin.Context) (assets.AssetInput, bool) {
	var req AssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return assets.AssetInput{}, false
	}
	fields := map[string]string{}
	in := assets.AssetInput{Code: req.Code, Name: req.Name, IsActive: req.IsActive,
		RoomID: optionalID(fields, "roomId", req.RoomID), AssetTypeID: optionalID(fields, "assetTypeId", req.AssetTypeID)}
	if req.UpdatedAt != nil {
		in.UpdatedAt = *req.UpdatedAt
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return in, false
	}
	return in, true
}

// CreateAsset handles #47 POST /api/v1/settings/assets.
func (ctl *Controller) CreateAsset(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	in, ok := bindAsset(c)
	if !ok {
		return
	}
	a, err := ctl.svc.CreateAsset(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newAssetAdminResponse(a)})
}

// UpdateAsset handles #48 PATCH /api/v1/settings/assets/{id}.
func (ctl *Controller) UpdateAsset(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, assets.ErrAssetNotFound)
	if !ok {
		return
	}
	in, ok := bindAsset(c)
	if !ok {
		return
	}
	a, err := ctl.svc.UpdateAsset(c.Request.Context(), v, id, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newAssetAdminResponse(a))
}

// LabelAssets handles #56 GET /api/v1/settings/assets/labels?buildingId=&floorId=&roomId=.
func (ctl *Controller) LabelAssets(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	fields := map[string]string{}
	f := assets.LabelFilter{}
	if raw := c.Query("buildingId"); raw == "" {
		fields["buildingId"] = "REQUIRED"
	} else if id := optionalID(fields, "buildingId", &raw); id != nil {
		f.BuildingID = *id
	}
	if raw := c.Query("floorId"); raw != "" {
		f.FloorID = optionalID(fields, "floorId", &raw)
	}
	if raw := c.Query("roomId"); raw != "" {
		f.RoomID = optionalID(fields, "roomId", &raw)
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	list, err := ctl.svc.LabelAssets(c.Request.Context(), v, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]LabelAssetResponse, 0, len(list))
	for _, a := range list {
		out = append(out, newLabelAssetResponse(a))
	}
	httpx.OK(c, out)
}

// MarkLabelsPrinted handles #57 POST /api/v1/settings/assets/labels/printed.
func (ctl *Controller) MarkLabelsPrinted(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req LabelsPrintedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return
	}
	if len(req.AssetIDs) > assets.MaxLabelsPerPrint {
		httpx.Error(c, apperr.Validation(map[string]string{"assetIds": "TOO_MANY"}))
		return
	}
	ids := make([]uuid.UUID, 0, len(req.AssetIDs))
	for _, raw := range req.AssetIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.Error(c, assets.ErrAssetNotActive) // an id that cannot exist is "unknown" (nothing saved)
			return
		}
		ids = append(ids, id)
	}
	list, err := ctl.svc.MarkLabelsPrinted(c.Request.Context(), v, ids)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]AssetAdminResponse, 0, len(list))
	for _, a := range list {
		out = append(out, newAssetAdminResponse(a))
	}
	httpx.OK(c, out)
}

// SuggestAssetCode handles #49 GET /api/v1/settings/assets/suggest-code?assetTypeId=&roomId=.
func (ctl *Controller) SuggestAssetCode(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	fields := map[string]string{}
	typeID, roomID := c.Query("assetTypeId"), c.Query("roomId")
	t, r := optionalID(fields, "assetTypeId", &typeID), optionalID(fields, "roomId", &roomID)
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	code, err := ctl.svc.SuggestAssetCode(c.Request.Context(), v, *t, *r)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, gin.H{"code": code})
}

// AssetTypes handles #50 GET /api/v1/settings/asset-types.
func (ctl *Controller) AssetTypes(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.AssetTypes(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]AssetTypeAdminResponse, 0, len(list))
	for _, t := range list {
		out = append(out, newAssetTypeAdminResponse(t))
	}
	httpx.OK(c, out)
}

func bindAssetType(c *gin.Context) (assets.TypeInput, bool) {
	var req AssetTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return assets.TypeInput{}, false
	}
	in := assets.TypeInput{Name: req.Name, CodePrefix: req.CodePrefix, Icon: req.Icon, Mount: req.Mount}
	if req.UpdatedAt != nil {
		in.UpdatedAt = *req.UpdatedAt
	}
	return in, true
}

// CreateAssetType handles #51 POST /api/v1/settings/asset-types.
func (ctl *Controller) CreateAssetType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	in, ok := bindAssetType(c)
	if !ok {
		return
	}
	t, err := ctl.svc.CreateAssetType(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newAssetTypeAdminResponse(t)})
}

// UpdateAssetType handles #52 PATCH /api/v1/settings/asset-types/{id}.
func (ctl *Controller) UpdateAssetType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, assets.ErrAssetTypeNotFound)
	if !ok {
		return
	}
	in, ok := bindAssetType(c)
	if !ok {
		return
	}
	t, err := ctl.svc.UpdateAssetType(c.Request.Context(), v, id, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newAssetTypeAdminResponse(t))
}
