package settings

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

var registry = permissions.MustRegistry(Permissions)

type fakeRoles struct{ list []roles.Role }

func (f fakeRoles) List(context.Context) ([]roles.Role, error) { return f.list, nil }

type fixedSession struct{ p middleware.Principal }

func (s fixedSession) Resolve(*gin.Context) (middleware.Principal, error) { return s.p, nil }

func router(role string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: uuid.New(), Role: role, Permissions: registry.Effective(role, nil)}
	svc := NewService(fakeRoles{list: []roles.Role{{ID: uuid.New(), Key: users.RoleSuperAdmin, Name: "Superadmin", IsSystem: true, IsLocked: true, UserCount: 1}}})
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(svc))
	return r
}

func call(r http.Handler, method, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, "/api/v1/settings"+strings.ReplaceAll(path, ":id", uuid.NewString()), nil))
	return w
}

// BR-ALL-1 (CR-001): admin reaches only ข้อมูลกลาง (locations, assets, categories); super_admin
// reaches every route; every other role gets 403 everywhere.
func TestRoutePermissions(t *testing.T) {
	adminRoutes := map[string]bool{"13": true, "15": true, "27": true, "46": true, "47": true, "48": true, "49": true, "50": true, "51": true, "52": true}
	for n := 32; n <= 41; n++ {
		adminRoutes[strconv.Itoa(n)] = true
	}
	for _, role := range []string{users.RoleEmployee, users.RoleTechnician, users.RoleHousekeeperLead, users.RoleSecurityLead, "r_0a1b2c3d", users.RoleAdmin, users.RoleSuperAdmin} {
		r := router(role)
		for _, rt := range routes {
			w := call(r, rt.method, rt.path)
			want := role == users.RoleSuperAdmin || (role == users.RoleAdmin && adminRoutes[rt.no])
			if got := w.Code != http.StatusForbidden; got != want {
				t.Errorf("%s #%s %s %s = %d, allowed want %v", role, rt.no, rt.method, rt.path, w.Code, want)
			}
		}
	}
}

func TestRolesList(t *testing.T) {
	w := call(router(users.RoleSuperAdmin), "GET", "/roles")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	var body struct{ Data []RoleResponse }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || len(body.Data) != 1 || body.Data[0].Key != users.RoleSuperAdmin || !body.Data[0].IsLocked {
		t.Fatalf("body = %s, err = %v", w.Body.String(), err)
	}
	if w := call(router(users.RoleSuperAdmin), "GET", "/users"); w.Code != http.StatusNotImplemented {
		t.Fatalf("a later-stage route = %d, want 501", w.Code)
	}
}

func TestServiceChecksPermissionToo(t *testing.T) {
	svc := NewService(fakeRoles{})
	if _, err := svc.Roles(context.Background(), Viewer{ID: uuid.New(), Permissions: registry.Effective(users.RoleAdmin, nil)}); err == nil {
		t.Fatal("admin read roles, want FORBIDDEN")
	}
	for _, perms := range [][]string{{PermRoles}, {PermUsers}} {
		if _, err := svc.Roles(context.Background(), Viewer{Permissions: perms}); err != nil {
			t.Fatalf("%v: %v", perms, err)
		}
	}
}

func TestFixedGrants(t *testing.T) {
	admin := registry.Effective(users.RoleAdmin, []string{PermUsers}) // a stored settings key is ignored
	if !slices.Equal(admin, []string{PermLocations, PermAssets, PermCategories}) {
		t.Fatalf("admin = %v", admin)
	}
	if got := registry.Effective("r_0a1b2c3d", nil); len(got) != 0 {
		t.Fatalf("custom role = %v, want none (BR-F29-8)", got)
	}
	if got := registry.Effective(users.RoleSuperAdmin, nil); len(got) != 7 {
		t.Fatalf("super_admin = %v, want all 7", got)
	}
}
