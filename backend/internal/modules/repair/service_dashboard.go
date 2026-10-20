package repair

import (
	"context"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

// CR-016: S29 dashboard (#27), floor plans (#30) and equipment placed in rooms (#29, #31–#34).

// Overview implements #27: key numbers, buildings → floors with open tickets, and the attention list.
// Every number uses the same step rules as S11 (BR-F23-1).
func (s *Service) Overview(ctx context.Context, v Viewer) (Overview, error) {
	if !seesDashboard(v.Role) {
		return Overview{}, apperr.ErrForbidden
	}
	now := s.now()
	dayStart := bangkokDayStart(now)
	today := bangkokDate(now)
	counts, err := s.repo.OverviewCounts(ctx, today, dayStart, dayStart.AddDate(0, 0, -6))
	if err != nil {
		return Overview{}, err
	}
	buildings, err := s.repo.OverviewBuildings(ctx)
	if err != nil {
		return Overview{}, err
	}
	ids, err := s.repo.AttentionTicketIDs(ctx, today, AttentionLimit)
	if err != nil {
		return Overview{}, err
	}
	attention := make([]TicketSummary, 0, len(ids))
	for _, id := range ids {
		d, err := s.repo.GetTicket(ctx, id, v.ID)
		if err != nil {
			return Overview{}, err
		}
		t := d.TicketSummary
		decorate(v, &t)
		attention = append(attention, t)
	}
	return Overview{Counts: counts, Buildings: buildings, Attention: attention}, nil
}

// AssetTypes implements #29 (the palette).
func (s *Service) AssetTypes(ctx context.Context, v Viewer) ([]AssetType, error) {
	if !seesDashboard(v.Role) {
		return nil, apperr.ErrForbidden
	}
	return s.repo.ListAssetTypes(ctx)
}

// FloorPlan implements #30: plan size, rooms with outlines and open tickets, active equipment.
func (s *Service) FloorPlan(ctx context.Context, v Viewer, floorID uuid.UUID) (FloorPlan, error) {
	if !seesDashboard(v.Role) {
		return FloorPlan{}, apperr.ErrForbidden
	}
	return s.repo.GetFloorPlan(ctx, floorID)
}

// SuggestAssetCode implements #34: the next free `{prefix}-{floor}-{nnn}` for the add dialog.
func (s *Service) SuggestAssetCode(ctx context.Context, v Viewer, typeID, floorID uuid.UUID) (string, error) {
	if !managesAssets(v.Role) {
		return "", apperr.ErrForbidden
	}
	t, ok, err := s.repo.ActiveAssetType(ctx, typeID)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrMasterDataChanged
	}
	floor, err := s.repo.ActiveFloorName(ctx, floorID)
	if err != nil {
		return "", err
	}
	taken, err := s.repo.AssetCodesWithPrefix(ctx, t.CodePrefix+"-"+floor+"-")
	if err != nil {
		return "", err
	}
	return nextAssetCode(t.CodePrefix, floor, taken), nil
}

// assetSnapshot is what the audit log keeps before / after a change (BR-F31-5).
type assetSnapshot struct {
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	AssetTypeID uuid.UUID `json:"assetTypeId"`
	RoomID      uuid.UUID `json:"roomId"`
	X           *float64  `json:"x"`
	Z           *float64  `json:"z"`
	RotationDeg int16     `json:"rotationDeg"`
	IsActive    bool      `json:"isActive"`
}

func snapshotOf(a LockedAsset) assetSnapshot {
	return assetSnapshot{Code: a.Code, Name: a.Name, AssetTypeID: a.AssetTypeID, RoomID: a.RoomID, X: a.X, Z: a.Z,
		RotationDeg: a.RotationDeg, IsActive: a.IsActive}
}

