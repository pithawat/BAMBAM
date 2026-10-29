package settings

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/modules/repair"
	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
)

// Stage 5 handlers (#32–#45).

func bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		httpx.Error(c, errMalformedBody)
		return false
	}
	return true
}

func at(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}

func bindOrder(c *gin.Context) ([]uuid.UUID, time.Time, bool) {
	var req OrderRequest
	if !bindJSON(c, &req) {
		return nil, time.Time{}, false
	}
	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, raw := range req.IDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.Error(c, apperr.Validation(map[string]string{"ids": "INVALID"}))
			return nil, time.Time{}, false
		}
		ids = append(ids, id)
	}
	if req.Version == nil {
		httpx.Error(c, apperr.Validation(map[string]string{"version": "REQUIRED"}))
		return nil, time.Time{}, false
	}
	return ids, *req.Version, true
}

func categoriesOut(list []repair.CategoryAdmin) []CategoryResponse {
	out := make([]CategoryResponse, 0, len(list))
	for _, x := range list {
		out = append(out, newCategoryResponse(x))
	}
	return out
}

func symptomsOut(list []repair.SymptomAdmin) []SymptomResponse {
	out := make([]SymptomResponse, 0, len(list))
	for _, x := range list {
		out = append(out, newSymptomResponse(x))
	}
	return out
}

// Categories handles #32.
func (ctl *Controller) Categories(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.Categories(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, categoriesOut(list))
}

func categoryInput(req CategoryRequest) repair.CategoryInput {
	return repair.CategoryInput{Name: req.Name, Icon: req.Icon, DefaultPriority: req.DefaultPriority, IsActive: req.IsActive, UpdatedAt: at(req.UpdatedAt)}
}

// CreateCategory handles #33.
func (ctl *Controller) CreateCategory(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req CategoryRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.CreateCategory(c.Request.Context(), v, categoryInput(req))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newCategoryResponse(x)})
}

// UpdateCategory handles #34.
func (ctl *Controller) UpdateCategory(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrCategoryNotFound)
	if !ok {
		return
	}
	var req CategoryRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.UpdateCategory(c.Request.Context(), v, id, categoryInput(req))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newCategoryResponse(x))
}

// DeleteCategory handles #35.
func (ctl *Controller) DeleteCategory(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrCategoryNotFound)
	if !ok {
		return
	}
	if err := ctl.svc.DeleteCategory(c.Request.Context(), v, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ReorderCategories handles #36.
func (ctl *Controller) ReorderCategories(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	ids, version, ok := bindOrder(c)
	if !ok {
		return
	}
	list, err := ctl.svc.ReorderCategories(c.Request.Context(), v, ids, version)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, categoriesOut(list))
}

// Symptoms handles #37.
func (ctl *Controller) Symptoms(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrCategoryNotFound)
	if !ok {
		return
	}
	list, err := ctl.svc.Symptoms(c.Request.Context(), v, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, symptomsOut(list))
}

func symptomInput(req SymptomRequest) repair.SymptomInput {
	return repair.SymptomInput{Name: req.Name, Priority: req.Priority, IsActive: req.IsActive, UpdatedAt: at(req.UpdatedAt)}
}

// CreateSymptom handles #38.
func (ctl *Controller) CreateSymptom(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrCategoryNotFound)
	if !ok {
		return
	}
	var req SymptomRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.CreateSymptom(c.Request.Context(), v, id, symptomInput(req))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newSymptomResponse(x)})
}

// UpdateSymptom handles #39.
func (ctl *Controller) UpdateSymptom(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrSymptomNotFound)
	if !ok {
		return
	}
	var req SymptomRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.UpdateSymptom(c.Request.Context(), v, id, symptomInput(req))
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newSymptomResponse(x))
}

// DeleteSymptom handles #40.
func (ctl *Controller) DeleteSymptom(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrSymptomNotFound)
	if !ok {
		return
	}
	if err := ctl.svc.DeleteSymptom(c.Request.Context(), v, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ReorderSymptoms handles #41.
func (ctl *Controller) ReorderSymptoms(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrCategoryNotFound)
	if !ok {
		return
	}
	ids, version, ok := bindOrder(c)
	if !ok {
		return
	}
	list, err := ctl.svc.ReorderSymptoms(c.Request.Context(), v, id, ids, version)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, symptomsOut(list))
}

// ContractorTypes handles #42.
func (ctl *Controller) ContractorTypes(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.ContractorTypes(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]ContractorTypeResponse, 0, len(list))
	for _, x := range list {
		out = append(out, newContractorTypeResponse(x))
	}
	httpx.OK(c, out)
}

// CreateContractorType handles #43.
func (ctl *Controller) CreateContractorType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req ContractorTypeRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.CreateContractorType(c.Request.Context(), v, repair.ContractorTypeInput{Name: req.Name})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newContractorTypeResponse(x)})
}

// UpdateContractorType handles #44.
func (ctl *Controller) UpdateContractorType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrContractorTypeGone)
	if !ok {
		return
	}
	var req ContractorTypeRequest
	if !bindJSON(c, &req) {
		return
	}
	x, err := ctl.svc.UpdateContractorType(c.Request.Context(), v, id, repair.ContractorTypeInput{Name: req.Name, IsActive: req.IsActive, UpdatedAt: at(req.UpdatedAt)})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newContractorTypeResponse(x))
}

// DeleteContractorType handles #45.
func (ctl *Controller) DeleteContractorType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := pathID(c, repair.ErrContractorTypeGone)
	if !ok {
		return
	}
	if err := ctl.svc.DeleteContractorType(c.Request.Context(), v, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
