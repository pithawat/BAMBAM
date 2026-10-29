package auth

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts the public auth routes. They live under /api/auth on the
// frontend origin (Next.js rewrites /api/* to this API) so the registered
// redirect URI http://localhost:3000/api/auth/callback/rmc-sso reaches Go.
func RegisterRoutes(r *gin.Engine, h *Handler) {
	g := r.Group("/api/auth")
	g.GET("/login", h.Login)
	g.GET("/callback/rmc-sso", h.Callback)
	g.POST("/logout", h.Logout)
	r.GET("/health/ready", h.Ready)
}

// RegisterDevRoutes mounts the role switch on the authenticated /api/v1/dev group.
func RegisterDevRoutes(rg *gin.RouterGroup, h *Handler) {
	rg.POST("/role-switch", h.RoleSwitch)
}
