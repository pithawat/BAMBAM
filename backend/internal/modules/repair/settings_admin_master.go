package repair

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	repairdb "github.com/pithawat/BAMBAM/backend/internal/modules/repair/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
)

// settings Stage 5 (F27, F28, #32–#45): categories, symptoms and contractor types as ตั้งค่าระบบ edits them.
// Repair owns the rows and the rules; the settings module calls these methods through its interface.

var (
	ErrCategoryNotFound     = apperr.New(apperr.KindNotFound, "CATEGORY_NOT_FOUND", "category not found")
	ErrSymptomNotFound      = apperr.New(apperr.KindNotFound, "SYMPTOM_NOT_FOUND", "symptom not found")
	ErrContractorTypeGone   = apperr.New(apperr.KindNotFound, "CONTRACTOR_TYPE_NOT_FOUND", "contractor type not found")
	ErrMasterNameTaken      = apperr.New(apperr.KindConflict, "NAME_TAKEN", "name already used")
	ErrMasterInUse          = apperr.New(apperr.KindConflict, "IN_USE", "used before; deactivate instead")
	ErrMasterVersionChanged = apperr.New(apperr.KindConflict, "VERSION_CONFLICT", "changed by someone else")
)

// CategoryIcons a category may use: the 12 S22 choices plus the 4 repair CR-014 master icons, so a seeded category
// keeps its icon when edited (FE map: components/shared/category-icon.ts).
var CategoryIcons = []string{"wrench", "snowflake", "lightbulb", "zap", "plug", "droplets", "shower-head", "armchair", "door-open", "sparkles", "trash-2", "hammer",
	"presentation", "building-2", "square-parking", "ellipsis"}

var (
	priorities = []string{"critical", "high", "medium", "low"}
	areaTypes  = []string{"meeting_room", "restroom", "office", "pantry", "common_area", "parking", "other"}
)

const (
	masterNameMax = 100
	typeNameMax   = MaxTypeNameChars
)

// MasterMeta is the contract's `MasterItem` part shared by categories, symptoms and contractor types.
type MasterMeta struct {
	IsActive  bool
	InUse     bool
	UpdatedAt time.Time
	UpdatedBy *people.Ref
}

type CategoryAdmin struct {
	ID                 uuid.UUID
	Name, Icon         string
	SortOrder          int32
	DefaultPriority    string
	IsOther            bool
	AreaTypes          []string
	SymptomCount       int64
	ActiveSymptomCount int64
	MasterMeta
}

type SymptomAdmin struct {
	ID, CategoryID uuid.UUID
	Name           string
	SortOrder      int32
	Priority       string
	MasterMeta
}

type ContractorTypeAdmin struct {
	ID                  uuid.UUID
	Name                string
	ContractorCount     int64
	CreatedAt           time.Time
	CreatedBy           *people.Ref
	CreatedByTechnician bool
	MasterMeta
}

// CategoryInput is #33 (Name, Icon, DefaultPriority required) and #34 (nil = unchanged; UpdatedAt required).
type CategoryInput struct {
	Name, Icon, DefaultPriority *string
	AreaTypes                   *[]string
	IsActive                    *bool
	UpdatedAt                   time.Time
}

// SymptomInput is #38 (Name, Priority required) and #39.
type SymptomInput struct {
	Name, Priority *string
	IsActive       *bool
	UpdatedAt      time.Time
}

// ContractorTypeInput is #43 (Name required) and #44.
type ContractorTypeInput struct {
	Name      *string
	IsActive  *bool
	UpdatedAt time.Time
}

// masterData is the audit `data` of a master row (S26).
type masterData struct {
	EntityName string         `json:"entityName"`
	ParentName *string        `json:"parentName,omitempty"`
	Changes    []audit.Change `json:"changes"`
}

