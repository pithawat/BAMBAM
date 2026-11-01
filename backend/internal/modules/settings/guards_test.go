package settings

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// CR-006 guard rules G1–G3. The admin viewer holds locations, users.manage and roles.manage — not audit.
var (
	adminRole  = roles.Role{ID: uuid.New(), Key: users.RoleAdmin, Name: "Admin"}
	techRole   = roles.Role{ID: uuid.New(), Key: users.RoleTechnician, Name: "ช่างเทคนิค"}
	strongRole = roles.Role{ID: uuid.New(), Key: "r_5a7c9e1b", Name: "หัวหน้าอาคาร"}
	adminPerms = []string{PermLocations, PermUsers, PermRoles}
	adminV     = Viewer{ID: viewerID, RoleKey: users.RoleAdmin, Permissions: adminPerms}
	superV     = Viewer{ID: viewerID, RoleKey: users.RoleSuperAdmin, Permissions: registry.Keys()}
)

func guardRoles(last *recorded) fakeRoles {
	return fakeRoles{list: []roles.Role{superRole, adminRole, techRole, strongRole}, last: last, perms: map[uuid.UUID][]string{
		superRole.ID: registry.Keys(), adminRole.ID: adminPerms, techRole.ID: {PermLocations}, strongRole.ID: {PermLocations, PermAudit},
	}}
}

func guardService(last *recorded, u fakeUsers) *Service {
	return NewService(Deps{Roles: guardRoles(last), Users: u, Audit: fakeAudit{}})
}

// rule is the guard rule of err ("" = not a PERMISSION_GUARD).
func rule(err error) string {
	e, ok := apperr.As(err)
	if !ok || e.Code != "PERMISSION_GUARD" || e.Kind != apperr.KindForbidden {
		return ""
	}
	return e.Details.(map[string]string)["rule"]
}

func TestMatrixSaveGuards(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		name   string
		v      Viewer
		change roles.Change
		want   string
	}{
		{"G1 own role", adminV, roles.Change{RoleID: adminRole.ID, Permission: PermLocations}, RuleOwnRole},
		{"G2 super_admin row", adminV, roles.Change{RoleID: superRole.ID, Permission: PermLocations}, RuleSuperAdmin},
		{"G3 tick a key the editor lacks", adminV, roles.Change{RoleID: techRole.ID, Permission: PermAudit, Granted: true}, RuleEscalation},
		{"G3 untick a key the editor lacks", adminV, roles.Change{RoleID: strongRole.ID, Permission: PermAudit}, RuleEscalation},
		{"a key the editor holds, another role", adminV, roles.Change{RoleID: techRole.ID, Permission: PermRoles, Granted: true}, ""},
		{"unknown key goes to the roles service", adminV, roles.Change{RoleID: techRole.ID, Permission: "x.y"}, ""},
		{"unknown role goes to the roles service", adminV, roles.Change{RoleID: uuid.New(), Permission: PermAudit}, ""},
		{"Superadmin may tick anything", superV, roles.Change{RoleID: techRole.ID, Permission: PermAudit, Granted: true}, ""},
	}
	for _, c := range cases {
		var last recorded
		_, err := guardService(&last, fakeUsers{}).SaveMatrix(ctx, c.v, 3, []roles.Change{c.change})
		if got := rule(err); got != c.want || (c.want == "" && err != nil) {
			t.Errorf("%s: err %v, want rule %q", c.name, err, c.want)
		}
		if saved := len(last.changes) == 1; saved != (c.want == "") {
			t.Errorf("%s: roles service called = %v", c.name, saved)
		}
	}
	// one refused cell refuses the whole save
	var last recorded
	_, err := guardService(&last, fakeUsers{}).SaveMatrix(ctx, adminV, 3, []roles.Change{
		{RoleID: techRole.ID, Permission: PermRoles, Granted: true}, {RoleID: adminRole.ID, Permission: PermRoles},
	})
	if rule(err) != RuleOwnRole || last.changes != nil {
		t.Errorf("mixed save: %v, saved %v", err, last.changes)
	}
}

