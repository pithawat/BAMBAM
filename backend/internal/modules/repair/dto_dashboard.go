package repair

import (
	"time"

	"github.com/google/uuid"
)

// CR-016 shapes: #27, #29–#34 (04-api-contract.md "Stage 3D"). Field names must not change without a CR.

type OverviewCountsDTO struct {
	Open               int64 `json:"open"`
	AwaitingAssessment int64 `json:"awaitingAssessment"`
	InRepair           int64 `json:"inRepair"`
	Reworking          int64 `json:"reworking"`
	AwaitingRating     int64 `json:"awaitingRating"`
	Overdue            int64 `json:"overdue"`
	ReportedToday      int64 `json:"reportedToday"`
	ClosedToday        int64 `json:"closedToday"`
	ClosedLast7Days    int64 `json:"closedLast7Days"`
	// Average reporter rating of tickets closed in the last 7 days, one decimal; null without ratings.
	RatingAvgLast7Days         *float64   `json:"ratingAvgLast7Days"`
	OldestAwaitingAssessmentAt *time.Time `json:"oldestAwaitingAssessmentAt"`
	NextAutoCloseAt            *time.Time `json:"nextAutoCloseAt"`
}

// StepCountsDTO: open tickets per step on a floor (CR-017).
type StepCountsDTO struct {
	AwaitingAssessment int64 `json:"awaitingAssessment"`
	InRepair           int64 `json:"inRepair"`
	AwaitingRating     int64 `json:"awaitingRating"`
}

type OverviewFloorDTO struct {
	ID              uuid.UUID     `json:"id"`
	Name            string        `json:"name"`
	Level           int32         `json:"level"`
	OpenCount       int64         `json:"openCount"`
	HighestPriority *string       `json:"highestPriority"`
	Steps           StepCountsDTO `json:"steps"`
	// open ฉุกเฉิน tickets: the emergency marker on the model (CR-018)
	CriticalCount int64 `json:"criticalCount"`
}

type OverviewBuildingDTO struct {
	ID       uuid.UUID          `json:"id"`
	Name     string             `json:"name"`
	HasModel bool               `json:"hasModel"`
	WidthM   *float64           `json:"widthM"`
	DepthM   *float64           `json:"depthM"`
	Floors   []OverviewFloorDTO `json:"floors"`
}

// OverviewDTO = #27.
type OverviewDTO struct {
	Counts    OverviewCountsDTO     `json:"counts"`
	Buildings []OverviewBuildingDTO `json:"buildings"`
	Attention []TicketSummaryDTO    `json:"attention"`
}

// AssetTypeDTO = #29 item.
type AssetTypeDTO struct {
	ID         uuid.UUID `json:"id"`
	Key        string    `json:"key"`
	Name       string    `json:"name"`
	CodePrefix string    `json:"codePrefix"`
	Icon       string    `json:"icon"`
	Mount      string    `json:"mount"`
}

type AssetTypeRefDTO struct {
	ID   uuid.UUID `json:"id"`
	Key  string    `json:"key"`
	Name string    `json:"name"`
}

// PlacedAssetDTO = `Asset`; the ticket detail keeps its own AssetDTO (code + name) (#30, #31, #32).
type PlacedAssetDTO struct {
	ID          uuid.UUID       `json:"id"`
	Code        string          `json:"code"`
	Name        string          `json:"name"`
	Type        AssetTypeRefDTO `json:"type"`
	Room        RefDTO          `json:"room"`
	X           *float64        `json:"x"`
	Z           *float64        `json:"z"`
	RotationDeg int16           `json:"rotationDeg"`
	OpenTickets int64           `json:"openTickets"`
}

type PlanFloorDTO struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Level int32     `json:"level"`
}

type PlanRoomDTO struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	AreaType        string    `json:"areaType"`
	Shape           Shape     `json:"shape"`
	OpenCount       int64     `json:"openCount"`
	HighestPriority *string   `json:"highestPriority"`
}

