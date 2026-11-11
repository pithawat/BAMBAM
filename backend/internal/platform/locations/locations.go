// Package locations owns the shared building plan: buildings → floors → rooms (D-048, moved from repair in
// settings Stage 4). Structure comes from the plan (CR-002): this package reads the active tree and renames
// buildings and rooms; nothing here creates, deletes, reorders or deactivates them. Building types (CR-005) are
// edited here too (building_types.go); which categories a type uses belongs to repair.
package locations

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

var (
	ErrBuildingNotFound = apperr.New(apperr.KindNotFound, "BUILDING_NOT_FOUND", "building not found")
	ErrRoomNotFound     = apperr.New(apperr.KindNotFound, "ROOM_NOT_FOUND", "room not found")
	ErrNameTaken        = apperr.New(apperr.KindConflict, "NAME_TAKEN", "name already used")
	ErrVersionConflict  = apperr.New(apperr.KindConflict, "VERSION_CONFLICT", "changed by someone else")
	ErrTypeNotFound     = apperr.New(apperr.KindNotFound, "BUILDING_TYPE_NOT_FOUND", "building type not found")
	ErrTypeInUse        = apperr.New(apperr.KindConflict, "IN_USE", "an active building has this type")
)

const nameMax = 100

// AreaCommon is the per-floor "พื้นที่ส่วนกลางชั้น {n}" room (repair CR-014).
const AreaCommon = "common_area"

type Room struct {
	ID               uuid.UUID
	FloorID          uuid.UUID
	Name             string
	AreaType         string
	ActiveAssetCount int64
	UpdatedAt        time.Time
	UpdatedBy        *people.Ref
}

type Floor struct {
	ID    uuid.UUID
	Name  string
	Level int32
	Rooms []Room
}

// TypeRef is a building's type (#13 `buildingType`, CR-005).
type TypeRef struct {
	ID   uuid.UUID
	Name string
}

type Building struct {
	ID        uuid.UUID
	Name      string
	Type      TypeRef
	UpdatedAt time.Time
	UpdatedBy *people.Ref
	Floors    []Floor
}

// Place is an active room with the names of its floor and building.
type Place struct {
	RoomID, FloorID, BuildingID uuid.UUID
	Room, Floor, Building       string
}

// ParentName is the audit `parentName` of something in the room, e.g. "อาคาร 1 ชั้น 1 · ห้องประชุม 1A".
func (p Place) ParentName() string { return p.Building + " " + p.Floor + " · " + p.Room }

type Repository interface {
	Tree(ctx context.Context) ([]Building, error)
	Types(ctx context.Context) ([]BuildingType, error)
	// Place returns ok=false for an unknown or inactive room (or one on an inactive floor / building).
	Place(ctx context.Context, roomID uuid.UUID) (Place, bool, error)
	InTx(ctx context.Context, fn func(tx TxRepository) error) error
}

type TxRepository interface {
	// LockBuilding returns ErrBuildingNotFound for an unknown or inactive building.
	LockBuilding(ctx context.Context, id uuid.UUID) (LockedBuilding, error)
	BuildingNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error)
	// ActiveType returns ok=false for an unknown or inactive building type.
	ActiveType(ctx context.Context, id uuid.UUID) (TypeRef, bool, error)
	UpdateBuilding(ctx context.Context, id uuid.UUID, name string, typeID, actor uuid.UUID) error
	// LockRoom returns ErrRoomNotFound for an unknown or inactive room.
	LockRoom(ctx context.Context, id uuid.UUID) (LockedRoom, error)
	RoomNameTaken(ctx context.Context, floorID uuid.UUID, name string, self uuid.UUID) (bool, error)
	RenameRoom(ctx context.Context, id uuid.UUID, name string, actor uuid.UUID) error
	// LockType returns ErrTypeNotFound for an unknown type.
	LockType(ctx context.Context, id uuid.UUID) (LockedType, error)
	TypeNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error)
	InsertType(ctx context.Context, id uuid.UUID, name string, actor uuid.UUID) error
	UpdateType(ctx context.Context, id uuid.UUID, name string, active bool, actor uuid.UUID) error
	Audit(ctx context.Context, e audit.Entry) error
}

type LockedBuilding struct {
	Name      string
	UpdatedAt time.Time
	Type      TypeRef
}