func masterAudit(actor uuid.UUID, action, entity string, id uuid.UUID, name string, parent *string, changes []audit.Change) audit.Entry {
	if changes == nil {
		changes = []audit.Change{}
	}
	return audit.Entry{ActorID: &actor, Action: action, TargetType: entity, TargetID: id.String(), Data: masterData{EntityName: name, ParentName: parent, Changes: changes}}
}

// action of an edit: activation alone = activate / deactivate, else update.
func editAction(changes []audit.Change, wasActive, isActive bool) string {
	switch {
	case len(changes) > 0:
		return "update"
	case isActive && !wasActive:
		return "activate"
	case !isActive && wasActive:
		return "deactivate"
	}
	return ""
}

func diff(changes []audit.Change, field, before, after string) []audit.Change {
	if before == after {
		return changes
	}
	return append(changes, audit.Change{Field: field, Before: &before, After: &after})
}

func cleanName(fields map[string]string, v *string, max int, required bool) {
	if v == nil {
		if required {
			fields["name"] = "REQUIRED"
		}
		return
	}
	*v = strings.Join(strings.Fields(*v), " ")
	switch {
	case *v == "":
		fields["name"] = "REQUIRED"
	case utf8.RuneCountInString(*v) > max:
		fields["name"] = "TOO_LONG"
	}
}

func oneOf(fields map[string]string, field string, v *string, list []string, required bool) {
	if v == nil {
		if required {
			fields[field] = "REQUIRED"
		}
		return
	}
	if !slices.Contains(list, *v) {
		fields[field] = "INVALID"
	}
}

func notFoundAs(err, as error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return as
	}
	return err
}

func orErrM(err, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}

func (a *SettingsAdmin) inTx(ctx context.Context, fn func(q *repairdb.Queries, tx pgx.Tx) error) error {
	return db.WithTx(ctx, a.pool, func(tx pgx.Tx) error { return fn(repairdb.New(tx), tx) })
}

func personOf(id *uuid.UUID, code, fTH, lTH, fEN, lEN, dept *string) *people.Ref {
	return people.NewRef(id, code, fTH, lTH, fEN, lEN, dept)
}

// ---- categories (#32–#36) ----

// Categories implements #32: every category (active and inactive) in order, with area types and symptom counts.
func (a *SettingsAdmin) Categories(ctx context.Context) ([]CategoryAdmin, error) {
	rows, err := a.q.AdminListCategories(ctx)
	if err != nil {
		return nil, err
	}
	areas, err := a.q.ListCategoryAreaTypes(ctx)
	if err != nil {
		return nil, err
	}
	by := map[uuid.UUID][]string{}
	for _, x := range areas {
		by[x.CategoryID] = append(by[x.CategoryID], x.AreaType)
	}
	out := make([]CategoryAdmin, 0, len(rows))
	for _, r := range rows {
		out = append(out, CategoryAdmin{ID: r.ID, Name: r.Name, Icon: r.Icon, SortOrder: r.SortOrder, DefaultPriority: r.DefaultPriority, IsOther: r.IsOther,
			AreaTypes: nonNil(by[r.ID]), SymptomCount: r.SymptomCount, ActiveSymptomCount: r.ActiveSymptomCount,
			MasterMeta: MasterMeta{IsActive: r.IsActive, InUse: r.InUse, UpdatedAt: r.UpdatedAt,
				UpdatedBy: personOf(r.UpdatedByUserID, r.UpdatedByEmployeeCode, r.UpdatedByFirstNameTh, r.UpdatedByLastNameTh, r.UpdatedByFirstNameEn, r.UpdatedByLastNameEn, r.UpdatedByDepartment)}})
	}
	return out, nil
}

func (a *SettingsAdmin) category(ctx context.Context, id uuid.UUID) (CategoryAdmin, error) {
	list, err := a.Categories(ctx)
	if err != nil {
		return CategoryAdmin{}, err
	}
	for _, c := range list {
		if c.ID == id {
			return c, nil
		}
	}
	return CategoryAdmin{}, ErrCategoryNotFound
}

