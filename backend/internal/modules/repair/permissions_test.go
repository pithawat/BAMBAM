package repair

import (
	"context"
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// CR-007 A / BR-F29-2: with the seeded matrix every role can do exactly what its role name allowed
// before roles became data; super_admin can do everything (BR-F25-1). repair CR-024: no executive.
// settings CR-006: technician no longer reports; the 3D model is admin's.
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
		{"report, scan QR, follow (F02, F03, F13-B; settings CR-006)", reports,
			[]string{users.RoleEmployee, users.RoleHousekeeperLead, users.RoleSecurityLead, users.RoleAdmin, users.RoleSuperAdmin}},
		{"S29 3D model and site view (F23; settings CR-006)", sees3D,
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
	// settings CR-006 adds report (all but technician) and building3d (admin): migration 20261030000002
	want := map[string][]string{
		users.RoleEmployee:        {PermReport},
		users.RoleHousekeeperLead: {PermReport, PermTeamHandle},
		users.RoleSecurityLead:    {PermReport, PermTeamHandle},
		users.RoleTechnician:      {PermViewAll, PermWork, PermContractorManage},
		users.RoleAdmin:           {PermReport, PermViewAll, PermCloseAny, PermHandoverAny, PermOverviewView, PermBuilding3D, permAssetsManage},
		users.RoleSuperAdmin:      {PermReport, PermViewAll, PermWork, PermCloseAny, PermTeamHandle, PermHandoverAny, PermContractorManage, PermOverviewView, PermBuilding3D, permAssetsManage},
	}
	for role, keys := range want {
		if got := testRegistry.StoredDefaults(role); !slices.Equal(got, keys) {
			t.Errorf("%s stored defaults = %v, want %v", role, got, keys)
		}
	}
}

// settings CR-006: without `repair.ticket.report` the create (report) and follow endpoints answer
// 403; a lead's team-handled record needs only team_handle.
func TestReportNeedsPermission(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tech := viewerAs(users.RoleTechnician, uuid.New())
	if _, err := f.svc.CreateTicket(ctx, tech, f.input(f.upload(t, tech))); code(err) != "FORBIDDEN" {
		t.Fatalf("technician report: %v", err)
	}
	if len(f.repo.inserted) != 0 {
		t.Fatal("inserted")
	}
	d := f.report(t, f.reporter)
	if _, err := f.svc.Follow(ctx, tech, d.ID, "", nil); code(err) != "FORBIDDEN" {
		t.Fatalf("technician follow: %v", err)
	}
	if _, err := f.svc.Duplicates(ctx, tech, DuplicateKey{}); code(err) != "FORBIDDEN" {
		t.Fatalf("technician duplicates: %v", err)
	}
	lead := Viewer{ID: uuid.New(), Permissions: []string{PermTeamHandle}}
	if _, err := f.svc.CreateTicket(ctx, lead, f.teamInput(t, lead)); err != nil {
		t.Fatalf("lead without report records team work: %v", err)
	}
	if _, err := f.svc.CreateTicket(ctx, lead, f.input(f.upload(t, lead))); code(err) != "FORBIDDEN" {
		t.Fatalf("lead without report reports: %v", err)
	}
}
