// Package repair is the ระบบแจ้งซ่อม module: report a problem → the technician assesses it
// (expected finish date) → repairs it in house or through a contractor → the reporter rates it.
// Docs: docs/modules/repair/ (flows 02-flows.md, contract 04-api-contract.md).
package repair

import (
	"time"

	"github.com/google/uuid"
)

const (
	StatusInProgress = "in_progress"
	StatusResolved   = "resolved"
	StatusClosed     = "closed"
)

var Statuses = []string{StatusInProgress, StatusResolved, StatusClosed}

var ClosedReasons = []string{"confirmed", "auto_closed", "team_handled", "admin_closed"}

// Steps are the progress shown to people (CR-005), derived from status + assessment + send backs.
const (
	StepAwaitingAssessment = "awaiting_assessment"
	StepInRepair           = "in_repair"
	StepReworking          = "reworking"
	StepAwaitingRating     = "awaiting_rating"
	StepClosed             = "closed"
)

var Steps = []string{StepAwaitingAssessment, StepInRepair, StepReworking, StepAwaitingRating, StepClosed}

const (
	PriorityCritical = "critical"
	PriorityHigh     = "high"
	PriorityMedium   = "medium"
	PriorityLow      = "low"
)

// Priorities in urgency order, most urgent first (BR-F21-1).
var Priorities = []string{PriorityCritical, PriorityHigh, PriorityMedium, PriorityLow}

// priorityRank: lower = more urgent; -1 for an unknown value.
func priorityRank(p string) int {
	for i, v := range Priorities {
		if v == p {
			return i
		}
	}
	return -1
}

const (
	RelationReporter   = "reporter"
	RelationSubscriber = "subscriber"
	RelationTechnician = "technician"
	RelationNone       = "none"
)

const (
	WorkByInHouse    = "in_house"
	WorkByContractor = "contractor"
)

const (
	EventCreated           = "created"
	EventAssessed          = "assessed"
	EventAssessmentChanged = "assessment_changed"
	EventResolved          = "resolved"
	EventSentBack          = "sent_back"
	EventConfirmed         = "confirmed"

	PhotoKindReport   = "report"
	PhotoKindResult   = "result"
	PhotoKindSendBack = "send_back"

	MaxPhotos         = 5
	MaxLocationChars  = 100
	MaxDetailsChars   = 500
	MaxAssetCodeLen   = 50
	MaxNoteChars      = 500
	MaxCommentChars   = 500
	MaxNameChars      = 100
	MaxTypeNameChars  = 50
	MaxPhoneChars     = 30
	MaxContractorNote = 500

	// AutoCloseAfter: a resolved ticket nobody rated closes itself (BR-F07-4).
	AutoCloseAfter = 72 * time.Hour
)

// Actions in TicketDetail.allowedActions (04-api-contract.md).
const (
	ActionAssess   = "assess"
	ActionResolve  = "resolve"
	ActionConfirm  = "confirm"
	ActionSendBack = "send_back"
)

// Ref is { id, name } as used across the API contract.
type Ref struct {
	ID   uuid.UUID
	Name string
}

type Person struct {
	ID         uuid.UUID
	Name       string
	Department *string
}

type Category struct {
	ID       uuid.UUID
	Name     string
	Icon     string
	Symptoms []Ref
}

type Floor struct {
	ID    uuid.UUID
	Name  string
	Level int32
}

type Building struct {
	ID     uuid.UUID
	Name   string
	Floors []Floor
}

// Viewer is the logged-in user as the repair service needs it.
type Viewer struct {
	ID   uuid.UUID
	Role string
}

// TicketSummary is the list / card shape (04-api-contract.md TicketSummary).
type TicketSummary struct {
	ID               uuid.UUID
	TicketNo         string
	Status           string
	ClosedReason     *string
	Priority         string
	Category         Ref
	Symptoms         []Ref
	Building         Ref
	Floor            Ref
	LocationDetail   *string
	ThumbPhotoID     *uuid.UUID
	Reporter         Person
	Technician       *Person
	ViewerSubscribed bool
	SendBackCount    int32
	Rating           *int16
	ExpectedDoneOn   *time.Time // date only
	AssessedAt       *time.Time
	WorkBy           *string
	Contractor       *Ref
	ContractorTypes  []string
	AutoCloseAt      *time.Time
	CreatedAt        time.Time
	ResolvedAt       *time.Time
	ClosedAt         *time.Time
	UpdatedAt        time.Time

	// Set by the service for the viewer.
	ViewerRelation         string
	AwaitingMyConfirmation bool
}

// Step derives the progress step (CR-005).
func (s TicketSummary) Step() string {
	switch {
	case s.Status == StatusClosed:
		return StepClosed
	case s.Status == StatusResolved:
		return StepAwaitingRating
	case s.ExpectedDoneOn == nil:
		return StepAwaitingAssessment
	case s.SendBackCount > 0:
		return StepReworking
	default:
		return StepInRepair
	}
}

type TicketResult struct {
	Note                    string
	Photos                  []uuid.UUID
	By                      *Person
	At                      *time.Time
	ContractorRating        *int16
	ContractorRatingComment *string
}