func validateCategory(in *CategoryInput, create bool) map[string]string {
	fields := map[string]string{}
	if create || in.Name != nil {
		cleanName(fields, in.Name, masterNameMax, true)
	}
	oneOf(fields, "icon", in.Icon, CategoryIcons, create)
	oneOf(fields, "defaultPriority", in.DefaultPriority, priorities, create)
	if in.AreaTypes != nil {
		for _, t := range *in.AreaTypes {
			if !slices.Contains(areaTypes, t) {
				fields["areaTypes"] = "INVALID"
			}
		}
	}
	return fields
}

func (a *SettingsAdmin) setAreaTypes(ctx context.Context, q *repairdb.Queries, id uuid.UUID, list []string) error {
	if err := q.AdminClearCategoryAreaTypes(ctx, id); err != nil {
		return err
	}
	for _, t := range list {
		if err := q.AdminInsertCategoryAreaType(ctx, repairdb.AdminInsertCategoryAreaTypeParams{CategoryID: id, AreaType: t}); err != nil {
			return err
		}
	}
	return nil
}

// CreateCategory implements #33: name unique (case-insensitive), icon from the 12, default priority required; goes last.
func (a *SettingsAdmin) CreateCategory(ctx context.Context, actor uuid.UUID, in CategoryInput) (CategoryAdmin, error) {
	if fields := validateCategory(&in, true); len(fields) > 0 {
		return CategoryAdmin{}, apperr.Validation(fields)
	}
	id := uuid.New()
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		if taken, err := q.AdminCategoryNameTaken(ctx, repairdb.AdminCategoryNameTakenParams{Name: *in.Name, SelfID: id}); err != nil || taken {
			return orErrM(err, ErrMasterNameTaken)
		}
		if err := q.AdminInsertCategory(ctx, repairdb.AdminInsertCategoryParams{ID: id, Name: *in.Name, Icon: *in.Icon, DefaultPriority: *in.DefaultPriority, ActorID: &actor}); err != nil {
			return err
		}
		if in.AreaTypes != nil {
			if err := a.setAreaTypes(ctx, q, id, *in.AreaTypes); err != nil {
				return err
			}
		}
		return audit.Write(ctx, tx, masterAudit(actor, "create", "category", id, *in.Name, nil, nil))
	})
	if err != nil {
		return CategoryAdmin{}, err
	}
	return a.category(ctx, id)
}

// UpdateCategory implements #34: edit fields and / or (de)activate; the "อื่น ๆ" category is always active.
func (a *SettingsAdmin) UpdateCategory(ctx context.Context, actor, id uuid.UUID, in CategoryInput) (CategoryAdmin, error) {
	if fields := validateCategory(&in, false); len(fields) > 0 {
		return CategoryAdmin{}, apperr.Validation(fields)
	}
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockCategory(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrCategoryNotFound)
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrMasterVersionChanged
		}
		next := repairdb.AdminUpdateCategoryParams{ID: id, Name: cur.Name, Icon: cur.Icon, DefaultPriority: cur.DefaultPriority, IsActive: cur.IsActive, ActorID: &actor}
		if in.Name != nil {
			next.Name = *in.Name
		}
		if in.Icon != nil {
			next.Icon = *in.Icon
		}
		if in.DefaultPriority != nil {
			next.DefaultPriority = *in.DefaultPriority
		}
		if in.IsActive != nil {
			next.IsActive = *in.IsActive
		}
		if cur.IsOther && !next.IsActive {
			return apperr.Validation(map[string]string{"isActive": "INVALID"})
		}
		if next.Name != cur.Name {
			if taken, err := q.AdminCategoryNameTaken(ctx, repairdb.AdminCategoryNameTakenParams{Name: next.Name, SelfID: id}); err != nil || taken {
				return orErrM(err, ErrMasterNameTaken)
			}
		}
		var changes []audit.Change
		changes = diff(changes, "name", cur.Name, next.Name)
		changes = diff(changes, "icon", cur.Icon, next.Icon)
		changes = diff(changes, "defaultPriority", cur.DefaultPriority, next.DefaultPriority)
		if in.AreaTypes != nil {
			before, err := q.AdminCategoryAreaTypes(ctx, id)
			if err != nil {
				return err
			}
			after := slices.Clone(*in.AreaTypes)
			slices.Sort(after)
			after = slices.Compact(after)
			if !slices.Equal(before, after) {
				if err := a.setAreaTypes(ctx, q, id, after); err != nil {
					return err
				}
				changes = diff(changes, "areaTypes", strings.Join(before, ", "), strings.Join(after, ", "))
			}
		}
		action := editAction(changes, cur.IsActive, next.IsActive)
		if action == "" {
			return nil
		}
		if err := q.AdminUpdateCategory(ctx, next); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, action, "category", id, next.Name, nil, changes))
	})
	if err != nil {
		return CategoryAdmin{}, err
	}
	return a.category(ctx, id)
}

