package users

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
)

type Controller struct {
	svc      *Service
	envLabel string
}

func NewController(svc *Service, envLabel string) *Controller {
	return &Controller{svc: svc, envLabel: envLabel}
}

// MeFor builds the P1 payload for a user id (also used by the role switch response).
func (ctl *Controller) MeFor(ctx context.Context, u User) (MeResponse, error) {
	cats, err := ctl.svc.TechnicianCategoriesOf(ctx, u)
	if err != nil {
		return MeResponse{}, err
	}
	return NewMeResponse(u, cats, ctl.envLabel), nil
}

// Me handles GET /api/v1/me.
func (ctl *Controller) Me(c *gin.Context) {
	p, ok := middleware.CurrentUser(c)
	if !ok {
		httpx.Error(c, apperr.ErrUnauthenticated)
		return
	}
	u, err := ctl.svc.Get(c.Request.Context(), p.UserID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	me, err := ctl.MeFor(c.Request.Context(), u)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, me)
}

// DemoUsers handles GET /api/v1/dev/demo-users (dev/UAT only).
func (ctl *Controller) DemoUsers(c *gin.Context) {
	list, err := ctl.svc.DemoUsers(c.Request.Context())
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]DemoUserResponse, 0, len(list))
	for _, u := range list {
		out = append(out, DemoUserResponse{Role: u.Role, Name: u.DisplayName()})
	}
	httpx.OK(c, out)
}
