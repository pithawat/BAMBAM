package settings

import (
	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
)

type Controller struct {
	svc *Service
}

func NewController(svc *Service) *Controller {
	return &Controller{svc: svc}
}

func viewer(c *gin.Context) (Viewer, bool) {
	p, ok := middleware.CurrentUser(c)
	if !ok {
		httpx.Error(c, apperr.ErrUnauthenticated)
		return Viewer{}, false
	}
	return Viewer{ID: p.UserID, Permissions: p.Permissions}, true
}

// Roles handles #2 GET /api/v1/settings/roles.
func (ctl *Controller) Roles(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.Roles(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]RoleResponse, 0, len(list))
	for _, r := range list {
		out = append(out, newRoleResponse(r))
	}
	httpx.OK(c, out)
}

// notBuilt answers a route of a later stage after its permission check passed (501 NOT_IMPLEMENTED).
func notBuilt(c *gin.Context) { httpx.Error(c, apperr.ErrNotImplemented) }
