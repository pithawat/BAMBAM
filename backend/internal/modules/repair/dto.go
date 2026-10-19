package repair

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JSON shapes = docs/modules/repair/04-api-contract.md. Field names must not change without a CR.

const photoPath = "/api/v1/repair/photos/"

type RefDTO struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type PersonRefDTO struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Department *string   `json:"department"`
}

type PhotoDTO struct {
	ID       uuid.UUID `json:"id"`
	ThumbURL string    `json:"thumbUrl"`
	URL      string    `json:"url"`
}

// #1
type CategoryDTO struct {
	ID              uuid.UUID    `json:"id"`
	Name            string       `json:"name"`
	Icon            string       `json:"icon"`
	DefaultPriority string       `json:"defaultPriority"`
	IsOther         bool         `json:"isOther"`   // CR-014
	AreaTypes       []string     `json:"areaTypes"` // CR-014
	Symptoms        []SymptomDTO `json:"symptoms"`
}

// SymptomDTO carries the admin-set priority (CR-008).
type SymptomDTO struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Priority string    `json:"priority"`
}

// #28 (CR-008)
type RecentPlaceDTO struct {
	Building       RefDTO    `json:"building"`
	Floor          RefDTO    `json:"floor"`
	Room           RefDTO    `json:"room"` // CR-014
	LocationDetail *string   `json:"locationDetail"`
	LastReportedAt time.Time `json:"lastReportedAt"`
}

// #2
type FloorDTO struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Level int32     `json:"level"`
	Rooms []RoomDTO `json:"rooms"` // CR-014
}

type RoomDTO struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	AreaType string    `json:"areaType"`
}

type BuildingDTO struct {
	ID     uuid.UUID  `json:"id"`
	Name   string     `json:"name"`
	Floors []FloorDTO `json:"floors"`
}

// CreateTicketRequest = #5 request. Ids stay strings so a bad id becomes a field error, not a bind error.
type CreateTicketRequest struct {
	CategoryID     string          `json:"categoryId"`
	SymptomIDs     []string        `json:"symptomIds"`
	BuildingID     string          `json:"buildingId"`
	FloorID        string          `json:"floorId"`
	RoomID         string          `json:"roomId"` // CR-014
	LocationDetail string          `json:"locationDetail"`
	Details        string          `json:"details"`
	CategoryOther  string          `json:"categoryOther"` // CR-008; a `priority` field from old clients is ignored
	SymptomOther   string          `json:"symptomOther"`
	PhotoIDs       []string        `json:"photoIds"`
	AssetCode      string          `json:"assetCode"`
	TeamHandled    json.RawMessage `json:"teamHandled"`
}

type TicketSummaryDTO struct {
	ID                     uuid.UUID     `json:"id"`
	TicketNo               string        `json:"ticketNo"`
	Status                 string        `json:"status"`
	Step                   string        `json:"step"`
	ClosedReason           *string       `json:"closedReason"`
	Priority               string        `json:"priority"`
	PrioritySource         string        `json:"prioritySource"`
	Category               *RefDTO       `json:"category"`
	CategoryOther          *string       `json:"categoryOther"`
	Symptoms               []RefDTO      `json:"symptoms"`
	SymptomOther           *string       `json:"symptomOther"`
	Building               RefDTO        `json:"building"`
	Floor                  RefDTO        `json:"floor"`
	Room                   *RefDTO       `json:"room"` // CR-014; null on older tickets
	LocationDetail         *string       `json:"locationDetail"`
	ThumbURL               *string       `json:"thumbUrl"`
	Reporter               PersonRefDTO  `json:"reporter"`
	Technician             *PersonRefDTO `json:"technician"`
	ViewerRelation         string        `json:"viewerRelation"`
	AwaitingMyConfirmation bool          `json:"awaitingMyConfirmation"`
	ExpectedDoneOn         *string       `json:"expectedDoneOn"`
	WorkBy                 *string       `json:"workBy"`
	Contractor             *RefDTO       `json:"contractor"`
	ContractorTypes        []string      `json:"contractorTypes"`
	AutoCloseAt            *time.Time    `json:"autoCloseAt"`
	SendBackCount          int32         `json:"sendBackCount"`
	Rating                 *int16        `json:"rating"`
	CreatedAt              time.Time     `json:"createdAt"`
	AssessedAt             *time.Time    `json:"assessedAt"`
	ResolvedAt             *time.Time    `json:"resolvedAt"`
	ClosedAt               *time.Time    `json:"closedAt"`
	UpdatedAt              time.Time     `json:"updatedAt"`
}

