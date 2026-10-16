package repair

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
)

// Ticket actions (#9–#12) and contractors (#13–#19), CR-005.

func bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		httpx.Error(c, apperr.New(apperr.KindInvalid, "VALIDATION_FAILED", "malformed JSON body"))
		return false
	}
	return true
}

// ticketAction parses the viewer and the ticket id shared by #9–#12.
func ticketAction(c *gin.Context) (Viewer, uuid.UUID, bool) {
	v, ok := viewer(c)
	if !ok {
		return Viewer{}, uuid.Nil, false
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrTicketNotFound)
		return Viewer{}, uuid.Nil, false
	}
	return v, id, true
}

func respondTicket(c *gin.Context, t TicketDetail, err error) {
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toDetailDTO(t))
}

// Assess handles #9 POST /repair/tickets/{id}/assess.
func (ctl *Controller) Assess(c *gin.Context) {
	v, id, ok := ticketAction(c)
	if !ok {
		return
	}
	var req AssessRequest
	if !bindJSON(c, &req) {
		return
	}
	fields := map[string]string{}
	in := AssessInput{WorkBy: req.WorkBy, ContractorID: parseOptionalID(req.ContractorID, "contractorId", fields)}
	if s := strings.TrimSpace(req.ExpectedDoneOn); s != "" {
		if d, err := time.Parse(time.DateOnly, s); err != nil {
			fields["expectedDoneOn"] = "INVALID"
		} else {
			in.ExpectedDoneOn = &d
		}
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	t, err := ctl.svc.Assess(c.Request.Context(), v, id, in)
	respondTicket(c, t, err)
}

// Resolve handles #10 POST /repair/tickets/{id}/resolve.
func (ctl *Controller) Resolve(c *gin.Context) {
	v, id, ok := ticketAction(c)
	if !ok {
		return
	}
	var req ResolveRequest
	if !bindJSON(c, &req) {
		return
	}
	fields := map[string]string{}
	in := ResolveInput{
		Note: req.Note, PhotoIDs: parseIDs(req.PhotoIDs, "photoIds", fields),
		ContractorRating: req.ContractorRating, ContractorRatingComment: req.ContractorRatingComment,
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	t, err := ctl.svc.Resolve(c.Request.Context(), v, id, in)
	respondTicket(c, t, err)
}

// Confirm handles #11 POST /repair/tickets/{id}/confirm.
func (ctl *Controller) Confirm(c *gin.Context) {
	v, id, ok := ticketAction(c)
	if !ok {
		return
	}
	var req ConfirmRequest
	if !bindJSON(c, &req) {
		return
	}
	t, err := ctl.svc.Confirm(c.Request.Context(), v, id, req.Rating, req.Comment)
	respondTicket(c, t, err)
}

// SendBack handles #12 POST /repair/tickets/{id}/send-back.
func (ctl *Controller) SendBack(c *gin.Context) {
	v, id, ok := ticketAction(c)
	if !ok {
		return
	}
	var req SendBackRequest
	if !bindJSON(c, &req) {
		return
	}
	fields := map[string]string{}
	photos := parseIDs(req.PhotoIDs, "photoIds", fields)
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	t, err := ctl.svc.SendBack(c.Request.Context(), v, id, req.Reason, photos)
	respondTicket(c, t, err)
}

// ContractorTypes handles #13 GET /repair/contractor-types.
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
	httpx.OK(c, toRefDTOs(list))
}

// CreateContractorType handles #14 POST /repair/contractor-types (existing name → that type).
func (ctl *Controller) CreateContractorType(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	var req ContractorTypeRequest
	if !bindJSON(c, &req) {
		return
	}
	t, err := ctl.svc.CreateContractorType(c.Request.Context(), v, req.Name)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, RefDTO(t))
}

// Contractors handles #15 GET /repair/contractors?q=&typeId=&includeInactive=.
func (ctl *Controller) Contractors(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	fields := map[string]string{}
	f := ContractorFilter{IncludeInactive: c.Query("includeInactive") == "true"}
	f.Page, f.PageSize = httpx.Page(c)
	if f.Page > maxPage {
		fields["page"] = "INVALID"
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		e := escapeLike(q)
		f.Q = &e
	}
	f.TypeID = parseOptionalID(c.Query("typeId"), "typeId", fields)
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return
	}
	list, total, err := ctl.svc.Contractors(c.Request.Context(), v, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.List(c, toContractorDTOs(list), httpx.Meta{Page: f.Page, PageSize: f.PageSize, Total: total})
}

func parseContractor(c *gin.Context) (ContractorInput, bool) {
	var req ContractorRequest
	if !bindJSON(c, &req) {
		return ContractorInput{}, false
	}
	fields := map[string]string{}
	in := ContractorInput{
		Name: req.Name, TypeIDs: parseIDs(req.TypeIDs, "typeIds", fields),
		ContactName: req.ContactName, Phone: req.Phone, Note: req.Note, IsActive: req.IsActive == nil || *req.IsActive,
	}
	if len(fields) > 0 {
		httpx.Error(c, apperr.Validation(fields))
		return ContractorInput{}, false
	}
	return in, true
}

// CreateContractor handles #16 POST /repair/contractors.
func (ctl *Controller) CreateContractor(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	in, ok := parseContractor(c)
	if !ok {
		return
	}
	ct, err := ctl.svc.CreateContractor(c.Request.Context(), v, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": toContractorDTO(ct)})
}

func contractorID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.Error(c, ErrContractorNotFound)
		return uuid.Nil, false
	}
	return id, true
}

// Contractor handles #17 GET /repair/contractors/{id}.
func (ctl *Controller) Contractor(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := contractorID(c)
	if !ok {
		return
	}
	ct, err := ctl.svc.Contractor(c.Request.Context(), v, id)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toContractorDTO(ct))
}

// UpdateContractor handles #18 PUT /repair/contractors/{id}.
func (ctl *Controller) UpdateContractor(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := contractorID(c)
	if !ok {
		return
	}
	in, ok := parseContractor(c)
	if !ok {
		return
	}
	ct, err := ctl.svc.UpdateContractor(c.Request.Context(), v, id, in)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, toContractorDTO(ct))
}

// ContractorJobs handles #19 GET /repair/contractors/{id}/jobs.
func (ctl *Controller) ContractorJobs(c *gin.Context) {
	v, ok := viewer(c)
	if !ok {
		return
	}
	id, ok := contractorID(c)
	if !ok {
		return
	}
	page, size := httpx.Page(c)
	if page > maxPage {
		httpx.Error(c, apperr.Validation(map[string]string{"page": "INVALID"}))
		return
	}
	list, total, err := ctl.svc.ContractorJobs(c.Request.Context(), v, id, page, size)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.List(c, toContractorJobDTOs(list), httpx.Meta{Page: page, PageSize: size, Total: total})
}