// DeleteCategory implements #35: only a category no ticket ever used (nor any of its symptoms); never "อื่น ๆ".
func (a *SettingsAdmin) DeleteCategory(ctx context.Context, actor, id uuid.UUID) error {
	return a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockCategory(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrCategoryNotFound)
		}
		used, err := q.AdminCategoryHasUsedSymptom(ctx, id)
		if err != nil {
			return err
		}
		if cur.InUse || used || cur.IsOther {
			return ErrMasterInUse
		}
		for _, step := range []func(context.Context, uuid.UUID) error{q.AdminDeleteCategoryChildren, q.AdminClearCategoryAreaTypes, q.AdminDeleteCategoryLinks, q.AdminDeleteCategory} {
			if err := step(ctx, id); err != nil {
				return err
			}
		}
		return audit.Write(ctx, tx, masterAudit(actor, "delete", "category", id, cur.Name, nil, nil))
	})
}

// latest is the order `version`: the max updated_at of a list as loaded (contract "Order body").
func latest(times []time.Time) time.Time {
	var m time.Time
	for _, t := range times {
		if t.After(m) {
			m = t
		}
	}
	return m
}

func sameSet(ids, current []uuid.UUID) bool {
	if len(ids) != len(current) {
		return false
	}
	seen := map[uuid.UUID]bool{}
	for _, id := range current {
		seen[id] = true
	}
	for _, id := range ids {
		if !seen[id] {
			return false
		}
		delete(seen, id)
	}
	return len(seen) == 0
}

// ReorderCategories implements #36: `ids` = every category in display order; a different set or version → conflict.
func (a *SettingsAdmin) ReorderCategories(ctx context.Context, actor uuid.UUID, ids []uuid.UUID, version time.Time) ([]CategoryAdmin, error) {
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		rows, err := q.AdminListCategories(ctx)
		if err != nil {
			return err
		}
		cur := make([]uuid.UUID, 0, len(rows))
		times := make([]time.Time, 0, len(rows))
		for _, r := range rows {
			cur = append(cur, r.ID)
			times = append(times, r.UpdatedAt)
		}
		if !sameSet(ids, cur) || !latest(times).Equal(version) {
			return ErrMasterVersionChanged
		}
		for i, id := range ids {
			if err := q.AdminSetCategoryOrder(ctx, repairdb.AdminSetCategoryOrderParams{ID: id, SortOrder: int32(i + 1), ActorID: &actor}); err != nil { // #nosec G115 -- a few dozen categories
				return err
			}
		}
		return audit.Write(ctx, tx, masterAudit(actor, "reorder", "category", ids[0], "หมวดงาน", nil, nil))
	})
	if err != nil {
		return nil, err
	}
	return a.Categories(ctx)
}

// ---- symptoms (#37–#41) ----

