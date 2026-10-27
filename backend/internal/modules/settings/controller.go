package settings

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

type Controller struct {
	svc *Service
}

func NewController(svc *Service) *Controller {
	return &Controller{svc: svc}
}

var errMalformedBody = apperr.New(apperr.KindInvalid, "VALIDATION_FAILED", "malformed JSON body")

func viewer(c *gin.Context) (Viewer, bool) {
	p, ok := middleware.CurrentUser(c)
	if !ok {
		httpx.Error(c, apperr.ErrUnauthenticated)
		return Viewer{}, false
	}
	return Viewer{ID: p.UserID, Permissions: p.Permissions}, true
}

// roleID reads the :id path param; a malformed id is an unknown role.
func roleID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, roles.ErrRoleNotFound)
		return uuid.Nil, false
	}
	return id, true
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

// CreateRole handles #3 POST /api/v1/settings/roles.
func (ctl *Controller) CreateRole(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return
	}
	in := roles.CreateInput{Name: req.Name, Description: req.Description}
	if req.CopyFromRoleID != nil && *req.CopyFromRoleID != "" {
		id, err := uuid.Parse(*req.CopyFromRoleID)
		if err != nil {
			httpx.Error(c, apperr.Validation(map[string]string{"copyFromRoleId": "INVALID"}))
			return
		}
		in.CopyFrom = &id
	}
	r, err := ctl.svc.CreateRole(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": newRoleResponse(r)})
}

// UpdateRole handles #4 PATCH /api/v1/settings/roles/{id}.
func (ctl *Controller) UpdateRole(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := roleID(c)
	if !ok {
		return
	}
	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return
	}
	in := roles.UpdateInput{Name: req.Name, Description: req.Description}
	if req.UpdatedAt != nil {
		in.UpdatedAt = *req.UpdatedAt
	}
	r, err := ctl.svc.UpdateRole(c.Request.Context(), v, id, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newRoleResponse(r))
}

// DeleteRole handles #5 DELETE /api/v1/settings/roles/{id}.
func (ctl *Controller) DeleteRole(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := roleID(c)
	if !ok {
		return
	}
	if err := ctl.svc.DeleteRole(c.Request.Context(), v, id); err != nil {
		httpx.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// Matrix handles #6 GET /api/v1/settings/permissions.
func (ctl *Controller) Matrix(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	m, err := ctl.svc.Matrix(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newMatrixResponse(m))
}

// SaveMatrix handles #7 PUT /api/v1/settings/permissions.
func (ctl *Controller) SaveMatrix(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req SaveMatrixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return
	}
	changes := make([]roles.Change, 0, len(req.Changes))
	for _, ch := range req.Changes {
		id, err := uuid.Parse(ch.RoleID)
		if err != nil {
			httpx.Error(c, apperr.Validation(map[string]string{"changes": "INVALID"}))
			return
		}
		changes = append(changes, roles.Change{RoleID: id, Permission: ch.Permission, Granted: ch.Granted})
	}
	m, err := ctl.svc.SaveMatrix(c.Request.Context(), v, req.Version, changes)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newMatrixResponse(m))
}

// userID reads the :id path param; a malformed id is an unknown user.
func userID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, users.ErrUserNotFound)
		return uuid.Nil, false
	}
	return id, true
}

// Users handles #8 GET /api/v1/settings/users?q=&roleId=&page=&pageSize=.
func (ctl *Controller) Users(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	page, size := httpx.Page(c)
	in := users.SearchInput{Q: c.Query("q"), Page: page, PageSize: size}
	if raw := c.Query("roleId"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.Error(c, apperr.Validation(map[string]string{"roleId": "INVALID"}))
			return
		}
		in.RoleID = &id
	}
	list, total, err := ctl.svc.SearchUsers(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]UserSummaryResponse, 0, len(list))
	for _, u := range list {
		out = append(out, newUserSummaryResponse(u))
	}
	httpx.List(c, out, httpx.Meta{Page: page, PageSize: size, Total: total})
}

// User handles #9 GET /api/v1/settings/users/{id}.
func (ctl *Controller) User(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := userID(c)
	if !ok {
		return
	}
	d, err := ctl.svc.User(c.Request.Context(), v, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newUserDetailResponse(d))
}

// ChangeUserRole handles #10 PUT /api/v1/settings/users/{id}/role.
func (ctl *Controller) ChangeUserRole(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := userID(c)
	if !ok {
		return
	}
	var req ChangeUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, errMalformedBody)
		return
	}
	roleID, err := uuid.Parse(req.RoleID)
	if err != nil {
		httpx.Error(c, apperr.Validation(map[string]string{"roleId": "REQUIRED"}))
		return
	}
	s, err := ctl.svc.ChangeUserRole(c.Request.Context(), v, id, roleID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, newUserSummaryResponse(s))
}

// Audit handles #11 GET /api/v1/settings/audit?type=&actorId=&from=&to=&q=&page=&pageSize=50.
func (ctl *Controller) Audit(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	fields := map[string]string{}
	types, known := audit.TypesFor(c.Query("type"))
	if !known {
		fields["type"] = "INVALID"
	}
	f := audit.Filter{Types: types, Page: 1, PageSize: 50}
	page, size := httpx.Page(c)
	f.Page = page
	if c.Query("pageSize") != "" {
		f.PageSize = size
	}
	if raw := c.Query("actorId"); raw != "" {
		if id, err := uuid.Parse(raw); err == nil {
			f.ActorID = &id
		} else {
			fields["actorId"] = "INVALID"
		}
	}
	for _, t := range []struct {
		key string
		dst **time.Time
	}{{"from", &f.From}, {"to", &f.To}} {
		if raw := c.Query(t.key); raw != "" {
			if at, err := time.Parse(time.RFC3339, raw); err == nil {
				*t.dst = &at
			} else {
				fields[t.key] = "INVALID"
			}
		}
	}
	if q := c.Query("q"); q != "" {
		f.Q = &q
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	list, total, err := ctl.svc.Audit(c.Request.Context(), v, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	out := make([]AuditEntryResponse, 0, len(list))
	for _, i := range list {
		out = append(out, newAuditEntryResponse(i))
	}
	httpx.List(c, out, httpx.Meta{Page: f.Page, PageSize: f.PageSize, Total: total})
}

// AuditActors handles #12 GET /api/v1/settings/audit/actors.
func (ctl *Controller) AuditActors(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	list, err := ctl.svc.AuditActors(c.Request.Context(), v)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, list)
}
