package settings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
)

// Stage 4P handlers (#53–#55, CR-005).

// BuildingTypes handles #53 GET /api/v1/settings/building-types.
func (ctl *Controller) BuildingTypes(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.BuildingTypes(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]BuildingTypeAdminResponse, 0, len(list))
	for _, t := range list {
		out = append(out, newBuildingTypeAdminResponse(t))
	}
	httpx.OK(c, out)
}

// CreateBuildingType handles #54 POST /api/v1/settings/building-types.
func (ctl *Controller) CreateBuildingType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req BuildingTypeRequest
	if !bindJSON(c, &req) {
		return
	}
	ids, ok := idList(c, "categoryIds", req.CategoryIDs)
	if !ok {
		return
	}
	var categoryIDs []uuid.UUID
	if ids != nil {
		categoryIDs = *ids
	}
	name := ""
	if req.Name != nil {
		name = *req.Name
	}
	t, err := ctl.svc.CreateBuildingType(c.Request.Context(), v, name, categoryIDs)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newBuildingTypeAdminResponse(t)})
}

// UpdateBuildingType handles #55 PATCH /api/v1/settings/building-types/{id}.
func (ctl *Controller) UpdateBuildingType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, locations.ErrTypeNotFound)
	if !ok {
		return
	}
	var req BuildingTypeRequest
	if !bindJSON(c, &req) {
		return
	}
	if req.UpdatedAt == nil {
		httpx.Error(c, apperr.Validation(map[string]string{"updatedAt": "REQUIRED"}))
		return
	}
	t, err := ctl.svc.UpdateBuildingType(c.Request.Context(), v, id, locations.TypeInput{Name: req.Name, IsActive: req.IsActive, UpdatedAt: *req.UpdatedAt})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newBuildingTypeAdminResponse(t))
}