// Symptoms implements #37 (all symptoms of a category, in order).
func (a *SettingsAdmin) Symptoms(ctx context.Context, categoryID uuid.UUID) ([]SymptomAdmin, error) {
	if _, err := a.category(ctx, categoryID); err != nil {
		return nil, err
	}
	rows, err := a.q.AdminListSymptoms(ctx, categoryID)
	if err != nil {
		return nil, err
	}
	out := make([]SymptomAdmin, 0, len(rows))
	for _, r := range rows {
		out = append(out, SymptomAdmin{ID: r.ID, CategoryID: r.CategoryID, Name: r.Name, SortOrder: r.SortOrder, Priority: r.Priority,
			MasterMeta: MasterMeta{IsActive: r.IsActive, InUse: r.InUse, UpdatedAt: r.UpdatedAt,
				UpdatedBy: personOf(r.UpdatedByUserID, r.UpdatedByEmployeeCode, r.UpdatedByFirstNameTh, r.UpdatedByLastNameTh, r.UpdatedByFirstNameEn, r.UpdatedByLastNameEn, r.UpdatedByDepartment)}})
	}
	return out, nil
}

func (a *SettingsAdmin) symptom(ctx context.Context, categoryID, id uuid.UUID) (SymptomAdmin, error) {
	list, err := a.Symptoms(ctx, categoryID)
	if err != nil {
		return SymptomAdmin{}, err
	}
	for _, s := range list {
		if s.ID == id {
			return s, nil
		}
	}
	return SymptomAdmin{}, ErrSymptomNotFound
}

// CreateSymptom implements #38: name unique in the category; priority required.
func (a *SettingsAdmin) CreateSymptom(ctx context.Context, actor, categoryID uuid.UUID, in SymptomInput) (SymptomAdmin, error) {
	fields := map[string]string{}
	cleanName(fields, in.Name, masterNameMax, true)
	oneOf(fields, "priority", in.Priority, priorities, true)
	if len(fields) > 0 {
		return SymptomAdmin{}, apperr.Validation(fields)
	}
	id := uuid.New()
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cat, err := q.AdminLockCategory(ctx, categoryID)
		if err != nil {
			return notFoundAs(err, ErrCategoryNotFound)
		}
		if taken, err := q.AdminSymptomNameTaken(ctx, repairdb.AdminSymptomNameTakenParams{CategoryID: categoryID, Name: *in.Name, SelfID: id}); err != nil || taken {
			return orErrM(err, ErrMasterNameTaken)
		}
		if err := q.AdminInsertSymptom(ctx, repairdb.AdminInsertSymptomParams{ID: id, CategoryID: categoryID, Name: *in.Name, Priority: *in.Priority, ActorID: &actor}); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, "create", "symptom", id, *in.Name, &cat.Name, nil))
	})
	if err != nil {
		return SymptomAdmin{}, err
	}
	return a.symptom(ctx, categoryID, id)
}

// UpdateSymptom implements #39: no moving to another category (F27).
func (a *SettingsAdmin) UpdateSymptom(ctx context.Context, actor, id uuid.UUID, in SymptomInput) (SymptomAdmin, error) {
	fields := map[string]string{}
	if in.Name != nil {
		cleanName(fields, in.Name, masterNameMax, true)
	}
	oneOf(fields, "priority", in.Priority, priorities, false)
	if len(fields) > 0 {
		return SymptomAdmin{}, apperr.Validation(fields)
	}
	var categoryID uuid.UUID
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockSymptom(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrSymptomNotFound)
		}
		categoryID = cur.CategoryID
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrMasterVersionChanged
		}
		next := repairdb.AdminUpdateSymptomParams{ID: id, Name: cur.Name, Priority: cur.Priority, IsActive: cur.IsActive, ActorID: &actor}
		if in.Name != nil {
			next.Name = *in.Name
		}
		if in.Priority != nil {
			next.Priority = *in.Priority
		}
		if in.IsActive != nil {
			next.IsActive = *in.IsActive
		}
		if next.Name != cur.Name {
			if taken, err := q.AdminSymptomNameTaken(ctx, repairdb.AdminSymptomNameTakenParams{CategoryID: cur.CategoryID, Name: next.Name, SelfID: id}); err != nil || taken {
				return orErrM(err, ErrMasterNameTaken)
			}
		}
		var changes []audit.Change
		changes = diff(changes, "name", cur.Name, next.Name)
		changes = diff(changes, "priority", cur.Priority, next.Priority)
		action := editAction(changes, cur.IsActive, next.IsActive)
		if action == "" {
			return nil
		}
		if err := q.AdminUpdateSymptom(ctx, next); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, action, "symptom", id, next.Name, &cur.CategoryName, changes))
	})
	if err != nil {
		return SymptomAdmin{}, err
	}
	return a.symptom(ctx, categoryID, id)
}

