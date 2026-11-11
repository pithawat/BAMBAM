package settings

import (
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/modules/repair"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

// ---- Stage 5: categories, symptoms, contractor types — 04-api-contract.md "Stage 5" ----

// MasterItemResponse = `MasterItem`.
type MasterItemResponse struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	IsActive  bool        `json:"isActive"`
	InUse     bool        `json:"inUse"`
	UpdatedAt time.Time   `json:"updatedAt"`
	UpdatedBy *people.Ref `json:"updatedBy"`
}

func masterItem(id, name string, m repair.MasterMeta) MasterItemResponse {
	return MasterItemResponse{ID: id, Name: name, IsActive: m.IsActive, InUse: m.InUse, UpdatedAt: m.UpdatedAt.UTC(), UpdatedBy: m.UpdatedBy}
}

// CategoryResponse = `Category` (+ CR-008 defaultPriority, CR-014 isOther, CR-005 buildingTypeIds).
type CategoryResponse struct {
	MasterItemResponse
	Icon               string   `json:"icon"`
	SortOrder          int32    `json:"sortOrder"`
	DefaultPriority    string   `json:"defaultPriority"`
	IsOther            bool     `json:"isOther"`
	BuildingTypeIDs    []string `json:"buildingTypeIds"`
	SymptomCount       int64    `json:"symptomCount"`
	ActiveSymptomCount int64    `json:"activeSymptomCount"`
}

func newCategoryResponse(c repair.CategoryAdmin) CategoryResponse {
	return CategoryResponse{MasterItemResponse: masterItem(c.ID.String(), c.Name, c.MasterMeta), Icon: c.Icon, SortOrder: c.SortOrder,
		DefaultPriority: c.DefaultPriority, IsOther: c.IsOther, BuildingTypeIDs: idStrings(c.BuildingTypeIDs), SymptomCount: c.SymptomCount, ActiveSymptomCount: c.ActiveSymptomCount}
}

// SymptomResponse = `MasterItem` + sortOrder + priority (CR-008).
type SymptomResponse struct {
	MasterItemResponse
	CategoryID string `json:"categoryId"`
	SortOrder  int32  `json:"sortOrder"`
	Priority   string `json:"priority"`
}

func newSymptomResponse(s repair.SymptomAdmin) SymptomResponse {
	return SymptomResponse{MasterItemResponse: masterItem(s.ID.String(), s.Name, s.MasterMeta), CategoryID: s.CategoryID.String(), SortOrder: s.SortOrder, Priority: s.Priority}
}

// ContractorTypeResponse = `ContractorTypeAdmin`.
type ContractorTypeResponse struct {
	MasterItemResponse
	ContractorCount     int64       `json:"contractorCount"`
	CreatedAt           time.Time   `json:"createdAt"`
	CreatedBy           *people.Ref `json:"createdBy"`
	CreatedByTechnician bool        `json:"createdByTechnician"`
}

func newContractorTypeResponse(t repair.ContractorTypeAdmin) ContractorTypeResponse {
	return ContractorTypeResponse{MasterItemResponse: masterItem(t.ID.String(), t.Name, t.MasterMeta), ContractorCount: t.ContractorCount,
		CreatedAt: t.CreatedAt.UTC(), CreatedBy: t.CreatedBy, CreatedByTechnician: t.CreatedByTechnician}
}

// CategoryRequest is #33 / #34 (PATCH: only the changing fields + updatedAt).
type CategoryRequest struct {
	Name            *string    `json:"name"`
	Icon            *string    `json:"icon"`
	DefaultPriority *string    `json:"defaultPriority"`
	BuildingTypeIDs *[]string  `json:"buildingTypeIds"`
	IsActive        *bool      `json:"isActive"`
	UpdatedAt       *time.Time `json:"updatedAt"`
}

// SymptomRequest is #38 / #39.
type SymptomRequest struct {
	Name      *string    `json:"name"`
	Priority  *string    `json:"priority"`
	IsActive  *bool      `json:"isActive"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

// ContractorTypeRequest is #43 / #44.
type ContractorTypeRequest struct {
	Name      *string    `json:"name"`
	IsActive  *bool      `json:"isActive"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

// OrderRequest is the contract's "Order body".
type OrderRequest struct {
	IDs     []string   `json:"ids"`
	Version *time.Time `json:"version"`
}
