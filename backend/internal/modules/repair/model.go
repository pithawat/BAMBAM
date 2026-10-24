// Package repair is the ระบบแจ้งซ่อม module: report a problem → the technician assesses it
// (expected finish date) → repairs it in house or through a contractor → the reporter rates it.
// Docs: docs/modules/repair/ (flows 02-flows.md, contract 04-api-contract.md).
package repair

import (
	"math"
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
	EventAdminClosed       = "admin_closed"

	PhotoKindReport   = "report"
	PhotoKindResult   = "result"
	PhotoKindSendBack = "send_back"

	MaxPhotos         = 5
	MaxLocationChars  = 100
	MaxOtherChars     = 100 // typed "อื่นๆ" category / symptom (CR-008)
	MaxReasonChars    = 100 // reason for moving the expected date (CR-008)
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
	ActionClose    = "close"
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
	ID              uuid.UUID
	Name            string
	Icon            string
	DefaultPriority string   // used when only "อาการอื่นๆ" is picked (CR-008)
	IsOther         bool     // the one "อื่น ๆ" category; only it takes a typed category name (CR-014)
	AreaTypes       []string // room area types where its problems usually happen (CR-014)
	Symptoms        []Symptom
}

// Symptom carries the priority the admin set for it (CR-008, settings S22).
type Symptom struct {
	ID       uuid.UUID
	Name     string
	Priority string
}

type Floor struct {
	ID    uuid.UUID
	Name  string
	Level int32
	Rooms []Room
}

// Room areas (CR-014, platform.rooms.area_type).
const (
	AreaMeetingRoom = "meeting_room"
	AreaRestroom    = "restroom"
	AreaOffice      = "office"
	AreaPantry      = "pantry"
	AreaCommon      = "common_area"
	AreaParking     = "parking"
	AreaOther       = "other"
)

// Room is a place on a floor the reporter picks (CR-014).
type Room struct {
	ID       uuid.UUID
	Name     string
	AreaType string
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
	PrioritySource   string
	Category         *Ref    // nil only on tickets from CR-008 to CR-014 where the reporter typed "อื่นๆ"
	CategoryIcon     *string // lucide name of Category (CR-019: S06 / S07 tiles without loading the master)
	CategoryOther    *string // typed category name (under the "อื่น ๆ" category since CR-014)
	Symptoms         []Ref
	SymptomOther     *string // typed symptom
	Building         Ref
	Floor            Ref
	Room             *Ref    // nil on tickets created before CR-014
	LocationDetail   *string // the optional extra spot since CR-014
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
func (s TicketSummary) Step() string { return stepOf(s.Status, s.ExpectedDoneOn, s.SendBackCount) }

func stepOf(status string, expectedDoneOn *time.Time, sendBackCount int32) string {
	switch {
	case status == StatusClosed:
		return StepClosed
	case status == StatusResolved:
		return StepAwaitingRating
	case expectedDoneOn == nil:
		return StepAwaitingAssessment
	case sendBackCount > 0:
		return StepReworking
	default:
		return StepInRepair
	}
}

// MyTicket is one S06 table row (#35, CR-019): only what the table shows, so a page stays small.
type MyTicket struct {
	ID             uuid.UUID
	TicketNo       string
	Status         string
	ClosedReason   *string
	Category       *Ref
	CategoryIcon   *string
	CategoryOther  *string
	Title          string // symptom names, then the typed symptom, joined with " · "
	Building       Ref
	Floor          Ref
	Room           *Ref
	LocationDetail *string
	IsReporter     bool // false = in the list because the viewer follows it
	Rating         *int16
	SendBackCount  int32
	ExpectedDoneOn *time.Time // date only
	AutoCloseAt    *time.Time
	ResolvedAt     *time.Time
	UpdatedAt      time.Time
}

func (t MyTicket) Step() string { return stepOf(t.Status, t.ExpectedDoneOn, t.SendBackCount) }

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
	RoomID         *uuid.UUID // CR-014: required, an active room of FloorID
	LocationDetail string
	Details        string
	CategoryOther  string // CR-014: optional typed name, only under the "อื่น ๆ" category
	SymptomOther   string // CR-008: typed symptom
	PhotoIDs       []uuid.UUID
	AssetCode      string
	TeamHandled    bool
}

// AssessInput is endpoint #9 after parsing: the expected finish date and who does the work (CR-006).
type AssessInput struct {
	ExpectedDoneOn *time.Time // date only
	WorkBy         string
	ContractorID   *uuid.UUID
	Reason         string // optional, kept on a change and shown to the reporter (CR-008)
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
	PrioritySource string
	CategoryID     uuid.UUID
	CategoryOther  *string
	SymptomOther   *string
	BuildingID     uuid.UUID
	FloorID        uuid.UUID
	RoomID         uuid.UUID
	LocationDetail *string
	Details        *string
	AssetCode      *string
	ReporterID     uuid.UUID
	SymptomIDs     []uuid.UUID
	PhotoIDs       []uuid.UUID
	CreatedAt      time.Time
	CreatedEventID uuid.UUID
}

