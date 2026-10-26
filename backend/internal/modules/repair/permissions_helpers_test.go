package repair

import (
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// testRegistry is the repair catalog plus the one settings key repair checks (the real settings
// system is registered in main.go).
var testRegistry = permissions.MustRegistry(Permissions, permissions.System{Key: "settings", Groups: []permissions.Group{
	{Key: "settings", Fixed: true, Permissions: []permissions.Permission{
		{Key: permAssetsManage, FixedRoles: []string{users.RoleAdmin, users.RoleSuperAdmin}},
	}},
}})

// viewerAs is a viewer of a seeded role with the default matrix (settings 01-users.md).
func viewerAs(role string, id uuid.UUID) Viewer {
	return Viewer{ID: id, Permissions: testRegistry.Defaults(role)}
}

// principalPerms is the same for controller tests.
func principalPerms(role string) []string { return testRegistry.Defaults(role) }
