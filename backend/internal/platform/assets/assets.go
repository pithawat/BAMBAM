// Package assets owns equipment in rooms and the equipment types as settings manages them (Stage 4,
// CR-001 / CR-002, #46–#52). Repair S29 places the same assets in 3D through its own endpoints (#29–#34).
package assets

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

var (
	ErrAssetNotFound     = apperr.New(apperr.KindNotFound, "ASSET_NOT_FOUND", "asset not found")
	ErrAssetTypeNotFound = apperr.New(apperr.KindNotFound, "ASSET_TYPE_NOT_FOUND", "asset type not found")
	ErrCodeTaken         = apperr.New(apperr.KindConflict, "ASSET_CODE_TAKEN", "asset code already used")
	ErrNameTaken         = apperr.New(apperr.KindConflict, "NAME_TAKEN", "name already used")
	ErrPrefixTaken       = apperr.New(apperr.KindConflict, "CODE_PREFIX_TAKEN", "code prefix already used")
	ErrVersionConflict   = apperr.New(apperr.KindConflict, "VERSION_CONFLICT", "changed by someone else")
)

var (
	codePattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,50}$`)
	prefixPattern = regexp.MustCompile(`^[A-Z0-9]{2,5}$`)
	// Icons (lucide names) and mounts of a type — the contract's `AssetTypeAdmin` lists.
	Icons  = []string{"box", "air-vent", "mic", "speaker", "tv", "plug", "droplets", "armchair"}
	Mounts = []string{"floor", "wall", "ceiling"}
)

const nameMax = 100

type TypeRef struct {
	ID   uuid.UUID
	Key  string
	Name string
	Icon string
}

// Asset is the contract's `AssetAdmin` (OpenTicketCount is filled by the caller from repair).
type Asset struct {
	ID              uuid.UUID
	Code, Name      string
	IsActive        bool
	Type            TypeRef
	RoomID          uuid.UUID
	Placed          bool
	OpenTicketCount int64
	UpdatedAt       time.Time
	UpdatedBy       *people.Ref
}

// AssetType is the contract's `AssetTypeAdmin`.
type AssetType struct {
	ID               uuid.UUID
	Key, Name        string
	CodePrefix       string
	Icon, Mount      string
	SortOrder        int32
	ActiveAssetCount int64
	UpdatedAt        time.Time
	UpdatedBy        *people.Ref
}

type ListInput struct {
	RoomID          uuid.UUID
	Q               string
	AssetTypeID     *uuid.UUID
	IncludeInactive bool
}

// AssetInput is #47 (all fields) and #48 (nil = unchanged; UpdatedAt required).
type AssetInput struct {
	RoomID      *uuid.UUID
	AssetTypeID *uuid.UUID
	Code, Name  *string
	IsActive    *bool
	UpdatedAt   time.Time
}

// TypeInput is #51 (Name, CodePrefix required) and #52 (nil = unchanged; UpdatedAt required).
type TypeInput struct {
	Name, CodePrefix, Icon, Mount *string
	UpdatedAt                     time.Time
}

// Places resolves active rooms (platform locations).
type Places interface {
	Place(ctx context.Context, roomID uuid.UUID) (locations.Place, bool, error)
}

type Repository interface {
	RoomAssets(ctx context.Context, in ListInput) ([]Asset, error)
	Asset(ctx context.Context, id uuid.UUID) (Asset, error)
	Types(ctx context.Context) ([]AssetType, error)
	// ActiveType returns ok=false for an unknown or inactive type.
	ActiveType(ctx context.Context, id uuid.UUID) (AssetType, bool, error)
	CodesStartingWith(ctx context.Context, prefix string) ([]string, error)
	InTx(ctx context.Context, fn func(tx TxRepository) error) error
}

type LockedAsset struct {
	ID, AssetTypeID, RoomID uuid.UUID
	Code, Name              string
	IsActive                bool
	UpdatedAt               time.Time
}

type TxRepository interface {
	// LockAsset returns ErrAssetNotFound for an unknown id.
	LockAsset(ctx context.Context, id uuid.UUID) (LockedAsset, error)
	CodeTaken(ctx context.Context, code string, self uuid.UUID) (bool, error)
	InsertAsset(ctx context.Context, a LockedAsset, actor uuid.UUID) error
	UpdateAsset(ctx context.Context, a LockedAsset, actor uuid.UUID) error
	// LockType returns ErrAssetTypeNotFound for an unknown or inactive type.
	LockType(ctx context.Context, id uuid.UUID) (AssetType, error)
	TypeNameTaken(ctx context.Context, name string, self uuid.UUID) (bool, error)
	PrefixTaken(ctx context.Context, prefix string, self uuid.UUID) (bool, error)
	InsertType(ctx context.Context, t AssetType, actor uuid.UUID) error
	UpdateType(ctx context.Context, t AssetType, actor uuid.UUID) error
	Audit(ctx context.Context, e audit.Entry) error
}

type Service struct {
	repo   Repository
	places Places
	newKey func() string
}

func NewService(repo Repository, places Places) *Service {
	return &Service{repo: repo, places: places, newKey: randomTypeKey}
}

// randomTypeKey is the stable key of a new type: `t_` + 8 hex (#51).
func randomTypeKey() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return "t_" + hex.EncodeToString(b)
}

// RoomAssets implements #46. Unknown / inactive room → ROOM_NOT_FOUND.
func (s *Service) RoomAssets(ctx context.Context, in ListInput) ([]Asset, error) {
	if _, ok, err := s.places.Place(ctx, in.RoomID); err != nil || !ok {
		return nil, orErr(err, locations.ErrRoomNotFound)
	}
	in.Q = strings.TrimSpace(in.Q)
	return s.repo.RoomAssets(ctx, in)
}

// Types implements #50: active types in sort order with their active asset counts.
func (s *Service) Types(ctx context.Context) ([]AssetType, error) { return s.repo.Types(ctx) }

// SuggestCode implements #49: the next free `{prefix}-{floor name}-{nnn}`, floor from the room (repair #34 rule).
func (s *Service) SuggestCode(ctx context.Context, typeID, roomID uuid.UUID) (string, error) {
	fields := map[string]string{}
	t, ok, err := s.repo.ActiveType(ctx, typeID)
	if err != nil {
		return "", err
	}
	if !ok {
		fields["assetTypeId"] = "INVALID"
	}
	p, okRoom, err := s.places.Place(ctx, roomID)
	if err != nil {
		return "", err
	}
	if !okRoom {
		fields["roomId"] = "INVALID"
	}
	if len(fields) > 0 {
		return "", apperr.Validation(fields)
	}
	base := t.CodePrefix + "-" + p.Floor + "-"
	taken, err := s.repo.CodesStartingWith(ctx, base)
	if err != nil {
		return "", err
	}
	return NextCode(base, taken), nil
}

// NextCode is base + the lowest free 3-digit number (case-insensitive against taken codes).
func NextCode(base string, taken []string) string {
	used := make(map[string]bool, len(taken))
	for _, c := range taken {
		used[strings.ToLower(c)] = true
	}
	for n := 1; ; n++ {
		code := fmt.Sprintf("%s%03d", base, n)
		if !used[strings.ToLower(code)] {
			return code
		}
	}
}

// assetData is the audit `data` of an asset row: name, where it is, what changed (S26).
type assetData struct {
	EntityName string         `json:"entityName"`
	ParentName string         `json:"parentName"`
	Changes    []audit.Change `json:"changes"`
}

func change(field, before, after string) audit.Change {
	return audit.Change{Field: field, Before: &before, After: &after}
}

func validateAssetText(fields map[string]string, code, name *string) {
	if code != nil {
		*code = strings.TrimSpace(*code)
		switch {
		case *code == "":
			fields["code"] = "REQUIRED"
		case !codePattern.MatchString(*code):
			fields["code"] = "INVALID"
		}
	}
	if name != nil {
		*name = strings.TrimSpace(*name)
		switch {
		case *name == "":
			fields["name"] = "REQUIRED"
		case utf8.RuneCountInString(*name) > nameMax:
			fields["name"] = "TOO_LONG"
		}
	}
}

// CreateAsset implements #47: active room and type, unique code (any asset, any case); not placed.
func (s *Service) CreateAsset(ctx context.Context, actor uuid.UUID, in AssetInput) (Asset, error) {
	fields := map[string]string{}
	empty := ""
	if in.Code == nil {
		in.Code = &empty
	}
	if in.Name == nil {
		n := ""
		in.Name = &n
	}
	validateAssetText(fields, in.Code, in.Name)
	var place locations.Place
	if in.RoomID == nil {
		fields["roomId"] = "INVALID"
	} else if p, ok, err := s.places.Place(ctx, *in.RoomID); err != nil {
		return Asset{}, err
	} else if !ok {
		fields["roomId"] = "INVALID"
	} else {
		place = p
	}
	if in.AssetTypeID == nil {
		fields["assetTypeId"] = "INVALID"
	} else if _, ok, err := s.repo.ActiveType(ctx, *in.AssetTypeID); err != nil {
		return Asset{}, err
	} else if !ok {
		fields["assetTypeId"] = "INVALID"
	}
	if len(fields) > 0 {
		return Asset{}, apperr.Validation(fields)
	}
	a := LockedAsset{ID: uuid.New(), AssetTypeID: *in.AssetTypeID, RoomID: *in.RoomID, Code: *in.Code, Name: *in.Name, IsActive: true}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		if taken, err := tx.CodeTaken(ctx, a.Code, a.ID); err != nil || taken {
			return orErr(err, ErrCodeTaken)
		}
		if err := tx.InsertAsset(ctx, a, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "create", TargetType: "asset", TargetID: a.ID.String(),
			Data: assetData{EntityName: a.Name, ParentName: place.ParentName(), Changes: []audit.Change{}}})
	})
	if err != nil {
		return Asset{}, err
	}
	return s.repo.Asset(ctx, a.ID)
}

// UpdateAsset implements #48: code / name / room of an active asset, or (de)activate (`isActive` alone).
// The type never changes; moving to another room clears the 3D position; an inactive asset only reactivates.
func (s *Service) UpdateAsset(ctx context.Context, actor, id uuid.UUID, in AssetInput) (Asset, error) {
	fields := map[string]string{}
	validateAssetText(fields, in.Code, in.Name)
	if len(fields) > 0 {
		return Asset{}, apperr.Validation(fields)
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockAsset(ctx, id)
		if err != nil {
			return err
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrVersionConflict
		}
		next := cur
		editing := in.Code != nil || in.Name != nil || in.RoomID != nil
		if editing && !cur.IsActive {
			return ErrAssetNotFound // repair #32: only active assets are edited; reactivate first
		}
		if in.Code != nil {
			next.Code = *in.Code
		}
		if in.Name != nil {
			next.Name = *in.Name
		}
		if in.IsActive != nil {
			next.IsActive = *in.IsActive
		}
		before, ok, err := s.places.Place(ctx, cur.RoomID)
		if err != nil {
			return err
		}
		if !ok {
			before = locations.Place{RoomID: cur.RoomID}
		}
		after := before
		if in.RoomID != nil && *in.RoomID != cur.RoomID {
			p, ok, err := s.places.Place(ctx, *in.RoomID)
			if err != nil {
				return err
			}
			if !ok {
				return apperr.Validation(map[string]string{"roomId": "INVALID"})
			}
			next.RoomID, after = p.RoomID, p
		}
		if next.Code != cur.Code {
			if taken, err := tx.CodeTaken(ctx, next.Code, id); err != nil || taken {
				return orErr(err, ErrCodeTaken)
			}
		}
		if next == cur {
			return nil
		}
		if err := tx.UpdateAsset(ctx, next, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, assetAudit(actor, cur, next, before, after))
	})
	if err != nil {
		return Asset{}, err
	}
	return s.repo.Asset(ctx, id)
}

// assetAudit: activation changes alone are `activate` / `deactivate`; anything else is `update` with the fields.
func assetAudit(actor uuid.UUID, cur, next LockedAsset, before, after locations.Place) audit.Entry {
	e := audit.Entry{ActorID: &actor, TargetType: "asset", TargetID: cur.ID.String()}
	changes := []audit.Change{}
	if next.Code != cur.Code {
		changes = append(changes, change("code", cur.Code, next.Code))
	}
	if next.Name != cur.Name {
		changes = append(changes, change("name", cur.Name, next.Name))
	}
	if next.RoomID != cur.RoomID {
		changes = append(changes, change("room", before.Building+" "+before.Floor+" · "+before.Room, after.ParentName()))
	}
	switch {
	case len(changes) == 0 && next.IsActive:
		e.Action = "activate"
	case len(changes) == 0:
		e.Action = "deactivate"
	default:
		e.Action = "update"
	}
	e.Data = assetData{EntityName: next.Name, ParentName: after.ParentName(), Changes: changes}
	return e
}

func validateType(fields map[string]string, in *TypeInput, create bool) {
	if in.Name != nil || create {
		n := ""
		if in.Name != nil {
			n = strings.TrimSpace(*in.Name)
		}
		in.Name = &n
		switch {
		case n == "":
			fields["name"] = "REQUIRED"
		case utf8.RuneCountInString(n) > nameMax:
			fields["name"] = "TOO_LONG"
		}
	}
	if in.CodePrefix != nil || create {
		p := ""
		if in.CodePrefix != nil {
			p = strings.ToUpper(strings.TrimSpace(*in.CodePrefix))
		}
		in.CodePrefix = &p
		switch {
		case p == "":
			fields["codePrefix"] = "REQUIRED"
		case !prefixPattern.MatchString(p):
			fields["codePrefix"] = "INVALID"
		}
	}
	if in.Icon != nil && !contains(Icons, *in.Icon) {
		fields["icon"] = "INVALID"
	}
	if in.Mount != nil && !contains(Mounts, *in.Mount) {
		fields["mount"] = "INVALID"
	}
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// typeData is the audit `data` of a type row.
type typeData struct {
	EntityName string         `json:"entityName"`
	Changes    []audit.Change `json:"changes"`
}

// CreateType implements #51: name and prefix unique (case-insensitive), icon `box` and mount `floor` by default; goes last.
func (s *Service) CreateType(ctx context.Context, actor uuid.UUID, in TypeInput) (AssetType, error) {
	fields := map[string]string{}
	validateType(fields, &in, true)
	if len(fields) > 0 {
		return AssetType{}, apperr.Validation(fields)
	}
	t := AssetType{ID: uuid.New(), Key: s.newKey(), Name: *in.Name, CodePrefix: *in.CodePrefix, Icon: "box", Mount: "floor"}
	if in.Icon != nil {
		t.Icon = *in.Icon
	}
	if in.Mount != nil {
		t.Mount = *in.Mount
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		if err := checkTypeUnique(ctx, tx, t); err != nil {
			return err
		}
		if err := tx.InsertType(ctx, t, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "create", TargetType: "asset_type", TargetID: t.ID.String(),
			Data: typeData{EntityName: t.Name, Changes: []audit.Change{}}})
	})
	if err != nil {
		return AssetType{}, err
	}
	return s.typeByID(ctx, t.ID)
}

// UpdateType implements #52: existing asset codes never change; a new prefix only affects suggestions.
func (s *Service) UpdateType(ctx context.Context, actor, id uuid.UUID, in TypeInput) (AssetType, error) {
	fields := map[string]string{}
	validateType(fields, &in, false)
	if len(fields) > 0 {
		return AssetType{}, apperr.Validation(fields)
	}
	err := s.repo.InTx(ctx, func(tx TxRepository) error {
		cur, err := tx.LockType(ctx, id)
		if err != nil {
			return err
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrVersionConflict
		}
		next := cur
		for _, f := range []struct {
			v   *string
			dst *string
		}{{in.Name, &next.Name}, {in.CodePrefix, &next.CodePrefix}, {in.Icon, &next.Icon}, {in.Mount, &next.Mount}} {
			if f.v != nil {
				*f.dst = *f.v
			}
		}
		changes := []audit.Change{}
		for _, c := range []struct{ field, before, after string }{
			{"name", cur.Name, next.Name}, {"codePrefix", cur.CodePrefix, next.CodePrefix}, {"icon", cur.Icon, next.Icon}, {"mount", cur.Mount, next.Mount},
		} {
			if c.before != c.after {
				changes = append(changes, change(c.field, c.before, c.after))
			}
		}
		if len(changes) == 0 {
			return nil
		}
		if err := checkTypeUnique(ctx, tx, next); err != nil {
			return err
		}
		if err := tx.UpdateType(ctx, next, actor); err != nil {
			return err
		}
		return tx.Audit(ctx, audit.Entry{ActorID: &actor, Action: "update", TargetType: "asset_type", TargetID: id.String(),
			Data: typeData{EntityName: next.Name, Changes: changes}})
	})
	if err != nil {
		return AssetType{}, err
	}
	return s.typeByID(ctx, id)
}

func checkTypeUnique(ctx context.Context, tx TxRepository, t AssetType) error {
	if taken, err := tx.TypeNameTaken(ctx, t.Name, t.ID); err != nil || taken {
		return orErr(err, ErrNameTaken)
	}
	if taken, err := tx.PrefixTaken(ctx, t.CodePrefix, t.ID); err != nil || taken {
		return orErr(err, ErrPrefixTaken)
	}
	return nil
}

func (s *Service) typeByID(ctx context.Context, id uuid.UUID) (AssetType, error) {
	list, err := s.repo.Types(ctx)
	if err != nil {
		return AssetType{}, err
	}
	for _, t := range list {
		if t.ID == id {
			return t, nil
		}
	}
	return AssetType{}, ErrAssetTypeNotFound
}

func orErr(err, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