// CreateAsset implements #31 (F31 steps 2 and 5): admin adds equipment to a room, optionally at a point.
func (s *Service) CreateAsset(ctx context.Context, v Viewer, in AssetInput) (Asset, error) {
	if !managesAssets(v.Role) {
		return Asset{}, apperr.ErrForbidden
	}
	in, fields := validateAsset(in)
	if in.AssetTypeID == uuid.Nil {
		fields["assetTypeId"] = "REQUIRED"
	}
	if len(fields) > 0 {
		return Asset{}, apperr.Validation(fields)
	}
	if in.RotationDeg == nil {
		zero := 0
		in.RotationDeg = &zero
	}
	id := uuid.New()
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		if _, ok, err := tx.ActiveAssetType(ctx, in.AssetTypeID); err != nil || !ok {
			return orMasterDataChanged(err)
		}
		if err := checkRoomAndCode(ctx, tx, in, uuid.Nil); err != nil {
			return err
		}
		if err := tx.InsertAsset(ctx, id, in, v.ID); err != nil {
			return err
		}
		after := snapshotOf(lockedFrom(id, in, *in.RotationDeg, true))
		return tx.InsertAudit(ctx, v.ID, AuditAssetCreated, id, mustJSON(map[string]any{"after": after}))
	})
	if err != nil {
		return Asset{}, err
	}
	return s.repo.GetAsset(ctx, id)
}

// UpdateAsset implements #32 (F31 steps 3–4): edit code / name or move to another room / point.
// The type never changes; a missing rotation keeps the current one.
func (s *Service) UpdateAsset(ctx context.Context, v Viewer, id uuid.UUID, in AssetInput) (Asset, error) {
	if !managesAssets(v.Role) {
		return Asset{}, apperr.ErrForbidden
	}
	in, fields := validateAsset(in)
	if len(fields) > 0 {
		return Asset{}, apperr.Validation(fields)
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		before, err := tx.LockAsset(ctx, id)
		if err != nil {
			return err
		}
		if !before.IsActive {
			return ErrAssetNotFound
		}
		in.AssetTypeID = before.AssetTypeID
		if in.RotationDeg == nil {
			r := int(before.RotationDeg)
			in.RotationDeg = &r
		}
		if err := checkRoomAndCode(ctx, tx, in, id); err != nil {
			return err
		}
		if err := tx.UpdateAsset(ctx, id, in, v.ID); err != nil {
			return err
		}
		after := snapshotOf(lockedFrom(id, in, *in.RotationDeg, true))
		return tx.InsertAudit(ctx, v.ID, AuditAssetUpdated, id,
			mustJSON(map[string]any{"before": snapshotOf(before), "after": after}))
	})
	if err != nil {
		return Asset{}, err
	}
	return s.repo.GetAsset(ctx, id)
}

// DeactivateAsset implements #33: "เอาออก" = deactivate only; tickets keep pointing at it and the
// code stays taken (BR-F31-4).
func (s *Service) DeactivateAsset(ctx context.Context, v Viewer, id uuid.UUID) error {
	if !managesAssets(v.Role) {
		return apperr.ErrForbidden
	}
	return s.repo.InTx(ctx, func(tx TxRepository) error {
		before, err := tx.LockAsset(ctx, id)
		if err != nil {
			return err
		}
		if !before.IsActive {
			return ErrAssetNotFound
		}
		if err := tx.DeactivateAsset(ctx, id, v.ID); err != nil {
			return err
		}
		after := before
		after.IsActive = false
		return tx.InsertAudit(ctx, v.ID, AuditAssetDeactivated, id,
			mustJSON(map[string]any{"before": snapshotOf(before), "after": snapshotOf(after)}))
	})
}

// checkRoomAndCode: the room is active (BR-F31-2), the point lies inside it (BR-F31-3) and no other
// asset uses the code (BR-F31-1).
func checkRoomAndCode(ctx context.Context, tx TxRepository, in AssetInput, self uuid.UUID) error {
	room, ok, err := tx.PlacementRoom(ctx, in.RoomID)
	if err != nil || !ok {
		return orMasterDataChanged(err)
	}
	if in.X != nil {
		shapes, err := tx.RoomShapesOnFloor(ctx, room.FloorID)
		if err != nil {
			return err
		}
		if err := checkPlacement(in, room, shapes); err != nil {
			return err
		}
	}
	taken, err := tx.AssetCodeTaken(ctx, in.Code, self)
	if err != nil {
		return err
	}
	if taken {
		return ErrAssetCodeTaken
	}
	return nil
}

func orMasterDataChanged(err error) error {
	if err != nil {
		return err
	}
	return ErrMasterDataChanged
}

func lockedFrom(id uuid.UUID, in AssetInput, rotation int, active bool) LockedAsset {
	return LockedAsset{ID: id, AssetTypeID: in.AssetTypeID, RoomID: in.RoomID, Code: in.Code, Name: in.Name,
		X: in.X, Z: in.Z, RotationDeg: int16(rotation), IsActive: active} // #nosec G115 -- validated 0–359
}