// FloorPlanDTO = #30.
type FloorPlanDTO struct {
	Floor    PlanFloorDTO     `json:"floor"`
	Building RefDTO           `json:"building"`
	WidthM   *float64         `json:"widthM"`
	DepthM   *float64         `json:"depthM"`
	ModelURL *string          `json:"modelUrl"`
	Rooms    []PlanRoomDTO    `json:"rooms"`
	Assets   []PlacedAssetDTO `json:"assets"`
}

// AssetRequest = #31 / #32 body (assetTypeId is ignored on #32). Ids stay strings so a bad id becomes
// a field error, not a bind error.
type AssetRequest struct {
	AssetTypeID string   `json:"assetTypeId"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	RoomID      string   `json:"roomId"`
	X           *float64 `json:"x"`
	Z           *float64 `json:"z"`
	RotationDeg *int     `json:"rotationDeg"`
}

// SuggestCodeDTO = #34.
type SuggestCodeDTO struct {
	Code string `json:"code"`
}

func toOverviewDTO(o Overview) OverviewDTO {
	c := o.Counts
	d := OverviewDTO{
		Counts: OverviewCountsDTO{
			Open: c.Open, AwaitingAssessment: c.AwaitingAssessment, InRepair: c.InRepair, Reworking: c.Reworking,
			AwaitingRating: c.AwaitingRating, Overdue: c.Overdue, ReportedToday: c.ReportedToday,
			ClosedToday: c.ClosedToday, ClosedLast7Days: c.ClosedLast7Days, RatingAvgLast7Days: c.RatingAvgLast7Days(),
			OldestAwaitingAssessmentAt: utcPtr(c.OldestAwaitingAssessmentAt), NextAutoCloseAt: utcPtr(c.NextAutoCloseAt),
		},
		Buildings: make([]OverviewBuildingDTO, 0, len(o.Buildings)),
		Attention: toSummaryDTOs(o.Attention),
	}
	for _, b := range o.Buildings {
		bd := OverviewBuildingDTO{ID: b.ID, Name: b.Name, HasModel: b.HasModel, WidthM: b.WidthM, DepthM: b.DepthM, Floors: make([]OverviewFloorDTO, 0, len(b.Floors))}
		for _, f := range b.Floors {
			bd.Floors = append(bd.Floors, OverviewFloorDTO{ID: f.ID, Name: f.Name, Level: f.Level,
				OpenCount: f.Open.Total(), HighestPriority: f.Open.Highest(), Steps: StepCountsDTO(f.Steps),
				CriticalCount: f.Open.Critical})
		}
		d.Buildings = append(d.Buildings, bd)
	}
	return d
}

func toAssetTypeDTOs(list []AssetType) []AssetTypeDTO {
	out := make([]AssetTypeDTO, 0, len(list))
	for _, t := range list {
		out = append(out, AssetTypeDTO(t))
	}
	return out
}

func toPlacedAssetDTO(a Asset) PlacedAssetDTO {
	return PlacedAssetDTO{ID: a.ID, Code: a.Code, Name: a.Name, Type: AssetTypeRefDTO(a.Type), Room: RefDTO(a.Room),
		X: a.X, Z: a.Z, RotationDeg: a.RotationDeg, OpenTickets: a.OpenTickets}
}

func toFloorPlanDTO(p FloorPlan) FloorPlanDTO {
	d := FloorPlanDTO{
		Floor:    PlanFloorDTO{ID: p.Floor.ID, Name: p.Floor.Name, Level: p.Floor.Level},
		Building: RefDTO(p.Building), WidthM: p.WidthM, DepthM: p.DepthM, ModelURL: p.ModelFile,
		Rooms: make([]PlanRoomDTO, 0, len(p.Rooms)), Assets: make([]PlacedAssetDTO, 0, len(p.Assets)),
	}
	for _, r := range p.Rooms {
		d.Rooms = append(d.Rooms, PlanRoomDTO{ID: r.ID, Name: r.Name, AreaType: r.AreaType, Shape: r.Shape,
			OpenCount: r.Open.Total(), HighestPriority: r.Open.Highest()})
	}
	for _, a := range p.Assets {
		d.Assets = append(d.Assets, toPlacedAssetDTO(a))
	}
	return d
}
