package repair

import (
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// bangkok is Asia/Bangkok (no DST), used for the ticket-number year and dates.
var bangkok = time.FixedZone("ICT", 7*60*60)

// ticketYear is the Gregorian year in Asia/Bangkok; the counter restarts on it (BR-F02-4).
func ticketYear(now time.Time) int {
	return now.In(bangkok).Year()
}

// bangkokDate is the calendar day of t in Asia/Bangkok, at 00:00 UTC (how dates are stored).
func bangkokDate(t time.Time) time.Time {
	y, m, d := t.In(bangkok).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// FormatTicketNo renders `{prefix}-{year}-{running}` from repair.settings (BR-F02-4/5).
// The year is the Buddhist year when YearFormat is "be". The running number is
// zero-padded to Digits and never truncated.
func FormatTicketNo(f TicketNumberFormat, year int, n int64) (string, error) {
	if f.Digits < 1 || f.Digits > 12 || n < 1 {
		return "", fmt.Errorf("invalid ticket number format: digits=%d n=%d", f.Digits, n)
	}
	switch f.YearFormat {
	case "be":
		year += 543
	case "ce":
	default:
		return "", fmt.Errorf("invalid ticket year format %q", f.YearFormat)
	}
	no := fmt.Sprintf("%d-%0*d", year, f.Digits, n)
	if p := strings.TrimSpace(f.Prefix); p != "" {
		no = p + "-" + no
	}
	return no, nil
}

// ticketAccess is what the visibility rule needs to know about a ticket.
type ticketAccess struct {
	ReporterID       uuid.UUID
	HolderID         *uuid.UUID
	ViewerSubscribed bool
}

// canView implements BR-F06-1 for one ticket: reporter, subscribers, the technician
// (every ticket, CR-005: one in-house technician), admin and executive.
func canView(v Viewer, t ticketAccess) bool {
	if seesAllTickets(v.Role) {
		return true
	}
	return viewerRelation(v, t) != RelationNone
}

func seesAllTickets(role string) bool {
	return role == users.RoleAdmin || role == users.RoleExecutive || role == users.RoleTechnician
}

// isStaff: who sees contractor names, contractor ratings and send-back counts.
func isStaff(role string) bool {
	return seesAllTickets(role)
}

func viewerRelation(v Viewer, t ticketAccess) string {
	switch {
	case t.ReporterID == v.ID:
		return RelationReporter
	case t.ViewerSubscribed:
		return RelationSubscriber
	case v.Role == users.RoleTechnician:
		return RelationTechnician
	default:
		return RelationNone
	}
}

// decorate sets the viewer-dependent summary fields and hides staff-only data.
func decorate(v Viewer, s *TicketSummary) {
	var holder *uuid.UUID
	if s.Technician != nil {
		holder = &s.Technician.ID
	}
	s.ViewerRelation = viewerRelation(v, ticketAccess{ReporterID: s.Reporter.ID, HolderID: holder, ViewerSubscribed: s.ViewerSubscribed})
	s.AwaitingMyConfirmation = s.Status == StatusResolved && s.Reporter.ID == v.ID
	if !isStaff(v.Role) {
		// Reporters see "ดำเนินการโดยช่างภายนอก · {types}" only (CR-005).
		s.Contractor = nil
	}
}

// allowedActions is the one place that decides the action bar (04-api-contract.md #8).
func allowedActions(v Viewer, d TicketDetail) ([]string, map[string]string) {
	actions := []string{}
	blocked := map[string]string{}
	switch d.Status {
	case StatusInProgress:
		if v.Role == users.RoleTechnician {
			actions = append(actions, ActionAssess)
			if d.ExpectedDoneOn == nil || d.WorkBy == nil {
				blocked[ActionResolve] = "ASSESSMENT_REQUIRED"
			} else {
				actions = append(actions, ActionResolve)
			}
		}
	case StatusResolved:
		if d.Reporter.ID == v.ID {
			actions = append(actions, ActionConfirm, ActionSendBack)
		}
	}
	// F08-B: admin closes any open ticket; the executive is read-only (BR-F22-6).
	if v.Role == users.RoleAdmin && d.Status != StatusClosed {
		actions = append(actions, ActionClose)
	}
	return actions, blocked
}

// validateCreate checks BR-F02-1 and the length limits of endpoint #5. It returns the
// normalised input (trimmed text, de-duplicated ids) and the field codes.
func validateCreate(in CreateTicketInput) (CreateTicketInput, map[string]string) {
	fields := map[string]string{}
	in.LocationDetail = strings.TrimSpace(in.LocationDetail)
	in.Details = strings.TrimSpace(in.Details)
	in.AssetCode = strings.TrimSpace(in.AssetCode)
	in.CategoryOther = strings.TrimSpace(in.CategoryOther)
	in.SymptomOther = strings.TrimSpace(in.SymptomOther)
	in.SymptomIDs = uniqueIDs(in.SymptomIDs)
	in.PhotoIDs = uniqueIDs(in.PhotoIDs)

	// BR-F02-1 (CR-014): a category from the master is always required; every category, "อื่น ๆ"
	// included, needs >= 1 symptom or a typed one. Whether a typed category name is allowed depends
	// on the category (only "อื่น ๆ"), so the service checks it against the DB.
	if in.CategoryID == nil {
		fields["categoryId"] = "REQUIRED"
	}
	if len(in.SymptomIDs) == 0 && in.SymptomOther == "" {
		fields["symptomIds"] = "MIN_ITEMS"
	}
	if utf8.RuneCountInString(in.CategoryOther) > MaxOtherChars {
		fields["categoryOther"] = "TOO_LONG"
	}
	if utf8.RuneCountInString(in.SymptomOther) > MaxOtherChars {
		fields["symptomOther"] = "TOO_LONG"
	}
	if in.BuildingID == nil {
		fields["buildingId"] = "REQUIRED"
	}
	if in.FloorID == nil {
		fields["floorId"] = "REQUIRED"
	}
	if in.RoomID == nil {
		fields["roomId"] = "REQUIRED"
	}
	checkPhotos(fields, "photoIds", in.PhotoIDs, 1)
	if utf8.RuneCountInString(in.LocationDetail) > MaxLocationChars {
		fields["locationDetail"] = "TOO_LONG"
	}
	if utf8.RuneCountInString(in.Details) > MaxDetailsChars {
		fields["details"] = "TOO_LONG"
	}
	if len(in.AssetCode) > MaxAssetCodeLen {
		fields["assetCode"] = "TOO_LONG"
	}
	return in, fields
}

// ticketPriority applies BR-F02-2 (CR-008, CR-014): the most urgent picked symptom; with only a
// typed symptom the category's default ("อื่น ๆ" included).
func ticketPriority(symptomPriorities []string, categoryDefault string) (priority, source string) {
	for _, p := range symptomPriorities {
		if priorityRank(p) >= 0 && (priority == "" || priorityRank(p) < priorityRank(priority)) {
			priority = p
		}
	}
	if priority != "" {
		return priority, PrioritySourceSymptom
	}
	if priorityRank(categoryDefault) < 0 {
		return PriorityMedium, PrioritySourceDefault
	}
	return categoryDefault, PrioritySourceCategory
}

// validateAssess checks BR-F21-2 for endpoint #9. today is the Asia/Bangkok date at 00:00 UTC.
func validateAssess(in AssessInput, today time.Time) map[string]string {
	fields := map[string]string{}
	switch {
	case in.ExpectedDoneOn == nil:
		fields["expectedDoneOn"] = "REQUIRED"
	case in.ExpectedDoneOn.Before(today):
		fields["expectedDoneOn"] = "PAST"
	}
	switch in.WorkBy {
	case "":
		fields["workBy"] = "REQUIRED"
	case WorkByInHouse:
	case WorkByContractor:
		if in.ContractorID == nil {
			fields["contractorId"] = "REQUIRED"
		}
	default:
		fields["workBy"] = "INVALID"
	}
	if utf8.RuneCountInString(strings.TrimSpace(in.Reason)) > MaxReasonChars {
		fields["reason"] = "TOO_LONG"
	}
	return fields
}

// validateResolve checks BR-F21-4 / BR-F24-3 for endpoint #10. needRating = the ticket is a
// contractor job that has no contractor rating yet; a rating sent for any other ticket is dropped.
func validateResolve(in ResolveInput, contractorJob, needRating bool) (ResolveInput, map[string]string) {
	fields := map[string]string{}
	in.Note = strings.TrimSpace(in.Note)
	in.ContractorRatingComment = strings.TrimSpace(in.ContractorRatingComment)
	in.PhotoIDs = uniqueIDs(in.PhotoIDs)
	checkText(fields, "note", in.Note, MaxNoteChars, true)
	checkPhotos(fields, "photoIds", in.PhotoIDs, 1)
	if !contractorJob {
		in.ContractorRating, in.ContractorRatingComment = nil, ""
		return in, fields
	}
	switch {
	case in.ContractorRating == nil && needRating:
		fields["contractorRating"] = "REQUIRED"
	case in.ContractorRating != nil && (*in.ContractorRating < 1 || *in.ContractorRating > 5):
		fields["contractorRating"] = "INVALID"
	}
	checkText(fields, "contractorRatingComment", in.ContractorRatingComment, MaxCommentChars, false)
	return in, fields
}

// validateContractor checks a contractor create / update (F24).
func validateContractor(in ContractorInput) (ContractorInput, map[string]string) {
	fields := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	in.ContactName = strings.TrimSpace(in.ContactName)
	in.Phone = strings.TrimSpace(in.Phone)
	in.Note = strings.TrimSpace(in.Note)
	in.TypeIDs = uniqueIDs(in.TypeIDs)
	checkText(fields, "name", in.Name, MaxNameChars, true)
	if len(in.TypeIDs) == 0 {
		fields["typeIds"] = "MIN_ITEMS"
	}
	checkText(fields, "contactName", in.ContactName, MaxNameChars, false)
	checkText(fields, "phone", in.Phone, MaxPhoneChars, false)
	checkText(fields, "note", in.Note, MaxContractorNote, false)
	return in, fields
}

func checkText(fields map[string]string, field, value string, limit int, required bool) {
	switch {
	case required && value == "":
		fields[field] = "REQUIRED"
	case utf8.RuneCountInString(value) > limit:
		fields[field] = "TOO_LONG"
	}
}

func checkPhotos(fields map[string]string, field string, ids []uuid.UUID, min int) {
	switch {
	case len(ids) < min:
		fields[field] = "MIN_ITEMS"
	case len(ids) > MaxPhotos:
		fields[field] = "MAX_ITEMS"
	}
}

func uniqueIDs(ids []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]bool, len(ids))
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// escapeLike makes user search text literal inside ILIKE '%…%'.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ---- CR-016: dashboard and equipment ----

// seesDashboard: the S29 dashboard and floor plans (#27, #29, #30) are for admin and executive (BR-F23-2).
// super_admin joins when settings Stage 1 adds it (D-079).
func seesDashboard(role string) bool {
	return role == users.RoleAdmin || role == users.RoleExecutive
}

// managesAssets: add / move / edit / deactivate equipment (#31–#34). Admin now; super_admin and the
// asset.manage permission when settings Stage 1 lands (D-079). The executive is read-only.
func managesAssets(role string) bool {
	return role == users.RoleAdmin
}

// validateAsset trims the input and returns field codes (BR-F31-1, contract #31).
func validateAsset(in AssetInput) (AssetInput, map[string]string) {
	in.Code = strings.TrimSpace(in.Code)
	in.Name = strings.Join(strings.Fields(in.Name), " ")
	fields := map[string]string{}
	checkText(fields, "code", in.Code, MaxAssetCodeChars, true)
	if _, bad := fields["code"]; !bad && !validAssetCode(in.Code) {
		fields["code"] = "INVALID"
	}
	checkText(fields, "name", in.Name, MaxAssetNameChars, true)
	if in.RoomID == uuid.Nil {
		fields["roomId"] = "REQUIRED"
	}
	// A position is both coordinates or none (none = in the room, not placed on the plan yet).
	if (in.X == nil) != (in.Z == nil) {
		if in.X == nil {
			fields["x"] = "REQUIRED"
		} else {
			fields["z"] = "REQUIRED"
		}
	}
	if in.RotationDeg != nil && (*in.RotationDeg < 0 || *in.RotationDeg > 359) {
		fields["rotationDeg"] = "INVALID"
	}
	return in, fields
}

// validAssetCode: letters, digits, "-" and "_" only (it goes into the QR URL, D-024).
func validAssetCode(code string) bool {
	for _, r := range code {
		ok := r == '-' || r == '_' || (r >= '0' && r <= '9') || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
		if !ok {
			return false
		}
	}
	return code != ""
}

// checkPlacement applies BR-F31-3: a placed asset must be on its floor's plan and inside the room it
// is saved in. A point belongs to the smallest room around it (ห้องน้ำ lies inside the common area).
func checkPlacement(in AssetInput, room PlacementRoom, rooms []RoomShape) error {
	if in.X == nil {
		return nil
	}
	x, z := *in.X, *in.Z
	if !room.HasPlan || x < 0 || z < 0 || x > room.WidthM || z > room.DepthM {
		return invalidPoint()
	}
	if at, ok := roomAt(x, z, rooms); !ok || at != room.ID {
		return ErrPointOutsideRoom
	}
	return nil
}

func invalidPoint() error {
	return apperr.Validation(map[string]string{"x": "INVALID", "z": "INVALID"})
}

// roomAt returns the smallest room whose outline contains the point (edges count as inside).
func roomAt(x, z float64, rooms []RoomShape) (uuid.UUID, bool) {
	best, bestArea := uuid.Nil, math.Inf(1)
	for _, r := range rooms {
		if len(r.Shape) < 3 || !pointInShape(x, z, r.Shape) {
			continue
		}
		if a := shapeArea(r.Shape); a < bestArea {
			best, bestArea = r.ID, a
		}
	}
	return best, best != uuid.Nil
}

// pointInShape: ray casting; a point on an edge is inside.
func pointInShape(x, z float64, s Shape) bool {
	const eps = 1e-9
	inside := false
	for i, j := 0, len(s)-1; i < len(s); j, i = i, i+1 {
		xi, zi, xj, zj := s[i][0], s[i][1], s[j][0], s[j][1]
		// on the segment j → i
		cross := (x-xj)*(zi-zj) - (z-zj)*(xi-xj)
		if math.Abs(cross) < eps && x >= math.Min(xi, xj)-eps && x <= math.Max(xi, xj)+eps &&
			z >= math.Min(zi, zj)-eps && z <= math.Max(zi, zj)+eps {
			return true
		}
		if (zi > z) != (zj > z) && x < (xj-xi)*(z-zi)/(zj-zi)+xi {
			inside = !inside
		}
	}
	return inside
}

// shapeArea: shoelace formula, m².
func shapeArea(s Shape) float64 {
	sum := 0.0
	for i := range s {
		j := (i + 1) % len(s)
		sum += s[i][0]*s[j][1] - s[j][0]*s[i][1]
	}
	return math.Abs(sum) / 2
}

// nextAssetCode implements #34: {prefix}-{floor name}-{lowest free 3-digit number}, compared ignoring
// case against every code in use (inactive ones too, BR-F31-4).
func nextAssetCode(prefix, floorName string, taken []string) string {
	used := make(map[string]bool, len(taken))
	for _, c := range taken {
		used[strings.ToLower(c)] = true
	}
	base := prefix + "-" + floorName + "-"
	for n := 1; ; n++ {
		code := fmt.Sprintf("%s%03d", base, n)
		if !used[strings.ToLower(code)] {
			return code
		}
	}
}

// bangkokDayStart is midnight Asia/Bangkok of the day t falls on.
func bangkokDayStart(t time.Time) time.Time {
	b := t.In(bangkok)
	return time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, bangkok)
}
