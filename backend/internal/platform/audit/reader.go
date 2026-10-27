package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
)

// Settings audit (F30): what S26 lists and S25 reads as role history. Writers store
// `data = { entityName, parentName?, changes }` (the contract's `AuditEntry` fields, names at write time).

// Entity types (contract `AuditEntry.entityType`) by S26 type filter.
var (
	MasterTypes      = []string{"building", "floor", "room", "category", "symptom", "contractor_type", "asset", "asset_type"}
	PermissionsTypes = []string{"role"}
	UsersTypes       = []string{"user"}
)

// Actions of settings rows; other rows (e.g. `dev.role_switch` on a user) are never listed.
var Actions = []string{"create", "update", "deactivate", "activate", "delete", "reorder", "role_change", "permissions_change", "floor_plan_upload", "floor_plan_delete"}

// TypesFor maps the #11 `type` query (`master` · `permissions` · `users` · empty) to entity types; ok=false = unknown.
func TypesFor(filter string) ([]string, bool) {
	switch filter {
	case "":
		all := append(append(append([]string{}, MasterTypes...), PermissionsTypes...), UsersTypes...)
		return all, true
	case "master":
		return MasterTypes, true
	case "permissions":
		return PermissionsTypes, true
	case "users":
		return UsersTypes, true
	}
	return nil, false
}

// Change is one `changes` item: before / after for a field, or added / removed labels for permissions.
type Change struct {
	Field   string    `json:"field"`
	Before  *string   `json:"before,omitempty"`
	After   *string   `json:"after,omitempty"`
	Added   *[]string `json:"added,omitempty"`
	Removed *[]string `json:"removed,omitempty"`
}

// Data is the stored `data` of a settings row.
type Data struct {
	EntityName string   `json:"entityName"`
	ParentName *string  `json:"parentName,omitempty"`
	Changes    []Change `json:"changes"`
}

// Item is one row as the contract's `AuditEntry`.
type Item struct {
	ID         uuid.UUID
	CreatedAt  time.Time
	Actor      *people.Ref
	Action     string
	EntityType string
	EntityID   string
	EntityName string
	ParentName *string
	Exists     bool
	Changes    []Change
}

// Filter is #11. Types must not be empty (use TypesFor).
type Filter struct {
	Types    []string
	ActorID  *uuid.UUID
	From, To *time.Time
	Q        *string
	Page     int
	PageSize int
}

// RoleChange is one #9 `roleHistory` item.
type RoleChange struct {
	CreatedAt time.Time
	From, To  string
	Actor     *people.Ref
}

type Reader struct {
	q *platformdb.Queries
}

func NewReader(pool *pgxpool.Pool) *Reader { return &Reader{q: platformdb.New(pool)} }

// List returns one page, newest first, and the total.
func (r *Reader) List(ctx context.Context, f Filter) ([]Item, int64, error) {
	total, err := r.q.CountAudit(ctx, platformdb.CountAuditParams{Types: f.Types, Actions: Actions, ActorID: f.ActorID, FromTime: f.From, ToTime: f.To, Q: f.Q})
	if err != nil {
		return nil, 0, err
	}
	rows, err := r.q.ListAudit(ctx, platformdb.ListAuditParams{
		Types: f.Types, Actions: Actions, ActorID: f.ActorID, FromTime: f.From, ToTime: f.To, Q: f.Q,
		Off: int32((f.Page - 1) * f.PageSize), Lim: int32(f.PageSize), // #nosec G115 -- page size ≤ 100, page bounded by the controller
	})
	if err != nil {
		return nil, 0, err
	}
	out := make([]Item, 0, len(rows))
	for _, row := range rows {
		d := decode(row.Data)
		out = append(out, Item{
			ID: row.ID, CreatedAt: row.CreatedAt, Action: row.Action,
			Actor:      ref(row.ActorUserID, row.ActorEmployeeCode, row.ActorFirstNameTh, row.ActorLastNameTh, row.ActorFirstNameEn, row.ActorLastNameEn, row.ActorDepartment),
			EntityType: deref(row.TargetType), EntityID: deref(row.TargetID), EntityName: d.EntityName, ParentName: d.ParentName,
			Exists: row.EntityExists != nil && *row.EntityExists, Changes: d.Changes,
		})
	}
	return out, total, nil
}

// Actors implements #12: everyone with a settings row, by Thai name (sorted in SQL).
func (r *Reader) Actors(ctx context.Context) ([]people.Ref, error) {
	all, _ := TypesFor("")
	rows, err := r.q.ListAuditActors(ctx, platformdb.ListAuditActorsParams{Types: all, Actions: Actions})
	if err != nil {
		return nil, err
	}
	out := make([]people.Ref, 0, len(rows))
	for _, row := range rows {
		code := row.EmployeeCode
		out = append(out, *ref(&row.ID, &code, row.FirstNameTh, row.LastNameTh, row.FirstNameEn, row.LastNameEn, row.Department))
	}
	return out, nil
}

// RoleHistory implements #9 `roleHistory` for one user, newest first.
func (r *Reader) RoleHistory(ctx context.Context, userID uuid.UUID) ([]RoleChange, error) {
	id := userID.String()
	rows, err := r.q.ListUserRoleHistory(ctx, &id)
	if err != nil {
		return nil, err
	}
	out := make([]RoleChange, 0, len(rows))
	for _, row := range rows {
		rc := RoleChange{CreatedAt: row.CreatedAt,
			Actor: ref(row.ActorUserID, row.ActorEmployeeCode, row.ActorFirstNameTh, row.ActorLastNameTh, row.ActorFirstNameEn, row.ActorLastNameEn, row.ActorDepartment)}
		for _, c := range decode(row.Data).Changes {
			if c.Field == "role" {
				rc.From, rc.To = deref(c.Before), deref(c.After)
			}
		}
		out = append(out, rc)
	}
	return out, nil
}

func decode(b []byte) Data {
	var d Data
	_ = json.Unmarshal(b, &d) // rows written before Stage 3 may lack fields: show what there is
	if d.Changes == nil {
		d.Changes = []Change{}
	}
	return d
}

func ref(id *uuid.UUID, code, firstTH, lastTH, firstEN, lastEN, department *string) *people.Ref {
	if id == nil {
		return nil
	}
	return &people.Ref{ID: *id, Name: people.DisplayName(deref(code), firstTH, lastTH, firstEN, lastEN), Department: department}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
