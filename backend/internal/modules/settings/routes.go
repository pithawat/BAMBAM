package settings

import (
	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
)

// route is one row of the endpoint table in 04-api-contract.md: path under /api/v1/settings and
// the permissions that may call it (any of them).
type route struct {
	no      string
	method  string
	path    string
	perms   []string
	handler func(*Controller) gin.HandlerFunc
}

var routes = []route{
	{"2", "GET", "/roles", []string{PermRoles, PermUsers}, func(c *Controller) gin.HandlerFunc { return c.Roles }},
	{"3", "POST", "/roles", []string{PermRoles}, func(c *Controller) gin.HandlerFunc { return c.CreateRole }},
	{"4", "PATCH", "/roles/:id", []string{PermRoles}, func(c *Controller) gin.HandlerFunc { return c.UpdateRole }},
	{"5", "DELETE", "/roles/:id", []string{PermRoles}, func(c *Controller) gin.HandlerFunc { return c.DeleteRole }},
	{"6", "GET", "/permissions", []string{PermRoles}, func(c *Controller) gin.HandlerFunc { return c.Matrix }},
	{"7", "PUT", "/permissions", []string{PermRoles}, func(c *Controller) gin.HandlerFunc { return c.SaveMatrix }},
	{"8", "GET", "/users", []string{PermUsers}, func(c *Controller) gin.HandlerFunc { return c.Users }},
	{"9", "GET", "/users/:id", []string{PermUsers}, func(c *Controller) gin.HandlerFunc { return c.User }},
	{"10", "PUT", "/users/:id/role", []string{PermUsers}, func(c *Controller) gin.HandlerFunc { return c.ChangeUserRole }},
	{"11", "GET", "/audit", []string{PermAudit}, func(c *Controller) gin.HandlerFunc { return c.Audit }},
	{"12", "GET", "/audit/actors", []string{PermAudit}, func(c *Controller) gin.HandlerFunc { return c.AuditActors }},
	{"13", "GET", "/buildings", []string{PermLocations, PermAssets}, func(c *Controller) gin.HandlerFunc { return c.Buildings }},
	{"15", "PATCH", "/buildings/:id", []string{PermLocations}, func(c *Controller) gin.HandlerFunc { return c.UpdateBuilding }},
	{"27", "PATCH", "/rooms/:id", []string{PermLocations}, func(c *Controller) gin.HandlerFunc { return c.RenameRoom }},
	{"32", "GET", "/categories", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.Categories }},
	{"33", "POST", "/categories", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.CreateCategory }},
	{"34", "PATCH", "/categories/:id", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.UpdateCategory }},
	{"35", "DELETE", "/categories/:id", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.DeleteCategory }},
	{"36", "PUT", "/categories/order", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.ReorderCategories }},
	{"37", "GET", "/categories/:id/symptoms", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.Symptoms }},
	{"38", "POST", "/categories/:id/symptoms", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.CreateSymptom }},
	{"39", "PATCH", "/symptoms/:id", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.UpdateSymptom }},
	{"40", "DELETE", "/symptoms/:id", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.DeleteSymptom }},
	{"41", "PUT", "/categories/:id/symptoms/order", []string{PermCategories}, func(c *Controller) gin.HandlerFunc { return c.ReorderSymptoms }},
	{"42", "GET", "/contractor-types", []string{PermContractorTypes}, func(c *Controller) gin.HandlerFunc { return c.ContractorTypes }},
	{"43", "POST", "/contractor-types", []string{PermContractorTypes}, func(c *Controller) gin.HandlerFunc { return c.CreateContractorType }},
	{"44", "PATCH", "/contractor-types/:id", []string{PermContractorTypes}, func(c *Controller) gin.HandlerFunc { return c.UpdateContractorType }},
	{"45", "DELETE", "/contractor-types/:id", []string{PermContractorTypes}, func(c *Controller) gin.HandlerFunc { return c.DeleteContractorType }},
	{"46", "GET", "/rooms/:id/assets", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.RoomAssets }},
	{"47", "POST", "/assets", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.CreateAsset }},
	{"48", "PATCH", "/assets/:id", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.UpdateAsset }},
	{"49", "GET", "/assets/suggest-code", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.SuggestAssetCode }},
	{"50", "GET", "/asset-types", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.AssetTypes }},
	{"51", "POST", "/asset-types", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.CreateAssetType }},
	{"52", "PATCH", "/asset-types/:id", []string{PermAssets}, func(c *Controller) gin.HandlerFunc { return c.UpdateAssetType }},
	{"53", "GET", "/building-types", []string{PermLocations, PermCategories}, func(c *Controller) gin.HandlerFunc { return c.BuildingTypes }},
	{"54", "POST", "/building-types", []string{PermLocations}, func(c *Controller) gin.HandlerFunc { return c.CreateBuildingType }},
	{"55", "PATCH", "/building-types/:id", []string{PermLocations}, func(c *Controller) gin.HandlerFunc { return c.UpdateBuildingType }},
}

// RegisterRoutes mounts the module on /api/v1/settings (behind the auth guard). Each route checks
// its own settings permission (CR-001); services check again.
func RegisterRoutes(rg *gin.RouterGroup, c *Controller) {
	for _, r := range routes {
		rg.Handle(r.method, r.path, middleware.RequirePermission(r.perms...), r.handler(c))
	}
}
