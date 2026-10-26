package settings

import (
	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
)

// route is one row of the endpoint table in 04-api-contract.md: path under /api/v1/settings and
// the permissions that may call it (any of them). Routes of later stages are mounted with their
// permission now and answer 501 until their stage replaces notBuilt.
type route struct {
	no      string
	method  string
	path    string
	perms   []string
	handler func(*Controller) gin.HandlerFunc
}

func later(*Controller) gin.HandlerFunc { return notBuilt }

var routes = []route{
	{"2", "GET", "/roles", []string{PermRoles, PermUsers}, func(c *Controller) gin.HandlerFunc { return c.Roles }},
	{"3", "POST", "/roles", []string{PermRoles}, later},
	{"4", "PATCH", "/roles/:id", []string{PermRoles}, later},
	{"5", "DELETE", "/roles/:id", []string{PermRoles}, later},
	{"6", "GET", "/permissions", []string{PermRoles}, later},
	{"7", "PUT", "/permissions", []string{PermRoles}, later},
	{"8", "GET", "/users", []string{PermUsers}, later},
	{"9", "GET", "/users/:id", []string{PermUsers}, later},
	{"10", "PUT", "/users/:id/role", []string{PermUsers}, later},
	{"11", "GET", "/audit", []string{PermAudit}, later},
	{"12", "GET", "/audit/actors", []string{PermAudit}, later},
	{"13", "GET", "/buildings", []string{PermLocations, PermAssets}, later},
	{"15", "PATCH", "/buildings/:id", []string{PermLocations}, later},
	{"27", "PATCH", "/rooms/:id", []string{PermLocations}, later},
	{"32", "GET", "/categories", []string{PermCategories}, later},
	{"33", "POST", "/categories", []string{PermCategories}, later},
	{"34", "PATCH", "/categories/:id", []string{PermCategories}, later},
	{"35", "DELETE", "/categories/:id", []string{PermCategories}, later},
	{"36", "PUT", "/categories/order", []string{PermCategories}, later},
	{"37", "GET", "/categories/:id/symptoms", []string{PermCategories}, later},
	{"38", "POST", "/categories/:id/symptoms", []string{PermCategories}, later},
	{"39", "PATCH", "/symptoms/:id", []string{PermCategories}, later},
	{"40", "DELETE", "/symptoms/:id", []string{PermCategories}, later},
	{"41", "PUT", "/categories/:id/symptoms/order", []string{PermCategories}, later},
	{"42", "GET", "/contractor-types", []string{PermContractorTypes}, later},
	{"43", "POST", "/contractor-types", []string{PermContractorTypes}, later},
	{"44", "PATCH", "/contractor-types/:id", []string{PermContractorTypes}, later},
	{"45", "DELETE", "/contractor-types/:id", []string{PermContractorTypes}, later},
	{"46", "GET", "/rooms/:id/assets", []string{PermAssets}, later},
	{"47", "POST", "/assets", []string{PermAssets}, later},
	{"48", "PATCH", "/assets/:id", []string{PermAssets}, later},
	{"49", "GET", "/assets/suggest-code", []string{PermAssets}, later},
	{"50", "GET", "/asset-types", []string{PermAssets}, later},
	{"51", "POST", "/asset-types", []string{PermAssets}, later},
	{"52", "PATCH", "/asset-types/:id", []string{PermAssets}, later},
}

// RegisterRoutes mounts the module on /api/v1/settings (behind the auth guard). Each route checks
// its own settings permission (CR-001); services check again.
func RegisterRoutes(rg *gin.RouterGroup, c *Controller) {
	for _, r := range routes {
		rg.Handle(r.method, r.path, middleware.RequirePermission(r.perms...), r.handler(c))
	}
}
