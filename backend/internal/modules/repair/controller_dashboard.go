package repair

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
)

// CR-016: dashboard (#27), floor plans (#30) and equipment (#29, #31–#34).

// Overview handles #27 GET /repair/admin/overview.
func (ctl *Controller) Overview(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	o, err := ctl.svc.Overview(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toOverviewDTO(o))
}

// AssetTypes handles #29 GET /repair/asset-types.
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
	httpx.OK(c, toAssetTypeDTOs(list))
}

// FloorPlan handles #30 GET /repair/floors/{id}/plan.
func (ctl *Controller) FloorPlan(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrFloorNotFound)
		return
	}
	p, err := ctl.svc.FloorPlan(c.Request.Context(), v, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toFloorPlanDTO(p))
}

// parseAsset maps the #31 / #32 body; a malformed id is a field error.
func parseAsset(c *gin.Context, withType bool) (AssetInput, bool) {
	var req AssetRequest
	if !bindJSON(c, &req) {
		return AssetInput{}, false
	}
	fields := map[string]string{}
	in := AssetInput{Code: req.Code, Name: req.Name, X: req.X, Z: req.Z, RotationDeg: req.RotationDeg}
	if id := parseOptionalID(req.RoomID, "roomId", fields); id != nil {
		in.RoomID = *id
	}
	if withType {
		if id := parseOptionalID(req.AssetTypeID, "assetTypeId", fields); id != nil {
			in.AssetTypeID = *id
		}
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return AssetInput{}, false
	}
	return in, true
}

// assetAction parses the viewer and the asset id of #32 / #33.
func assetAction(c *gin.Context) (Viewer, uuid.UUID, bool) {
	v, ok := viewer(c)
	if !ok {
		return Viewer{}, uuid.Nil, false
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrAssetNotFound)
		return Viewer{}, uuid.Nil, false
	}
	return v, id, true
}

// CreateAsset handles #31 POST /repair/assets.
func (ctl *Controller) CreateAsset(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	in, ok := parseAsset(c, true)
	if !ok {
		return
	}
	a, err := ctl.svc.CreateAsset(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": toPlacedAssetDTO(a)})
}

// UpdateAsset handles #32 PUT /repair/assets/{id}.
func (ctl *Controller) UpdateAsset(c *gin.Context) {
	v, id, ok := assetAction(c)
	if !ok {
		return
	}
	in, ok := parseAsset(c, false)
	if !ok {
		return
	}
	a, err := ctl.svc.UpdateAsset(c.Request.Context(), v, id, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toPlacedAssetDTO(a))
}

// DeactivateAsset handles #33 POST /repair/assets/{id}/deactivate.
func (ctl *Controller) DeactivateAsset(c *gin.Context) {
	v, id, ok := assetAction(c)
	if !ok {
		return
	}
	if err := ctl.svc.DeactivateAsset(c.Request.Context(), v, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// SuggestAssetCode handles #34 GET /repair/assets/suggest-code?assetTypeId=&floorId=.
func (ctl *Controller) SuggestAssetCode(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	fields := map[string]string{}
	typeID := requiredID(c.Query("assetTypeId"), "assetTypeId", fields)
	floorID := requiredID(c.Query("floorId"), "floorId", fields)
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	code, err := ctl.svc.SuggestAssetCode(c.Request.Context(), v, typeID, floorID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, SuggestCodeDTO{Code: code})
}

func requiredID(s, field string, fields map[string]string) uuid.UUID {
	id := parseOptionalID(s, field, fields)
	if id == nil {
		if fields[field] == "" {
			fields[field] = "REQUIRED"
		}
		return uuid.Nil
	}
	return *id
}