type AssetDTO struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type TicketResultDTO struct {
	Note                    string        `json:"note"`
	Photos                  []PhotoDTO    `json:"photos"`
	By                      *PersonRefDTO `json:"by"`
	At                      *time.Time    `json:"at"`
	ContractorRating        *int16        `json:"contractorRating"`
	ContractorRatingComment *string       `json:"contractorRatingComment"`
}

type TimelineEventDTO struct {
	ID     uuid.UUID       `json:"id"`
	Type   string          `json:"type"`
	Actor  *PersonRefDTO   `json:"actor"`
	At     time.Time       `json:"at"`
	Note   *string         `json:"note"`
	Photos []PhotoDTO      `json:"photos"`
	Data   json.RawMessage `json:"data"`
}

type TicketDetailDTO struct {
	TicketSummaryDTO
	Details         *string            `json:"details"`
	Photos          []PhotoDTO         `json:"photos"`
	Asset           *AssetDTO          `json:"asset"`
	SubscriberCount int64              `json:"subscriberCount"`
	Result          *TicketResultDTO   `json:"result"`
	RatingComment   *string            `json:"ratingComment"`
	Timeline        []TimelineEventDTO `json:"timeline"`
	AllowedActions  []string           `json:"allowedActions"`
	BlockedActions  map[string]string  `json:"blockedActions"`
}

// #7
type TicketCountsDTO struct {
	InProgress             int64 `json:"inProgress"`
	Resolved               int64 `json:"resolved"`
	Closed                 int64 `json:"closed"`
	AwaitingAssessment     int64 `json:"awaitingAssessment"`
	InRepair               int64 `json:"inRepair"`
	AwaitingMyConfirmation int64 `json:"awaitingMyConfirmation"`
}

// #9
// contractorId stays a string so a bad id becomes a field error.
type AssessRequest struct {
	ExpectedDoneOn string `json:"expectedDoneOn"`
	WorkBy         string `json:"workBy"`
	ContractorID   string `json:"contractorId"`
	Reason         string `json:"reason"` // CR-008, optional on a change
}

// #10
type ResolveRequest struct {
	Note                    string   `json:"note"`
	PhotoIDs                []string `json:"photoIds"`
	ContractorRating        *int     `json:"contractorRating"`
	ContractorRatingComment string   `json:"contractorRatingComment"`
}

// #11
type ConfirmRequest struct {
	Rating  *int   `json:"rating"`
	Comment string `json:"comment"`
}

// #12
type SendBackRequest struct {
	Reason   string   `json:"reason"`
	PhotoIDs []string `json:"photoIds"`
}

// #14
type ContractorTypeRequest struct {
	Name string `json:"name"`
}

// #16 / #18. isActive is used by #18 only.
type ContractorRequest struct {
	Name        string   `json:"name"`
	TypeIDs     []string `json:"typeIds"`
	ContactName string   `json:"contactName"`
	Phone       string   `json:"phone"`
	Note        string   `json:"note"`
	IsActive    *bool    `json:"isActive"`
}

