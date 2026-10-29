package users

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the authenticated user routes on /api/v1.
func RegisterRoutes(rg *gin.RouterGroup, c *Controller) {
	rg.GET("/me", c.Me)
}

// RegisterDevRoutes mounts dev/UAT-only routes on /api/v1/dev. main.go calls it
// only when the role switcher is enabled (D-005).
func RegisterDevRoutes(rg *gin.RouterGroup, c *Controller) {
	rg.GET("/demo-users", c.DemoUsers)
}
