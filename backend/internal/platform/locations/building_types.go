package locations

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

// Building types (settings Stage 4P, CR-005, #53–#55): every building has one; a category lists the types it is
// used in (repair). Types are never deleted; one an active building has cannot be deactivated.

type BuildingType struct {
	ID            uuid.UUID
	Name          string
	SortOrder     int32
	IsActive      bool
	BuildingCount int64 // active buildings of the type
	UpdatedAt     time.Time
	UpdatedBy     *people.Ref
}

type LockedType struct {
	Name      string
	IsActive  bool
	InUse     bool // an active building has this type
	UpdatedAt time.Time
}

// TypeInput is #55: nil = unchanged; UpdatedAt required.
type TypeInput struct {
	Name      *string
	IsActive  *bool
	UpdatedAt time.Time
}

// Types implements #53: all types, active first, in order.
func (s *Service) Types(ctx context.Context) ([]BuildingType, error) { return s.repo.Types(ctx) }

func (s *Service) buildingType(ctx context.Context, id uuid.UUID) (BuildingType, error) {
	list, err := s.repo.Types(ctx)
	if err != nil {
		return BuildingType{}, err
	}
	for _, t := range list {
		if t.ID == id {
			return t, nil
		}
	}
	return BuildingType{}, ErrTypeNotFound
}

// ValidTypeName trims and checks a type name (REQUIRED / TOO_LONG) so callers can validate before any write.
func ValidTypeName(name string) (string, error) { return validName(name) }

// CreateType implements #54 for the type itself (settings links its categories through repair):
// unique name (case-insensitive), goes last.
func (s *Service) CreateType(ctx context.Context, actor uuid.UUID, name string) (BuildingType, error) {
	name, err := validName(name)
	if err != nil {
		return BuildingType{}, err
	}
	id := uuid.New()
	err = s.repo.InTx(ctx, func(tx TxRepository) error {
		if taken, err := tx.TypeNameTaken(ctx, name, id); err != nil || taken {
			return orErr(err, ErrNameTaken)
		}
		if err := tx.InsertType(ctx, id, name, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "create", TargetType: "building_type", TargetID: id.String(),
			Data: renameData{EntityName: name, Changes: []audit.Change{}}})
	})
	if err != nil {
		return BuildingType{}, err
	}
	return s.buildingType(ctx, id)
}

// UpdateType implements #55: rename and / or (de)activate; deactivating a type an active building has → IN_USE.
func (s *Service) UpdateType(ctx context.Context, actor, id uuid.UUID, in TypeInput) (BuildingType, error) {
	var name *string
	if in.Name != nil {
		n, err := validName(*in.Name)
		if err != nil {
			return BuildingType{}, err
		}
		name = &n
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockType(ctx, id)
		if err != nil {
			return err
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrVersionConflict
		}
		nextName, nextActive := cur.Name, cur.IsActive
		if name != nil {
			nextName = *name
		}
		if in.IsActive != nil {
			nextActive = *in.IsActive
		}
		if cur.IsActive && !nextActive && cur.InUse {
			return ErrTypeInUse
		}
		changes := []audit.Change{}
		if nextName != cur.Name {
			if taken, err := tx.TypeNameTaken(ctx, nextName, id); err != nil || taken {
				return orErr(err, ErrNameTaken)
			}
			changes = nameChange(cur.Name, nextName)
		}
		action := "update"
		switch {
		case len(changes) > 0:
		case nextActive && !cur.IsActive:
			action = "activate"
		case !nextActive && cur.IsActive:
			action = "deactivate"
		default:
			return nil
		}
		if err := tx.UpdateType(ctx, id, nextName, nextActive, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: action, TargetType: "building_type", TargetID: id.String(),
			Data: renameData{EntityName: nextName, Changes: changes}})
	})
	if err != nil {
		return BuildingType{}, err
	}
	return s.buildingType(ctx, id)
}