type LockedRoom struct {
	ID, FloorID     uuid.UUID
	Name            string
	UpdatedAt       time.Time
	Floor, Building string
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

// Tree implements #13: active buildings → floors bottom first → active rooms.
func (s *Service) Tree(ctx context.Context) ([]Building, error) { return s.repo.Tree(ctx) }

// Place is an active room with its names; ok=false when unknown or inactive.
func (s *Service) Place(ctx context.Context, roomID uuid.UUID) (Place, bool, error) {
	return s.repo.Place(ctx, roomID)
}

func validName(name string) (string, error) {
	name = strings.TrimSpace(name)
	switch {
	case name == "":
		return "", apperr.Validation(map[string]string{"name": "REQUIRED"})
	case utf8.RuneCountInString(name) > nameMax:
		return "", apperr.Validation(map[string]string{"name": "TOO_LONG"})
	}
	return name, nil
}

// renameData is the audit `data` of a rename.
type renameData struct {
	EntityName string         `json:"entityName"`
	ParentName *string        `json:"parentName,omitempty"`
	Changes    []audit.Change `json:"changes"`
}

func nameChange(before, after string) []audit.Change {
	return []audit.Change{{Field: "name", Before: &before, After: &after}}
}

// BuildingInput is #15: Name required; TypeID nil = unchanged (CR-005).
type BuildingInput struct {
	Name      string
	TypeID    *uuid.UUID
	UpdatedAt time.Time
}

// UpdateBuilding implements #15: rename (unique among buildings) and / or change the type to an active one
// (affects new reports only). The id, floors, rooms and assets stay.
func (s *Service) UpdateBuilding(ctx context.Context, actor, id uuid.UUID, in BuildingInput) (Building, error) {
	name, err := validName(in.Name)
	if err != nil {
		return Building{}, err
	}
	err = s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockBuilding(ctx, id)
		if err != nil {
			return err
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrVersionConflict
		}
		next := cur.Type
		if in.TypeID != nil && *in.TypeID != cur.Type.ID {
			t, ok, err := tx.ActiveType(ctx, *in.TypeID)
			if err != nil {
				return err
			}
			if !ok {
				return apperr.Validation(map[string]string{"buildingTypeId": "INVALID"})
			}
			next = t
		}
		changes := []audit.Change{}
		if cur.Name != name {
			if taken, err := tx.BuildingNameTaken(ctx, name, id); err != nil || taken {
				return orErr(err, ErrNameTaken)
			}
			changes = nameChange(cur.Name, name)
		}
		if next.ID != cur.Type.ID {
			changes = append(changes, audit.Change{Field: "buildingType", Before: &cur.Type.Name, After: &next.Name})
		}
		if len(changes) == 0 {
			return nil
		}
		if err := tx.UpdateBuilding(ctx, id, name, next.ID, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "update", TargetType: "building", TargetID: id.String(),
			Data: renameData{EntityName: name, Changes: changes}})
	})
	if err != nil {
		return Building{}, err
	}
	return s.building(ctx, id)
}

// RenameRoom implements #27: rename only; unique on its floor. The common-area room can be renamed too.
func (s *Service) RenameRoom(ctx context.Context, actor, id uuid.UUID, name string, updatedAt time.Time) (Room, error) {
	name, err := validName(name)
	if err != nil {
		return Room{}, err
	}
	err = s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockRoom(ctx, id)
		if err != nil {
			return err
		}
		if !cur.UpdatedAt.Equal(updatedAt) {
			return ErrVersionConflict
		}
		if cur.Name == name {
			return nil
		}
		if taken, err := tx.RoomNameTaken(ctx, cur.FloorID, name, id); err != nil || taken {
			return orErr(err, ErrNameTaken)
		}
		if err := tx.RenameRoom(ctx, id, name, actor); err != nil {
			return err
		}
		parent := cur.Building + " " + cur.Floor
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "update", TargetType: "room", TargetID: id.String(),
			Data: renameData{EntityName: name, ParentName: &parent, Changes: nameChange(cur.Name, name)}})
	})
	if err != nil {
		return Room{}, err
	}
	tree, err := s.repo.Tree(ctx)
	if err != nil {
		return Room{}, err
	}
	for _, b := range tree {
		for _, f := range b.Floors {
			for _, r := range f.Rooms {
				if r.ID == id {
					return r, nil
				}
			}
		}
	}
	return Room{}, ErrRoomNotFound
}

func (s *Service) building(ctx context.Context, id uuid.UUID) (Building, error) {
	tree, err := s.repo.Tree(ctx)
	if err != nil {
		return Building{}, err
	}
	for _, b := range tree {
		if b.ID == id {
			return b, nil
		}
	}
	return Building{}, ErrBuildingNotFound
}

// orErr returns err when set, else fallback (a check that found the rule broken).
func orErr(err, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