// ActiveCategory is what ticket creation reads from a locked, active category.
type ActiveCategory struct {
	DefaultPriority string
	IsOther         bool
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

// Priority sources (CR-008).
const (
	PrioritySourceSymptom  = "symptom"
	PrioritySourceCategory = "category"
	PrioritySourceDefault  = "default"
	PrioritySourceAdmin    = "admin"
	PrioritySourceReporter = "reporter" // tickets created before CR-008
)

// RecentPlace is one "ที่เคยแจ้ง" shortcut (#28, CR-008, CR-014).
type RecentPlace struct {
	Building       Ref
	Floor          Ref
	Room           Ref
	LocationDetail *string
	LastReportedAt time.Time
}

// ---- CR-016: dashboard (#27), floor plans (#30), equipment (#29, #31–#34) ----

// PriorityCounts: open tickets per priority (pins on the building and the floor plan).
type PriorityCounts struct {
	Critical, High, Medium, Low int64
}

func (p PriorityCounts) Total() int64 { return p.Critical + p.High + p.Medium + p.Low }

// Highest is the most urgent priority with an open ticket; nil when there is none (information only, CR-015).
func (p PriorityCounts) Highest() *string {
	for i, n := range []int64{p.Critical, p.High, p.Medium, p.Low} {
		if n > 0 {
			return &Priorities[i]
		}
	}
	return nil
}

type OverviewCounts struct {
	Open, AwaitingAssessment, InRepair, Reworking, AwaitingRating, Overdue int64
	ReportedToday, ClosedToday, ClosedLast7Days                            int64
	RatedLast7Days, RatingSumLast7Days                                     int64
	OldestAwaitingAssessmentAt, NextAutoCloseAt                            *time.Time
}

// RatingAvgLast7Days: average reporter rating of tickets closed in the last 7 days; nil without ratings.
func (c OverviewCounts) RatingAvgLast7Days() *float64 {
	if c.RatedLast7Days == 0 {
		return nil
	}
	avg := math.Round(float64(c.RatingSumLast7Days)/float64(c.RatedLast7Days)*10) / 10
	return &avg
}

// StepCounts: open tickets per step (S11 tabs; InRepair includes reworking, CR-017).
type StepCounts struct {
	AwaitingAssessment, InRepair, AwaitingRating int64
}

type OverviewFloor struct {
	ID, BuildingID uuid.UUID
	Name           string
	Level          int32
	Open           PriorityCounts
	Steps          StepCounts
}

type OverviewBuilding struct {
	ID       uuid.UUID
	Name     string
	HasModel bool
	// Footprint of the model in metres (largest floor plan); nil without a plan (CR-017).
	WidthM, DepthM *float64
	Floors         []OverviewFloor
}

type Overview struct {
	Counts    OverviewCounts
	Buildings []OverviewBuilding
	Attention []TicketSummary
}

type AssetType struct {
	ID                          uuid.UUID
	Key, Name, CodePrefix, Icon string
	Mount                       string
}

type AssetTypeRef struct {
	ID        uuid.UUID
	Key, Name string
}

// Shape is a room outline on its floor plan: [[x, z], …] in metres (origin top-left, x right, z down).
type Shape [][2]float64

type Asset struct {
	ID          uuid.UUID
	Code, Name  string
	Type        AssetTypeRef
	Room        Ref
	X, Z        *float64 // nil = in the room, not placed on the plan yet
	RotationDeg int16
	OpenTickets int64
}

type PlanRoom struct {
	ID       uuid.UUID
	Name     string
	AreaType string
	Shape    Shape // nil when the room has no outline
	Open     PriorityCounts
}

type FloorPlan struct {
	Floor          Floor
	Building       Ref
	WidthM, DepthM *float64 // nil when the floor has no plan
	ModelFile      *string
	Rooms          []PlanRoom
	Assets         []Asset
}

// AssetInput is the body of #31 / #32 (AssetTypeID is ignored on #32: the type never changes).
type AssetInput struct {
	AssetTypeID uuid.UUID
	Code, Name  string
	RoomID      uuid.UUID
	X, Z        *float64
	RotationDeg *int
}

// PlacementRoom is the target room of an add / move with its floor's plan size.
type PlacementRoom struct {
	ID, FloorID    uuid.UUID
	Shape          Shape
	HasPlan        bool
	WidthM, DepthM float64
}

type RoomShape struct {
	ID    uuid.UUID
	Shape Shape
}

type LockedAsset struct {
	ID, AssetTypeID, RoomID uuid.UUID
	Code, Name              string
	X, Z                    *float64
	RotationDeg             int16
	IsActive                bool
}

// Audit actions for platform.audit_log (BR-F31-5).
const (
	AuditAssetCreated     = "asset.created"
	AuditAssetUpdated     = "asset.updated"
	AuditAssetDeactivated = "asset.deactivated"
)

// Asset limits (BR-F31-1).
const (
	MaxAssetCodeChars = 50
	MaxAssetNameChars = 100
	// AttentionLimit: rows in the S29 "งานที่ควรติดตาม" list (#27).
	AttentionLimit = 5
)