// DeleteSymptom implements #40: only a symptom no ticket ever picked.
func (a *SettingsAdmin) DeleteSymptom(ctx context.Context, actor, id uuid.UUID) error {
	return a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockSymptom(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrSymptomNotFound)
		}
		if cur.InUse {
			return ErrMasterInUse
		}
		if err := q.AdminDeleteSymptom(ctx, id); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, "delete", "symptom", id, cur.Name, &cur.CategoryName, nil))
	})
}

// ReorderSymptoms implements #41.
func (a *SettingsAdmin) ReorderSymptoms(ctx context.Context, actor, categoryID uuid.UUID, ids []uuid.UUID, version time.Time) ([]SymptomAdmin, error) {
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cat, err := q.AdminLockCategory(ctx, categoryID)
		if err != nil {
			return notFoundAs(err, ErrCategoryNotFound)
		}
		rows, err := q.AdminListSymptoms(ctx, categoryID)
		if err != nil {
			return err
		}
		cur := make([]uuid.UUID, 0, len(rows))
		times := make([]time.Time, 0, len(rows))
		for _, r := range rows {
			cur = append(cur, r.ID)
			times = append(times, r.UpdatedAt)
		}
		if len(ids) == 0 || !sameSet(ids, cur) || !latest(times).Equal(version) {
			return ErrMasterVersionChanged
		}
		for i, id := range ids {
			if err := q.AdminSetSymptomOrder(ctx, repairdb.AdminSetSymptomOrderParams{ID: id, SortOrder: int32(i + 1), ActorID: &actor}); err != nil { // #nosec G115 -- a few dozen symptoms
				return err
			}
		}
		return audit.Write(ctx, tx, masterAudit(actor, "reorder", "symptom", categoryID, "อาการ", &cat.Name, nil))
	})
	if err != nil {
		return nil, err
	}
	return a.Symptoms(ctx, categoryID)
}

// ---- contractor types (#42–#45) ----

// ContractorTypes implements #42: all types, Thai name order, with contractor counts and who created them.
func (a *SettingsAdmin) ContractorTypes(ctx context.Context) ([]ContractorTypeAdmin, error) {
	rows, err := a.q.AdminListContractorTypes(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ContractorTypeAdmin, 0, len(rows))
	for _, r := range rows {
		out = append(out, ContractorTypeAdmin{ID: r.ID, Name: r.Name, ContractorCount: r.ContractorCount, CreatedAt: r.CreatedAt,
			CreatedBy:           personOf(r.CreatedByUserID, r.CreatedByEmployeeCode, r.CreatedByFirstNameTh, r.CreatedByLastNameTh, r.CreatedByFirstNameEn, r.CreatedByLastNameEn, r.CreatedByDepartment),
			CreatedByTechnician: r.CreatedByTechnician,
			MasterMeta: MasterMeta{IsActive: r.IsActive, InUse: r.ContractorCount > 0, UpdatedAt: r.UpdatedAt,
				UpdatedBy: personOf(r.UpdatedByUserID, r.UpdatedByEmployeeCode, r.UpdatedByFirstNameTh, r.UpdatedByLastNameTh, r.UpdatedByFirstNameEn, r.UpdatedByLastNameEn, r.UpdatedByDepartment)}})
	}
	return out, nil
}

