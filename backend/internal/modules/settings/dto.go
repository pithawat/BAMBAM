package settings

import (
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// RoleResponse = `Role` in docs/modules/settings/04-api-contract.md.
type RoleResponse struct {
	ID          string      `json:"id"`
	Key         string      `json:"key"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	IsSystem    bool        `json:"isSystem"`
	IsLocked    bool        `json:"isLocked"`
	UserCount   int64       `json:"userCount"`
	UpdatedAt   time.Time   `json:"updatedAt"`
	UpdatedBy   *people.Ref `json:"updatedBy"`
}

func newRoleResponse(r roles.Role) RoleResponse {
	return RoleResponse{
		ID: r.ID.String(), Key: r.Key, Name: r.Name, Description: r.Description,
		IsSystem: r.IsSystem, IsLocked: r.IsLocked, UserCount: r.UserCount,
		UpdatedAt: r.UpdatedAt.UTC(), UpdatedBy: r.UpdatedBy,
	}
}

// CreateRoleRequest is #3.
type CreateRoleRequest struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	CopyFromRoleID *string `json:"copyFromRoleId"`
}

// UpdateRoleRequest is #4: only the fields that change, plus the `updatedAt` they were based on.
type UpdateRoleRequest struct {
	Name        *string    `json:"name"`
	Description *string    `json:"description"`
	UpdatedAt   *time.Time `json:"updatedAt"`
}

// SaveMatrixRequest is #7.
type SaveMatrixRequest struct {
	Version int32 `json:"version"`
	Changes []struct {
		RoleID     string `json:"roleId"`
		Permission string `json:"permission"`
		Granted    bool   `json:"granted"`
	} `json:"changes"`
}

// MatrixResponse = #6.
type MatrixResponse struct {
	Version   int32                `json:"version"`
	UpdatedAt time.Time            `json:"updatedAt"`
	UpdatedBy *people.Ref          `json:"updatedBy"`
	Systems   []SystemResponse     `json:"systems"`
	Roles     []MatrixRoleResponse `json:"roles"`
}

type SystemResponse struct {
	Key    string          `json:"key"`
	Name   string          `json:"name"`
	Groups []GroupResponse `json:"groups"`
}

type GroupResponse struct {
	Key         string               `json:"key"`
	Name        string               `json:"name"`
	IsFixed     bool                 `json:"isFixed"`
	Permissions []PermissionResponse `json:"permissions"`
}

type PermissionResponse struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

type MatrixRoleResponse struct {
	ID          string   `json:"id"`
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	UserCount   int64    `json:"userCount"`
	IsLocked    bool     `json:"isLocked"`
	Permissions []string `json:"permissions"`
}

func newMatrixResponse(m roles.Matrix) MatrixResponse {
	out := MatrixResponse{Version: m.Version, UpdatedAt: m.UpdatedAt.UTC(), UpdatedBy: m.UpdatedBy,
		Systems: make([]SystemResponse, 0, len(m.Systems)), Roles: make([]MatrixRoleResponse, 0, len(m.Roles))}
	for _, s := range m.Systems {
		sr := SystemResponse{Key: s.Key, Name: s.Name, Groups: make([]GroupResponse, 0, len(s.Groups))}
		for _, g := range s.Groups {
			gr := GroupResponse{Key: g.Key, Name: g.Name, IsFixed: g.Fixed, Permissions: make([]PermissionResponse, 0, len(g.Permissions))}
			for _, p := range g.Permissions {
				gr.Permissions = append(gr.Permissions, PermissionResponse{Key: p.Key, Label: p.Label, Description: p.Description})
			}
			sr.Groups = append(sr.Groups, gr)
		}
		out.Systems = append(out.Systems, sr)
	}
	for _, r := range m.Roles {
		perms := r.Permissions
		if perms == nil {
			perms = []string{}
		}
		out.Roles = append(out.Roles, MatrixRoleResponse{ID: r.ID.String(), Key: r.Key, Name: r.Name,
			UserCount: r.UserCount, IsLocked: r.IsLocked, Permissions: perms})
	}
	return out
}

// ---- Stage 3: users and audit (F15, F30) ----

// UserSummaryResponse = `UserSummary`.
type UserSummaryResponse struct {
	ID              string        `json:"id"`
	EmployeeCode    string        `json:"employeeCode"`
	Name            string        `json:"name"`
	Email           *string       `json:"email"`
	Department      *string       `json:"department"`
	Position        *string       `json:"position"`
	Role            users.RoleRef `json:"role"`
	RoleLockedByEnv bool          `json:"roleLockedByEnv"`
	LastLoginAt     *time.Time    `json:"lastLoginAt"`
}

func newUserSummaryResponse(s users.Summary) UserSummaryResponse {
	var last *time.Time
	if s.LastLoginAt != nil {
		t := s.LastLoginAt.UTC()
		last = &t
	}
	return UserSummaryResponse{ID: s.ID.String(), EmployeeCode: s.EmployeeCode, Name: s.DisplayName(), Email: s.Email,
		Department: s.Department, Position: s.PositionTH, Role: s.RoleRef, RoleLockedByEnv: s.RoleLockedByEnv, LastLoginAt: last}
}

// UserDetailResponse = #9.
type UserDetailResponse struct {
	UserSummaryResponse
	Division           *string               `json:"division"`
	FirstLoginAt       time.Time             `json:"firstLoginAt"`
	CanChangeRole      bool                  `json:"canChangeRole"`
	CannotChangeReason *string               `json:"cannotChangeReason"`
	RoleHistory        []RoleHistoryResponse `json:"roleHistory"`
}

type RoleHistoryResponse struct {
	CreatedAt time.Time   `json:"createdAt"`
	From      string      `json:"from"`
	To        string      `json:"to"`
	Actor     *people.Ref `json:"actor"`
}

func newUserDetailResponse(d UserDetail) UserDetailResponse {
	out := UserDetailResponse{UserSummaryResponse: newUserSummaryResponse(d.Summary), Division: d.Division,
		FirstLoginAt: d.FirstLoginAt.UTC(), CanChangeRole: d.CannotChangeReason == "", RoleHistory: make([]RoleHistoryResponse, 0, len(d.RoleHistory))}
	if d.CannotChangeReason != "" {
		r := d.CannotChangeReason
		out.CannotChangeReason = &r
	}
	for _, h := range d.RoleHistory {
		out.RoleHistory = append(out.RoleHistory, RoleHistoryResponse{CreatedAt: h.CreatedAt.UTC(), From: h.From, To: h.To, Actor: h.Actor})
	}
	return out
}

// ChangeUserRoleRequest is #10.
type ChangeUserRoleRequest struct {
	RoleID string `json:"roleId"`
}

// AuditEntryResponse = `AuditEntry`.
type AuditEntryResponse struct {
	ID         string         `json:"id"`
	CreatedAt  time.Time      `json:"createdAt"`
	Actor      *people.Ref    `json:"actor"`
	Action     string         `json:"action"`
	EntityType string         `json:"entityType"`
	EntityID   string         `json:"entityId"`
	EntityName string         `json:"entityName"`
	ParentName *string        `json:"parentName"`
	Exists     bool           `json:"exists"`
	Changes    []audit.Change `json:"changes"`
}

func newAuditEntryResponse(i audit.Item) AuditEntryResponse {
	return AuditEntryResponse{ID: i.ID.String(), CreatedAt: i.CreatedAt.UTC(), Actor: i.Actor, Action: i.Action,
		EntityType: i.EntityType, EntityID: i.EntityID, EntityName: i.EntityName, ParentName: i.ParentName, Exists: i.Exists, Changes: i.Changes}
}