func TestRoleWriteGuards(t *testing.T) {
	ctx := context.Background()
	svc := guardService(nil, fakeUsers{})
	for _, c := range []struct {
		id   uuid.UUID
		want string
	}{{adminRole.ID, RuleOwnRole}, {superRole.ID, RuleSuperAdmin}, {techRole.ID, ""}} {
		if _, err := svc.UpdateRole(ctx, adminV, c.id, roles.UpdateInput{}); rule(err) != c.want {
			t.Errorf("update %v: %v, want %q", c.id, err, c.want)
		}
		if err := svc.DeleteRole(ctx, adminV, c.id); rule(err) != c.want {
			t.Errorf("delete %v: %v, want %q", c.id, err, c.want)
		}
	}
	if _, err := svc.UpdateRole(ctx, superV, superRole.ID, roles.UpdateInput{}); err != nil {
		t.Errorf("Superadmin update goes to the roles service (SYSTEM_ROLE there): %v", err)
	}

	copyFrom := func(v Viewer, id uuid.UUID) error {
		_, err := svc.CreateRole(ctx, v, roles.CreateInput{Name: "ใหม่", CopyFrom: &id})
		return err
	}
	if err := copyFrom(adminV, strongRole.ID); rule(err) != RuleEscalation {
		t.Errorf("copy a stronger role: %v", err)
	}
	if err := copyFrom(adminV, superRole.ID); rule(err) != RuleEscalation {
		t.Errorf("copy super_admin: %v", err)
	}
	for _, ok := range []error{copyFrom(adminV, techRole.ID), copyFrom(adminV, adminRole.ID), copyFrom(superV, strongRole.ID)} {
		if ok != nil {
			t.Errorf("copy within own permissions refused: %v", ok)
		}
	}
	if _, err := svc.CreateRole(ctx, adminV, roles.CreateInput{Name: "ว่าง"}); err != nil {
		t.Errorf("base-only role: %v", err)
	}
}

func TestMatrixAndRolesShowGuards(t *testing.T) {
	ctx := context.Background()
	svc := guardService(nil, fakeUsers{})
	m, err := svc.Matrix(ctx, adminV)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{PermLocations, PermUsers, PermRoles}; !slices.Equal(m.Grantable, want) {
		t.Errorf("grantable = %v, want %v (catalog order)", m.Grantable, want)
	}
	if m.Guards[adminRole.ID] != RuleOwnRole || m.Guards[superRole.ID] != RuleSuperAdmin || len(m.Guards) != 2 {
		t.Errorf("guards = %v", m.Guards)
	}
	if sm, _ := svc.Matrix(ctx, superV); len(sm.Guards) != 0 || len(sm.Grantable) != 8 {
		t.Errorf("Superadmin view: guards %v, grantable %v", sm.Guards, sm.Grantable)
	}

	list, err := svc.Roles(ctx, adminV)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, r := range list {
		got[r.Key] = r.Guard + "/" + map[bool]string{true: "assignable", false: "-"}[r.Assignable]
	}
	want := map[string]string{users.RoleSuperAdmin: "SUPER_ADMIN/-", users.RoleAdmin: "OWN_ROLE/assignable", users.RoleTechnician: "/assignable", strongRole.Key: "/-"}
	for k, w := range want {
		if got[k] != w {
			t.Errorf("role %s = %q, want %q", k, got[k], w)
		}
	}
}