type TimelineEvent struct {
	ID     uuid.UUID
	Type   string
	Actor  *Person
	At     time.Time
	Note   *string
	Photos []uuid.UUID
	Data   []byte
}

// TicketDetail = TicketSummary + detail fields (04-api-contract.md TicketDetail).
type TicketDetail struct {
	TicketSummary
	Details         *string
	AssetCode       *string
	Photos          []uuid.UUID
	SubscriberCount int64
	Result          *TicketResult
	RatingComment   *string
	Timeline        []TimelineEvent
	AllowedActions  []string
	BlockedActions  map[string]string
}

// CreateTicketInput is endpoint #5 after the controller parsed ids.
type CreateTicketInput struct {
	CategoryID     *uuid.UUID
	SymptomIDs     []uuid.UUID
	BuildingID     *uuid.UUID
	FloorID        *uuid.UUID
	LocationDetail string
	Details        string
	Priority       string
	PhotoIDs       []uuid.UUID
	AssetCode      string
	TeamHandled    bool
}

// AssessInput is endpoint #9 after parsing: the expected finish date and who does the work (CR-006).
type AssessInput struct {
	ExpectedDoneOn *time.Time // date only
	WorkBy         string
	ContractorID   *uuid.UUID
}

// ResolveInput is endpoint #10 after parsing. Who did the work was set by the assessment;
// the contractor rating is required only for a contractor job that has no rating yet.
type ResolveInput struct {
	Note                    string
	PhotoIDs                []uuid.UUID
	ContractorRating        *int
	ContractorRatingComment string
}

// TicketFilter is endpoint #6 / #7 query after parsing.
type TicketFilter struct {
	ScopeAll     bool
	Relation     string // all | reported | following
	Statuses     []string
	Steps        []string
	ClosedReason *string
	Q            *string
	CreatedFrom  *time.Time
	CreatedTo    *time.Time
	CategoryID   *uuid.UUID
	BuildingID   *uuid.UUID
	FloorID      *uuid.UUID
	Priority     *string
	Sort         string
	Page         int
	PageSize     int
}

type TicketCounts struct {
	InProgress             int64
	Resolved               int64
	Closed                 int64
	AwaitingAssessment     int64
	InRepair               int64
	AwaitingMyConfirmation int64
}

// TicketNumberFormat is repair.settings (BR-F02-5).
type TicketNumberFormat struct {
	Prefix     string
	YearFormat string // be | ce
	Digits     int
}

type Photo struct {
	ID               uuid.UUID
	UploaderID       uuid.UUID
	ContentType      string
	StorageKey       string
	ThumbKey         string
	ThumbContentType string
	TicketID         *uuid.UUID
}

// NewPhoto is a stored upload ready to be recorded.
type NewPhoto struct {
	ID               uuid.UUID
	UploaderID       uuid.UUID
	ContentType      string
	SizeBytes        int64
	StorageKey       string
	ThumbKey         string
	ThumbContentType string
}

// NewTicket is what the repository inserts in the create transaction.
type NewTicket struct {
	ID             uuid.UUID
	TicketNo       string
	Priority       string
	CategoryID     uuid.UUID
	BuildingID     uuid.UUID
	FloorID        uuid.UUID
	LocationDetail *string
	Details        *string
	AssetCode      *string
	ReporterID     uuid.UUID
	SymptomIDs     []uuid.UUID
	PhotoIDs       []uuid.UUID
	CreatedAt      time.Time
	CreatedEventID uuid.UUID
}

// LockedTicket is the row state read under FOR UPDATE before a status change.
type LockedTicket struct {
	ID           uuid.UUID
	Status       string
	ReporterID   uuid.UUID
	Assessed     bool // expected date and work-by are both set (CR-006)
	WorkBy       string
	ContractorID *uuid.UUID
	Rated        bool // the contractor already has a rating on this ticket
}

// NewEvent is a timeline row written together with a status change; photos are attached to it.
type NewEvent struct {
	ID        uuid.UUID
	TicketID  uuid.UUID
	Type      string
	ActorID   *uuid.UUID
	Note      *string
	Data      []byte
	At        time.Time
	PhotoKind string
	PhotoIDs  []uuid.UUID
}

// ---- contractors (F24) ----

type Contractor struct {
	ID          uuid.UUID
	Name        string
	Types       []Ref
	ContactName *string
	Phone       *string
	Note        *string
	IsActive    bool
	JobCount    int64
	RatedCount  int64
	AvgRating   float64
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ContractorInput struct {
	Name        string
	TypeIDs     []uuid.UUID
	ContactName string
	Phone       string
	Note        string
	IsActive    bool
}

type ContractorFilter struct {
	Q               *string
	TypeID          *uuid.UUID
	IncludeInactive bool
	Page            int
	PageSize        int
}

type ContractorJob struct {
	TicketID                uuid.UUID
	TicketNo                string
	Status                  string
	Category                Ref
	ResolvedAt              *time.Time
	ContractorRating        *int16
	ContractorRatingComment *string
	ReporterRating          *int16
}
