package settings

import (
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
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