type ContractorDTO struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Types       []RefDTO  `json:"types"`
	ContactName *string   `json:"contactName"`
	Phone       *string   `json:"phone"`
	Note        *string   `json:"note"`
	IsActive    bool      `json:"isActive"`
	JobCount    int64     `json:"jobCount"`
	RatedCount  int64     `json:"ratedCount"`
	// null until the contractor has a rating
	AvgRating *float64  `json:"avgRating"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ContractorJobDTO struct {
	TicketID                uuid.UUID  `json:"ticketId"`
	TicketNo                string     `json:"ticketNo"`
	Status                  string     `json:"status"`
	Category                RefDTO     `json:"category"`
	ResolvedAt              *time.Time `json:"resolvedAt"`
	ContractorRating        *int16     `json:"contractorRating"`
	ContractorRatingComment *string    `json:"contractorRatingComment"`
	ReporterRating          *int16     `json:"reporterRating"`
}

func toCategoryDTOs(cats []Category) []CategoryDTO {
	out := make([]CategoryDTO, 0, len(cats))
	for _, c := range cats {
		syms := make([]SymptomDTO, 0, len(c.Symptoms))
		for _, s := range c.Symptoms {
			syms = append(syms, SymptomDTO(s))
		}
		out = append(out, CategoryDTO{
			ID: c.ID, Name: c.Name, Icon: c.Icon, DefaultPriority: c.DefaultPriority, IsOther: c.IsOther,
			AreaTypes: nonNil(c.AreaTypes), Symptoms: syms,
		})
	}
	return out
}

func toRecentPlaceDTOs(list []RecentPlace) []RecentPlaceDTO {
	out := make([]RecentPlaceDTO, 0, len(list))
	for _, p := range list {
		out = append(out, RecentPlaceDTO{
			Building: RefDTO(p.Building), Floor: RefDTO(p.Floor), Room: RefDTO(p.Room),
			LocationDetail: p.LocationDetail, LastReportedAt: p.LastReportedAt.UTC(),
		})
	}
	return out
}

func toBuildingDTOs(blds []Building) []BuildingDTO {
	out := make([]BuildingDTO, 0, len(blds))
	for _, b := range blds {
		floors := make([]FloorDTO, 0, len(b.Floors))
		for _, f := range b.Floors {
			rooms := make([]RoomDTO, 0, len(f.Rooms))
			for _, rm := range f.Rooms {
				rooms = append(rooms, RoomDTO(rm))
			}
			floors = append(floors, FloorDTO{ID: f.ID, Name: f.Name, Level: f.Level, Rooms: rooms})
		}
		out = append(out, BuildingDTO{ID: b.ID, Name: b.Name, Floors: floors})
	}
	return out
}

func toRefDTOs(refs []Ref) []RefDTO {
	out := make([]RefDTO, 0, len(refs))
	for _, r := range refs {
		out = append(out, RefDTO(r))
	}
	return out
}

func toPersonDTO(p *Person) *PersonRefDTO {
	if p == nil {
		return nil
	}
	return &PersonRefDTO{ID: p.ID, Name: p.Name, Department: p.Department}
}

func toPhotoDTO(id uuid.UUID) PhotoDTO {
	base := photoPath + id.String()
	return PhotoDTO{ID: id, ThumbURL: base + "?size=thumb", URL: base + "?size=full"}
}

func toPhotoDTOs(ids []uuid.UUID) []PhotoDTO {
	out := make([]PhotoDTO, 0, len(ids))
	for _, id := range ids {
		out = append(out, toPhotoDTO(id))
	}
	return out
}

func toSummaryDTO(s TicketSummary) TicketSummaryDTO {
	d := TicketSummaryDTO{
		ID: s.ID, TicketNo: s.TicketNo, Status: s.Status, Step: s.Step(), ClosedReason: s.ClosedReason, Priority: s.Priority,
		PrioritySource: s.PrioritySource,
		CategoryOther:  s.CategoryOther, Symptoms: toRefDTOs(s.Symptoms), SymptomOther: s.SymptomOther,
		Building: RefDTO(s.Building), Floor: RefDTO(s.Floor), LocationDetail: s.LocationDetail,
		Reporter:       *toPersonDTO(&s.Reporter),
		Technician:     toPersonDTO(s.Technician),
		ViewerRelation: s.ViewerRelation, AwaitingMyConfirmation: s.AwaitingMyConfirmation,
		WorkBy: s.WorkBy, ContractorTypes: nonNil(s.ContractorTypes),
		AutoCloseAt: utcPtr(s.AutoCloseAt), SendBackCount: s.SendBackCount, Rating: s.Rating,
		CreatedAt: s.CreatedAt.UTC(), AssessedAt: utcPtr(s.AssessedAt), ResolvedAt: utcPtr(s.ResolvedAt), ClosedAt: utcPtr(s.ClosedAt),
		UpdatedAt: s.UpdatedAt.UTC(),
	}
	if s.ExpectedDoneOn != nil {
		day := s.ExpectedDoneOn.Format(time.DateOnly)
		d.ExpectedDoneOn = &day
	}
	if s.Category != nil {
		c := RefDTO(*s.Category)
		d.Category = &c
	}
	if s.Room != nil {
		r := RefDTO(*s.Room)
		d.Room = &r
	}
	if s.Contractor != nil {
		c := RefDTO(*s.Contractor)
		d.Contractor = &c
	}
	if s.ThumbPhotoID != nil {
		u := toPhotoDTO(*s.ThumbPhotoID).ThumbURL
		d.ThumbURL = &u
	}
	return d
}

func toSummaryDTOs(list []TicketSummary) []TicketSummaryDTO {
	out := make([]TicketSummaryDTO, 0, len(list))
	for _, s := range list {
		out = append(out, toSummaryDTO(s))
	}
	return out
}

func toDetailDTO(t TicketDetail) TicketDetailDTO {
	d := TicketDetailDTO{
		TicketSummaryDTO: toSummaryDTO(t.TicketSummary),
		Details:          t.Details, Photos: toPhotoDTOs(t.Photos),
		SubscriberCount: t.SubscriberCount, RatingComment: t.RatingComment,
		AllowedActions: t.AllowedActions, BlockedActions: t.BlockedActions,
	}
	// `asset` is filled from the asset register in Stage 6 (F13-B); until then it stays null.
	if t.Result != nil {
		d.Result = &TicketResultDTO{
			Note: t.Result.Note, Photos: toPhotoDTOs(t.Result.Photos), By: toPersonDTO(t.Result.By), At: utcPtr(t.Result.At),
			ContractorRating: t.Result.ContractorRating, ContractorRatingComment: t.Result.ContractorRatingComment,
		}
	}
	d.Timeline = make([]TimelineEventDTO, 0, len(t.Timeline))
	for _, e := range t.Timeline {
		data := json.RawMessage(e.Data)
		if len(data) == 0 {
			data = json.RawMessage("{}")
		}
		d.Timeline = append(d.Timeline, TimelineEventDTO{
			ID: e.ID, Type: e.Type, Actor: toPersonDTO(e.Actor), At: e.At.UTC(), Note: e.Note, Photos: toPhotoDTOs(e.Photos), Data: data,
		})
	}
	if d.AllowedActions == nil {
		d.AllowedActions = []string{}
	}
	if d.BlockedActions == nil {
		d.BlockedActions = map[string]string{}
	}
	return d
}

func toContractorDTO(c Contractor) ContractorDTO {
	d := ContractorDTO{
		ID: c.ID, Name: c.Name, Types: toRefDTOs(c.Types), ContactName: c.ContactName, Phone: c.Phone, Note: c.Note,
		IsActive: c.IsActive, JobCount: c.JobCount, RatedCount: c.RatedCount, CreatedAt: c.CreatedAt.UTC(), UpdatedAt: c.UpdatedAt.UTC(),
	}
	if c.RatedCount > 0 {
		avg := c.AvgRating
		d.AvgRating = &avg
	}
	return d
}

func toContractorDTOs(list []Contractor) []ContractorDTO {
	out := make([]ContractorDTO, 0, len(list))
	for _, c := range list {
		out = append(out, toContractorDTO(c))
	}
	return out
}

func toContractorJobDTOs(list []ContractorJob) []ContractorJobDTO {
	out := make([]ContractorJobDTO, 0, len(list))
	for _, j := range list {
		out = append(out, ContractorJobDTO{
			TicketID: j.TicketID, TicketNo: j.TicketNo, Status: j.Status, Category: RefDTO(j.Category), ResolvedAt: utcPtr(j.ResolvedAt),
			ContractorRating: j.ContractorRating, ContractorRatingComment: j.ContractorRatingComment, ReporterRating: j.ReporterRating,
		})
	}
	return out
}

// utcPtr: times go over the wire in UTC (architecture.md).
func utcPtr(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	u := t.UTC()
	return &u
}