func (a *SettingsAdmin) contractorType(ctx context.Context, id uuid.UUID) (ContractorTypeAdmin, error) {
	list, err := a.ContractorTypes(ctx)
	if err != nil {
		return ContractorTypeAdmin{}, err
	}
	for _, t := range list {
		if t.ID == id {
			return t, nil
		}
	}
	return ContractorTypeAdmin{}, ErrContractorTypeGone
}

// CreateContractorType implements #43: name unique (case-insensitive, D-041).
func (a *SettingsAdmin) CreateContractorType(ctx context.Context, actor uuid.UUID, in ContractorTypeInput) (ContractorTypeAdmin, error) {
	fields := map[string]string{}
	cleanName(fields, in.Name, typeNameMax, true)
	if len(fields) > 0 {
		return ContractorTypeAdmin{}, apperr.Validation(fields)
	}
	id := uuid.New()
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		if taken, err := q.AdminContractorTypeNameTaken(ctx, repairdb.AdminContractorTypeNameTakenParams{Name: *in.Name, SelfID: id}); err != nil || taken {
			return orErrM(err, ErrMasterNameTaken)
		}
		if err := q.AdminInsertContractorType(ctx, repairdb.AdminInsertContractorTypeParams{ID: id, Name: *in.Name, ActorID: &actor}); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, "create", "contractor_type", id, *in.Name, nil, nil))
	})
	if err != nil {
		return ContractorTypeAdmin{}, err
	}
	return a.contractorType(ctx, id)
}

// UpdateContractorType implements #44: rename and / or (de)activate.
func (a *SettingsAdmin) UpdateContractorType(ctx context.Context, actor, id uuid.UUID, in ContractorTypeInput) (ContractorTypeAdmin, error) {
	fields := map[string]string{}
	if in.Name != nil {
		cleanName(fields, in.Name, typeNameMax, true)
	}
	if len(fields) > 0 {
		return ContractorTypeAdmin{}, apperr.Validation(fields)
	}
	err := a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockContractorType(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrContractorTypeGone)
		}
		if !cur.UpdatedAt.Equal(in.UpdatedAt) {
			return ErrMasterVersionChanged
		}
		next := repairdb.AdminUpdateContractorTypeParams{ID: id, Name: cur.Name, IsActive: cur.IsActive, ActorID: &actor}
		if in.Name != nil {
			next.Name = *in.Name
		}
		if in.IsActive != nil {
			next.IsActive = *in.IsActive
		}
		if !strings.EqualFold(next.Name, cur.Name) {
			if taken, err := q.AdminContractorTypeNameTaken(ctx, repairdb.AdminContractorTypeNameTakenParams{Name: next.Name, SelfID: id}); err != nil || taken {
				return orErrM(err, ErrMasterNameTaken)
			}
		}
		changes := diff(nil, "name", cur.Name, next.Name)
		action := editAction(changes, cur.IsActive, next.IsActive)
		if action == "" {
			return nil
		}
		if err := q.AdminUpdateContractorType(ctx, next); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, action, "contractor_type", id, next.Name, nil, changes))
	})
	if err != nil {
		return ContractorTypeAdmin{}, err
	}
	return a.contractorType(ctx, id)
}

// DeleteContractorType implements #45: only a type no contractor ever had.
func (a *SettingsAdmin) DeleteContractorType(ctx context.Context, actor, id uuid.UUID) error {
	return a.inTx(ctx, func(q *repairdb.Queries, tx pgx.Tx) error {
		cur, err := q.AdminLockContractorType(ctx, id)
		if err != nil {
			return notFoundAs(err, ErrContractorTypeGone)
		}
		if cur.InUse {
			return ErrMasterInUse
		}
		if err := q.AdminDeleteContractorType(ctx, id); err != nil {
			return err
		}
		return audit.Write(ctx, tx, masterAudit(actor, "delete", "contractor_type", id, cur.Name, nil, nil))
	})
}