func TestChangeUserRoleGuards(t *testing.T) {
	ctx := context.Background()
	other := uuid.New()
	techRef := users.RoleRef{ID: techRole.ID, Key: techRole.Key}
	cases := []struct {
		name   string
		v      Viewer
		user   uuid.UUID
		cur    users.RoleRef
		target uuid.UUID
		want   string
	}{
		{"G2 to super_admin", adminV, other, techRef, superRole.ID, RuleSuperAdmin},
		{"G2 a Superadmin's role", adminV, other, users.RoleRef{ID: superRole.ID, Key: superRole.Key}, techRole.ID, RuleSuperAdmin},
		{"G3 a role beyond the editor", adminV, other, techRef, strongRole.ID, RuleEscalation},
		{"a role within the editor", adminV, other, techRef, adminRole.ID, ""},
		{"own row stays CANNOT_CHANGE_SELF (users admin)", adminV, viewerID, techRef, strongRole.ID, ""},
		{"Superadmin assigns super_admin", superV, other, techRef, superRole.ID, ""},
	}
	for _, c := range cases {
		_, err := guardService(nil, fakeUsers{role: c.cur}).ChangeUserRole(ctx, c.v, c.user, c.target)
		if rule(err) != c.want || (c.want == "" && err != nil) {
			t.Errorf("%s: %v, want %q", c.name, err, c.want)
		}
	}
	notFound := fakeUsers{err: users.ErrUserNotFound}
	if _, err := guardService(nil, notFound).ChangeUserRole(ctx, adminV, other, techRole.ID); !errors.Is(err, users.ErrUserNotFound) {
		t.Errorf("unknown user: %v", err)
	}
}

func TestUserDetailReasons(t *testing.T) {
	ctx := context.Background()
	superRef := users.RoleRef{ID: superRole.ID, Key: superRole.Key}
	viewOnly := Viewer{ID: viewerID, RoleKey: "r_0a1b2c3d", Permissions: []string{PermUsersView}}
	cases := []struct {
		name string
		v    Viewer
		u    fakeUsers
		want string
	}{
		{"users admin reason wins", viewOnly, fakeUsers{reason: users.ReasonSelf}, users.ReasonSelf},
		{"users.view only", viewOnly, fakeUsers{}, ReasonReadOnly},
		{"a Superadmin seen by Admin", adminV, fakeUsers{role: superRef}, ReasonSuperAdmin},
		{"a Superadmin seen by Superadmin", superV, fakeUsers{role: superRef}, ""},
		{"anyone else", adminV, fakeUsers{role: users.RoleRef{Key: users.RoleTechnician}}, ""},
	}
	for _, c := range cases {
		d, err := guardService(nil, c.u).User(ctx, c.v, uuid.New())
		if err != nil || d.CannotChangeReason != c.want {
			t.Errorf("%s: %q %v, want %q", c.name, d.CannotChangeReason, err, c.want)
		}
	}
}

// The API answers 403 PERMISSION_GUARD with details.rule (contract CR-006).
func TestGuardResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: viewerID, Role: users.RoleAdmin, Permissions: adminPerms}
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(guardService(nil, fakeUsers{})))
	w := callBody(r, "PUT", "/permissions", `{"version":1,"changes":[{"roleId":"`+adminRole.ID.String()+`","permission":"settings.locations.manage","granted":false}]}`)
	if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), `"code":"PERMISSION_GUARD"`) || !strings.Contains(w.Body.String(), `"details":{"rule":"OWN_ROLE"}`) {
		t.Errorf("PUT = %d %s", w.Code, w.Body.String())
	}
	w = call(r, "GET", "/permissions")
	if !strings.Contains(w.Body.String(), `"grantable":["settings.locations.manage","settings.users.manage","settings.roles.manage"]`) || !strings.Contains(w.Body.String(), `"guard":"OWN_ROLE"`) {
		t.Errorf("GET matrix = %s", w.Body.String())
	}
	if w := call(r, "GET", "/roles"); !strings.Contains(w.Body.String(), `"assignable":false`) || !strings.Contains(w.Body.String(), `"guard":"SUPER_ADMIN"`) {
		t.Errorf("GET roles = %s", w.Body.String())
	}
}
