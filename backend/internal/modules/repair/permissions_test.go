package repair

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// CR-007 A / BR-F29-2: with the seeded matrix every role can do exactly what its role name allowed
// before roles became data; super_admin can do everything (BR-F25-1). repair CR-024: no executive.
func TestDefaultMatrixEqualsOldRoleBehaviour(t *testing.T) {
	roles := []string{users.RoleEmployee, users.RoleHousekeeperLead, users.RoleSecurityLead, users.RoleTechnician, users.RoleAdmin, users.RoleSuperAdmin}
	actions := []struct {
		name    string
		allowed func(Viewer) bool
		want    []string // roles allowed before settings Stage 1 (+ super_admin)
	}{
		{"see every ticket / scope=all / staff data (BR-F06-1)", seesAllTickets,
			[]string{users.RoleTechnician, users.RoleAdmin, users.RoleSuperAdmin}},
		{"assess and resolve (F21)", func(v Viewer) bool { return v.Can(PermWork) },
			[]string{users.RoleTechnician, users.RoleSuperAdmin}},
		{"add / edit contractors (F24)", func(v Viewer) bool { return v.Can(PermContractorManage) },
			[]string{users.RoleTechnician, users.RoleSuperAdmin}},
		{"add a contractor type (#14)", func(v Viewer) bool { return v.Can(PermWork) || v.Can(PermContractorManage) },
			[]string{users.RoleTechnician, users.RoleSuperAdmin}},
		{"close any ticket (F08-B)", func(v Viewer) bool { return v.Can(PermCloseAny) },
			[]string{users.RoleAdmin, users.RoleSuperAdmin}},
		{"record a team-handled job (F04)", isLead,
			[]string{users.RoleHousekeeperLead, users.RoleSecurityLead, users.RoleSuperAdmin}},
		{"hand over any team job (F05)", func(v Viewer) bool { return v.Can(PermHandoverAny) },
			[]string{users.RoleAdmin, users.RoleSuperAdmin}},
		{"S29 dashboard and floor plans (F23)", seesDashboard,
			[]string{users.RoleAdmin, users.RoleSuperAdmin}},
		{"place / edit equipment (F31)", managesAssets,
			[]string{users.RoleAdmin, users.RoleSuperAdmin}},
	}
	for _, a := range actions {
		for _, role := range roles {
			got := a.allowed(viewerAs(role, uuid.New()))
			if want := slices.Contains(a.want, role); got != want {
				t.Errorf("%s × %s = %v, want %v", a.name, role, got, want)
			}
		}
	}
}

// The seeded rows of the platform_roles migration equal the catalog defaults.
func TestCatalogStoredDefaults(t *testing.T) {
	want := map[string][]string{
		users.RoleEmployee:        {},
		users.RoleHousekeeperLead: {PermTeamHandle},
		users.RoleSecurityLead:    {PermTeamHandle},
		users.RoleTechnician:      {PermViewAll, PermWork, PermContractorManage},
		users.RoleAdmin:           {PermViewAll, PermCloseAny, PermHandoverAny, PermOverviewView},
		users.RoleSuperAdmin:      {PermViewAll, PermWork, PermCloseAny, PermTeamHandle, PermHandoverAny, PermContractorManage, PermOverviewView},
	}
	for role, keys := range want {
		if got := testRegistry.StoredDefaults(role); !slices.Equal(got, keys) {
			t.Errorf("%s stored defaults = %v, want %v", role, got, keys)
		}
	}
}
