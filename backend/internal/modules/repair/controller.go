package repair

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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
	return Viewer{ID: p.UserID, Role: p.Role}, true
}

// Categories handles #1 GET /repair/categories.
func (ctl *Controller) Categories(c *gin.Context) {
	cats, err := ctl.svc.Categories(c.Request.Context())
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toCategoryDTOs(cats))
}

// Buildings handles #2 GET /repair/buildings.
func (ctl *Controller) Buildings(c *gin.Context) {
	blds, err := ctl.svc.Buildings(c.Request.Context())
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toBuildingDTOs(blds))
}

// multipartOverhead allows for the form boundary and headers around the 10 MB file.
const multipartOverhead = 1 << 20

// UploadPhoto handles #3 POST /repair/photos (multipart field `file`).
func (ctl *Controller) UploadPhoto(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxPhotoBytes+multipartOverhead)
	fh, err := c.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			httpx.Error(c, ErrPhotoTooLarge)
			return
		}
		httpx.Error(c, apperr.Validation(map[string]string{"file": "REQUIRED"}))
		return
	}
	if fh.Size > MaxPhotoBytes {
		httpx.Error(c, ErrPhotoTooLarge)
		return
	}
	f, err := fh.Open()
	if err != nil {
		httpx.Error(c, err)
		return
	}
	defer func() { _ = f.Close() }()
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, io.LimitReader(f, MaxPhotoBytes+1)); err != nil {
		httpx.Error(c, err)
		return
	}
	id, err := ctl.svc.UploadPhoto(c.Request.Context(), v, buf.Bytes())
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": toPhotoDTO(id)})
}

// Photo handles #4 GET /repair/photos/{id}?size=thumb|full.
func (ctl *Controller) Photo(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrPhotoNotFound)
		return
	}
	size := c.DefaultQuery("size", "full")
	if size != "thumb" && size != "full" {
		httpx.Error(c, apperr.Validation(map[string]string{"size": "INVALID"}))
		return
	}
	rc, ct, err := ctl.svc.OpenPhoto(c.Request.Context(), v, id, size == "thumb")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	defer func() { _ = rc.Close() }()
	c.DataFromReader(http.StatusOK, -1, ct, rc, map[string]string{
		"Cache-Control":          "private, max-age=86400",
		"X-Content-Type-Options": "nosniff",
	})
}

// CreateTicket handles #5 POST /repair/tickets.
func (ctl *Controller) CreateTicket(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, apperr.New(apperr.KindInvalid, "VALIDATION_FAILED", "malformed JSON body"))
		return
	}
	fields := map[string]string{}
	in := CreateTicketInput{
		CategoryID:     parseOptionalID(req.CategoryID, "categoryId", fields),
		SymptomIDs:     parseIDs(req.SymptomIDs, "symptomIds", fields),
		BuildingID:     parseOptionalID(req.BuildingID, "buildingId", fields),
		FloorID:        parseOptionalID(req.FloorID, "floorId", fields),
		LocationDetail: req.LocationDetail,
		Details:        req.Details,
		Priority:       req.Priority,
		PhotoIDs:       parseIDs(req.PhotoIDs, "photoIds", fields),
		AssetCode:      req.AssetCode,
		TeamHandled:    len(req.TeamHandled) > 0 && string(req.TeamHandled) != "null",
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	t, err := ctl.svc.CreateTicket(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": toDetailDTO(t)})
}

// Tickets handles #6 GET /repair/tickets.
func (ctl *Controller) Tickets(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	f, err := parseFilter(c, true)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	list, total, err := ctl.svc.Tickets(c.Request.Context(), v, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.List(c, toSummaryDTOs(list), httpx.Meta{Page: f.Page, PageSize: f.PageSize, Total: total})
}

// TicketCounts handles #7 GET /repair/tickets/counts.
func (ctl *Controller) TicketCounts(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	f, err := parseFilter(c, false)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	n, err := ctl.svc.TicketCounts(c.Request.Context(), v, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, TicketCountsDTO(n))
}

// Ticket handles #8 GET /repair/tickets/{id}.
func (ctl *Controller) Ticket(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrTicketNotFound)
		return
	}
	t, err := ctl.svc.Ticket(c.Request.Context(), v, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toDetailDTO(t))
}

// maxPage keeps OFFSET bounded.
const maxPage = 10_000

var listSorts = map[string]bool{"updatedAt:desc": true, "createdAt:desc": true, "createdAt:asc": true, "closedAt:desc": true, "priority:asc": true}

// parseFilter reads the #6 / #7 query. withStatus=false for #7 (counts ignore `status`).
func parseFilter(c *gin.Context, withStatus bool) (TicketFilter, error) {
	fields := map[string]string{}
	f := TicketFilter{Relation: "all", Sort: "updatedAt:desc"}
	f.Page, f.PageSize = httpx.Page(c)
	if f.Page > maxPage {
		fields["page"] = "INVALID"
	}

	switch c.DefaultQuery("scope", "mine") {
	case "mine":
	case "all":
		f.ScopeAll = true
	default:
		fields["scope"] = "INVALID"
	}
	if r := c.Query("relation"); r != "" {
		if r != "all" && r != "reported" && r != "following" {
			fields["relation"] = "INVALID"
		}
		f.Relation = r
	}
	if withStatus {
		for _, s := range splitList(c.Query("status")) {
			if !contains(Statuses, s) {
				fields["status"] = "INVALID"
			}
			f.Statuses = append(f.Statuses, s)
		}
		// S06 "ปิดแล้ว" orders by closed time (BR-F06-2 covers the resolved tab in the query).
		if len(f.Statuses) == 1 && f.Statuses[0] == StatusClosed {
			f.Sort = "closedAt:desc"
		}
		for _, s := range splitList(c.Query("step")) {
			if !contains(Steps, s) {
				fields["step"] = "INVALID"
			}
			f.Steps = append(f.Steps, s)
		}
	}
	if s := c.Query("sort"); s != "" {
		if !listSorts[s] {
			fields["sort"] = "INVALID"
		}
		f.Sort = s
	}
	if r := c.Query("closedReason"); r != "" {
		if !contains(ClosedReasons, r) {
			fields["closedReason"] = "INVALID"
		}
		f.ClosedReason = &r
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		e := escapeLike(q)
		f.Q = &e
	}
	f.CreatedFrom = parseTime(c.Query("createdFrom"), "createdFrom", fields)
	f.CreatedTo = parseTime(c.Query("createdTo"), "createdTo", fields)
	f.CategoryID = parseOptionalID(c.Query("categoryId"), "categoryId", fields)
	f.BuildingID = parseOptionalID(c.Query("buildingId"), "buildingId", fields)
	f.FloorID = parseOptionalID(c.Query("floorId"), "floorId", fields)
	if p := c.Query("priority"); p != "" {
		if priorityRank(p) < 0 {
			fields["priority"] = "INVALID"
		}
		f.Priority = &p
	}
	if len(fields) > 0 {
		return TicketFilter{}, apperr.Validation(fields)
	}
	return f, nil
}

func parseOptionalID(s, field string, fields map[string]string) *uuid.UUID {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		fields[field] = "INVALID"
		return nil
	}
	return &id
}

func parseIDs(list []string, field string, fields map[string]string) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(list))
	for _, s := range list {
		id, err := uuid.Parse(strings.TrimSpace(s))
		if err != nil {
			fields[field] = "INVALID"
			continue
		}
		out = append(out, id)
	}
	return out
}

func parseTime(s, field string, fields map[string]string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		fields[field] = "INVALID"
		return nil
	}
	return &t
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
