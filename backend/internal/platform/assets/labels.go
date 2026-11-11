package assets

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
)

// QR labels (repair CR-036 / settings CR-007, Stage 5B): #56 lists what to print, #57 records what was printed.

var (
	ErrAssetNotActive = apperr.New(apperr.KindBusinessRule, "ASSET_NOT_ACTIVE", "an asset is unknown or inactive")
	// ErrCodeLocked: the printed QR carries the code, so it never changes after a print (repair BR-F13A-5).
	ErrCodeLocked = apperr.New(apperr.KindBusinessRule, "ASSET_CODE_LOCKED", "asset code is on a printed QR label")
)

// MaxLabelsPerPrint is the #57 limit.
const MaxLabelsPerPrint = 500

// Label statuses (contract `labelStatus`, BR-F13A-4).
const (
	LabelNever   = "never"
	LabelCurrent = "current"
	LabelMoved   = "moved"
	LabelChanged = "changed"
)

// LabelSnapshot is the text of a printed label (`platform.assets.label_snapshot`) and, for comparison,
// the same fields as they are today.
type LabelSnapshot struct {
	Code         string    `json:"code"`
	Name         string    `json:"name"`
	BuildingID   uuid.UUID `json:"buildingId"`
	BuildingName string    `json:"buildingName"`
	FloorID      uuid.UUID `json:"floorId"`
	FloorName    string    `json:"floorName"`
	RoomID       uuid.UUID `json:"roomId"`
	RoomName     string    `json:"roomName"`
}

// LabelStatus compares the printed snapshot (nil = never printed) with today's data: another room is
// `moved`; same room but any name (asset, building, floor, room) or the code differs is `changed`.
func LabelStatus(printed *LabelSnapshot, now LabelSnapshot) string {
	switch {
	case printed == nil:
		return LabelNever
	case printed.RoomID != now.RoomID:
		return LabelMoved
	case printed.Code != now.Code || printed.Name != now.Name || printed.BuildingName != now.BuildingName ||
		printed.FloorName != now.FloorName || printed.RoomName != now.RoomName:
		return LabelChanged
	default:
		return LabelCurrent
	}
}

// parseSnapshot reads the jsonb column; empty or unreadable = never printed.
func parseSnapshot(raw []byte) *LabelSnapshot {
	if len(raw) == 0 {
		return nil
	}
	var s LabelSnapshot
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil
	}
	return &s
}

// LabelAsset is one #56 row.
type LabelAsset struct {
	ID             uuid.UUID
	Code, Name     string
	BuildingID     uuid.UUID
	BuildingName   string
	FloorID        uuid.UUID
	FloorName      string
	FloorLevel     int32
	RoomID         uuid.UUID
	RoomName       string
	LabelStatus    string
	LabelPrintedAt *time.Time
}

type LabelFilter struct {
	BuildingID      uuid.UUID
	FloorID, RoomID *uuid.UUID
}

// LabelRepository is the #56 part of Repository.
type LabelRepository interface {
	ActiveBuildingExists(ctx context.Context, id uuid.UUID) (bool, error)
	LabelAssets(ctx context.Context, f LabelFilter) ([]LabelAsset, error)
}

// LabelTx is the #57 part of TxRepository.
type LabelTx interface {
	// LockLabelAssets returns today's label text of the active ids (unknown / inactive ids are left out).
	LockLabelAssets(ctx context.Context, ids []uuid.UUID) ([]LabelSnapshotRow, error)
	MarkLabelPrinted(ctx context.Context, id uuid.UUID, snap LabelSnapshot, actor uuid.UUID) error
}

type LabelSnapshotRow struct {
	ID uuid.UUID
	LabelSnapshot
}

// LabelAssets implements #56: active assets of one active building, floor / room optional.
func (s *Service) LabelAssets(ctx context.Context, f LabelFilter) ([]LabelAsset, error) {
	ok, err := s.repo.ActiveBuildingExists(ctx, f.BuildingID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, locations.ErrBuildingNotFound
	}
	return s.repo.LabelAssets(ctx, f)
}

// labelAudit is the audit `data` of one print (`asset.label_printed`).
type labelAudit struct {
	Count    int         `json:"count"`
	AssetIDs []uuid.UUID `json:"assetIds"`
}

// MarkLabelsPrinted implements #57: snapshot the label text of 1–500 active assets in one transaction;
// any unknown or inactive id saves nothing (ASSET_NOT_ACTIVE). Returns the assets as #48 does.
func (s *Service) MarkLabelsPrinted(ctx context.Context, actor uuid.UUID, ids []uuid.UUID) ([]Asset, error) {
	ids = uniqueIDs(ids)
	switch {
	case len(ids) == 0:
		return nil, apperr.Validation(map[string]string{"assetIds": "REQUIRED"})
	case len(ids) > MaxLabelsPerPrint:
		return nil, apperr.Validation(map[string]string{"assetIds": "TOO_MANY"})
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		rows, err := tx.LockLabelAssets(ctx, ids)
		if err != nil {
			return err
		}
		if len(rows) != len(ids) {
			return ErrAssetNotActive
		}
		for _, r := range rows {
			if err := tx.MarkLabelPrinted(ctx, r.ID, r.LabelSnapshot, actor); err != nil {
				return err
			}
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "asset.label_printed", TargetType: "asset",
			Data: labelAudit{Count: len(ids), AssetIDs: ids}})
	})
	if err != nil {
		return nil, err
	}
	out := make([]Asset, 0, len(ids))
	for _, id := range ids {
		a, err := s.repo.Asset(ctx, id)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
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
