package settings

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/audit"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/people"
	"github.com/pithawat/BAMBAM/backend/internal/platform/permissions"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

var registry = permissions.MustRegistry(Permissions)

// fakeRoles answers every write with err (nil = success) and records the last call.
type fakeRoles struct {
	list []roles.Role
	err  error
	last *recorded
}

type recorded struct {
	actor   uuid.UUID
	create  roles.CreateInput
	update  roles.UpdateInput
	version int32
	changes []roles.Change
}

func (f fakeRoles) List(context.Context) ([]roles.Role, error) { return f.list, nil }
func (f fakeRoles) record(c recorded) {
	if f.last != nil {
		*f.last = c
	}
}
func (f fakeRoles) Create(_ context.Context, actor uuid.UUID, in roles.CreateInput) (roles.Role, error) {
	f.record(recorded{actor: actor, create: in})
	return roles.Role{ID: uuid.New(), Key: "r_0a1b2c3d", Name: in.Name}, f.err
}
func (f fakeRoles) Update(_ context.Context, actor, _ uuid.UUID, in roles.UpdateInput) (roles.Role, error) {
	f.record(recorded{actor: actor, update: in})
	return roles.Role{ID: uuid.New()}, f.err
}
func (f fakeRoles) Delete(_ context.Context, actor, _ uuid.UUID) error {
	f.record(recorded{actor: actor})
	return f.err
}
func (f fakeRoles) Matrix(context.Context) (roles.Matrix, error) {
	return roles.Matrix{Systems: registry.Systems(), Roles: []roles.MatrixRole{{Role: f.list[0]}}}, f.err
}
func (f fakeRoles) SaveMatrix(_ context.Context, actor uuid.UUID, version int32, changes []roles.Change) (roles.Matrix, error) {
	f.record(recorded{actor: actor, version: version, changes: changes})
	return roles.Matrix{MatrixMeta: roles.MatrixMeta{Version: version + 1}}, f.err
}

// fakeUsers / fakeAudit stand in for the platform users admin and audit reader (Stage 3).
type fakeUsers struct {
	err   error
	calls *[]string
}

func (f fakeUsers) Search(_ context.Context, in users.SearchInput) ([]users.Summary, int64, error) {
	if f.calls != nil {
		*f.calls = append(*f.calls, "search:"+in.Q)
	}
	return []users.Summary{{User: users.User{ID: uuid.New(), EmployeeCode: "EMP0231"}, RoleRef: users.RoleRef{Key: users.RoleTechnician, Name: "ช่างเทคนิค"}}}, 1, f.err
}
func (f fakeUsers) Get(_ context.Context, _, id uuid.UUID) (users.Summary, string, error) {
	return users.Summary{User: users.User{ID: id, EmployeeCode: "EMP0412"}}, users.ReasonSelf, f.err
}
func (f fakeUsers) ChangeRole(_ context.Context, _, id, _ uuid.UUID) (users.Summary, error) {
	return users.Summary{User: users.User{ID: id}}, f.err
}

type fakeAudit struct{ last *audit.Filter }

func (f fakeAudit) List(_ context.Context, fl audit.Filter) ([]audit.Item, int64, error) {
	if f.last != nil {
		*f.last = fl
	}
	return []audit.Item{{ID: uuid.New(), Action: "role_change", EntityType: "user", EntityName: "วรรณา สุขประเสริฐ",
		Changes: []audit.Change{{Field: "role"}}}}, 1, nil
}
func (fakeAudit) Actors(context.Context) ([]people.Ref, error) {
	return []people.Ref{{ID: uuid.New(), Name: "ณัฐพล อินทรวงศ์"}}, nil
}
func (fakeAudit) RoleHistory(context.Context, uuid.UUID) ([]audit.RoleChange, error) {
	return []audit.RoleChange{{From: "พนักงานทั่วไป", To: "หัวหน้าแม่บ้าน"}}, nil
}

type fixedSession struct{ p middleware.Principal }

func (s fixedSession) Resolve(*gin.Context) (middleware.Principal, error) { return s.p, nil }

var (
	superRole = roles.Role{ID: uuid.New(), Key: users.RoleSuperAdmin, Name: "Superadmin", IsSystem: true, IsLocked: true, UserCount: 1}
	viewerID  = uuid.New()
)

func router(role string) *gin.Engine {
	return routerWith(role, fakeRoles{list: []roles.Role{superRole}})
}

func routerWith(role string, f fakeRoles) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: viewerID, Role: role, Permissions: registry.Effective(role, nil)}
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(NewService(Deps{Roles: f, Users: fakeUsers{}, Audit: fakeAudit{}, Locations: fakeLocations{}, Assets: fakeAssets{}, Repair: fakeRepair{}, Master: fakeMaster{}})))
	return r
}

func call(r http.Handler, method, path string) *httptest.ResponseRecorder {
	return callBody(r, method, path, "")
}

func callBody(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/api/v1/settings"+strings.ReplaceAll(path, ":id", uuid.NewString()), rd)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

// BR-ALL-1 (CR-001): admin reaches only ข้อมูลกลาง (locations, assets, categories); super_admin
// reaches every route; every other role gets 403 everywhere.
func TestRoutePermissions(t *testing.T) {
	adminRoutes := map[string]bool{"13": true, "15": true, "27": true, "46": true, "47": true, "48": true, "49": true, "50": true, "51": true, "52": true, "53": true, "54": true, "55": true}
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
}

func TestServiceChecksPermissionToo(t *testing.T) {
	svc := NewService(Deps{Roles: fakeRoles{}, Users: fakeUsers{}, Audit: fakeAudit{}})
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

func errorCode(w *httptest.ResponseRecorder) string {
	var body struct {
		Error struct {
			Code   string
			Fields map[string]string
		}
	}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	for f, c := range body.Error.Fields {
		return body.Error.Code + " " + f + ":" + c
	}
	return body.Error.Code
}

// #3–#7 happy paths: status codes, body passed through, actor = the logged-in user.
func TestRoleAndMatrixWrites(t *testing.T) {
	var last recorded
	r := routerWith(users.RoleSuperAdmin, fakeRoles{list: []roles.Role{superRole}, last: &last})
	from := uuid.NewString()

	w := callBody(r, "POST", "/roles", `{"name":"หัวหน้าช่าง","description":"ดูแลงานซ่อม","copyFromRoleId":"`+from+`"}`)
	if w.Code != http.StatusCreated || last.actor != viewerID || last.create.Name != "หัวหน้าช่าง" || last.create.CopyFrom == nil || last.create.CopyFrom.String() != from {
		t.Fatalf("POST = %d %s, call %+v", w.Code, w.Body.String(), last)
	}
	if w := callBody(r, "POST", "/roles", `{"name":"ว่าง","copyFromRoleId":null}`); w.Code != http.StatusCreated || last.create.CopyFrom != nil {
		t.Fatalf("POST blank = %d, copyFrom %v", w.Code, last.create.CopyFrom)
	}

	w = callBody(r, "PATCH", "/roles/:id", `{"name":"ช่าง","updatedAt":"2026-10-14T02:00:00.123456Z"}`)
	if w.Code != http.StatusOK || *last.update.Name != "ช่าง" || last.update.Description != nil || last.update.UpdatedAt.Nanosecond() != 123456000 {
		t.Fatalf("PATCH = %d %s, call %+v", w.Code, w.Body.String(), last.update)
	}

	if w := call(r, "DELETE", "/roles/:id"); w.Code != http.StatusNoContent {
		t.Fatalf("DELETE = %d", w.Code)
	}

	w = call(r, "GET", "/permissions")
	var m struct{ Data MatrixResponse }
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil || w.Code != http.StatusOK {
		t.Fatalf("GET matrix = %d %s", w.Code, w.Body.String())
	}
	if len(m.Data.Systems) != 1 || !m.Data.Systems[0].Groups[0].IsFixed || len(m.Data.Systems[0].Groups[0].Permissions) != 7 || m.Data.Roles[0].Permissions == nil {
		t.Fatalf("matrix = %+v", m.Data)
	}

	tech := uuid.NewString()
	w = callBody(r, "PUT", "/permissions", `{"version":12,"changes":[{"roleId":"`+tech+`","permission":"repair.contractor.manage","granted":false}]}`)
	if w.Code != http.StatusOK || last.version != 12 || len(last.changes) != 1 || last.changes[0].RoleID.String() != tech || last.changes[0].Granted {
		t.Fatalf("PUT = %d %s, call %+v", w.Code, w.Body.String(), last)
	}
}

// Controller error mapping for the codes in the contract's Stage 2 section.
func TestRoleErrorMapping(t *testing.T) {
	change := func(perm string) string {
		return `{"version":1,"changes":[{"roleId":"` + uuid.NewString() + `","permission":"` + perm + `","granted":true}]}`
	}
	patch := `{"name":"x","updatedAt":"2026-10-14T02:00:00Z"}`
	cases := []struct {
		err          error
		method, path string
		body         string
		status       int
		code         string
	}{
		{roles.ErrNameTaken, "POST", "/roles", `{"name":"Admin"}`, 409, "NAME_TAKEN"},
		{roles.ErrVersionConflict, "PATCH", "/roles/:id", patch, 409, "VERSION_CONFLICT"},
		{roles.ErrSystemRole, "PATCH", "/roles/:id", patch, 422, "SYSTEM_ROLE"},
		{roles.ErrRoleNotFound, "DELETE", "/roles/:id", "", 404, "ROLE_NOT_FOUND"},
		{roles.ErrRoleInUse, "DELETE", "/roles/:id", "", 409, "ROLE_IN_USE"},
		{roles.ErrSystemRole, "DELETE", "/roles/:id", "", 422, "SYSTEM_ROLE"},
		{roles.ErrVersionConflict, "PUT", "/permissions", change("repair.ticket.work"), 409, "VERSION_CONFLICT"},
		{roles.ErrUnknownPermission, "PUT", "/permissions", change("x"), 400, "UNKNOWN_PERMISSION"},
		{roles.ErrFixedPermission, "PUT", "/permissions", change(PermUsers), 422, "FIXED_PERMISSION"},
	}
	for _, c := range cases {
		w := callBody(routerWith(users.RoleSuperAdmin, fakeRoles{list: []roles.Role{superRole}, err: c.err}), c.method, c.path, c.body)
		if w.Code != c.status || errorCode(w) != c.code {
			t.Errorf("%s %s with %v = %d %s, want %d %s", c.method, c.path, c.err, w.Code, w.Body.String(), c.status, c.code)
		}
	}

	r := router(users.RoleSuperAdmin)
	bad := []struct{ method, path, body, want string }{
		{"POST", "/roles", `{"name":"x","copyFromRoleId":"nope"}`, "VALIDATION_FAILED copyFromRoleId:INVALID"},
		{"POST", "/roles", `not json`, "VALIDATION_FAILED"},
		{"PUT", "/permissions", `{"version":1,"changes":[{"roleId":"nope","permission":"x","granted":true}]}`, "VALIDATION_FAILED changes:INVALID"},
		{"PATCH", "/roles/not-a-uuid", `{"name":"x"}`, "ROLE_NOT_FOUND"},
	}
	for _, b := range bad {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(b.method, "/api/v1/settings"+b.path, strings.NewReader(b.body)))
		if got := errorCode(w); got != b.want {
			t.Errorf("%s %s %s = %d %s, want %s", b.method, b.path, b.body, w.Code, got, b.want)
		}
	}
}

// The service refuses Stage 2 calls without settings.roles.manage even if a route forgot it.
func TestRoleWritesNeedRolesPermission(t *testing.T) {
	svc := NewService(Deps{Roles: fakeRoles{list: []roles.Role{superRole}}, Users: fakeUsers{}, Audit: fakeAudit{}})
	ctx := context.Background()
	v := Viewer{ID: uuid.New(), Permissions: []string{PermUsers, PermLocations}}
	if _, err := svc.CreateRole(ctx, v, roles.CreateInput{Name: "x"}); err == nil {
		t.Error("create allowed")
	}
	if _, err := svc.UpdateRole(ctx, v, uuid.New(), roles.UpdateInput{}); err == nil {
		t.Error("update allowed")
	}
	if err := svc.DeleteRole(ctx, v, uuid.New()); err == nil {
		t.Error("delete allowed")
	}
	if _, err := svc.Matrix(ctx, v); err == nil {
		t.Error("matrix read allowed")
	}
	if _, err := svc.SaveMatrix(ctx, v, 1, nil); err == nil {
		t.Error("matrix save allowed")
	}
}

// Stage 3 (#8–#12): error mapping and query parsing.
func stage3Router(u fakeUsers, a fakeAudit) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: viewerID, Role: users.RoleSuperAdmin, Permissions: registry.Effective(users.RoleSuperAdmin, nil)}
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(NewService(Deps{Roles: fakeRoles{list: []roles.Role{superRole}}, Users: u, Audit: a})))
	return r
}

func TestChangeUserRoleErrors(t *testing.T) {
	cases := []struct {
		err    error
		status int
		code   string
	}{
		{users.ErrCannotChangeSelf, http.StatusUnprocessableEntity, "CANNOT_CHANGE_SELF"},
		{users.ErrRoleLocked, http.StatusUnprocessableEntity, "ROLE_LOCKED"},
		{users.ErrTargetRoleNotFound, http.StatusUnprocessableEntity, "ROLE_NOT_FOUND"},
		{users.ErrUserNotFound, http.StatusNotFound, "USER_NOT_FOUND"},
	}
	for _, tc := range cases {
		w := callBody(stage3Router(fakeUsers{err: tc.err}, fakeAudit{}), "PUT", "/users/:id/role", `{"roleId":"`+uuid.NewString()+`"}`)
		if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.code) {
			t.Errorf("%s: got %d %s", tc.code, w.Code, w.Body.String())
		}
	}
	if w := callBody(stage3Router(fakeUsers{}, fakeAudit{}), "PUT", "/users/:id/role", `{"roleId":"x"}`); w.Code != http.StatusBadRequest {
		t.Errorf("bad roleId: %d", w.Code)
	}
	if w := call(stage3Router(fakeUsers{}, fakeAudit{}), "GET", "/users/not-a-uuid"); w.Code != http.StatusNotFound {
		t.Errorf("bad user id: %d", w.Code)
	}
}

func TestUserDetailShape(t *testing.T) {
	w := call(stage3Router(fakeUsers{}, fakeAudit{}), "GET", "/users/:id")
	var body struct {
		Data struct {
			CanChangeRole      bool    `json:"canChangeRole"`
			CannotChangeReason *string `json:"cannotChangeReason"`
			RoleHistory        []struct {
				From string `json:"from"`
				To   string `json:"to"`
			} `json:"roleHistory"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || w.Code != http.StatusOK {
		t.Fatalf("%d %v", w.Code, err)
	}
	d := body.Data
	if d.CanChangeRole || d.CannotChangeReason == nil || *d.CannotChangeReason != "SELF" || len(d.RoleHistory) != 1 || d.RoleHistory[0].To != "หัวหน้าแม่บ้าน" {
		t.Errorf("detail = %+v", d)
	}
}

func TestAuditQuery(t *testing.T) {
	var last audit.Filter
	r := stage3Router(fakeUsers{}, fakeAudit{last: &last})
	w := call(r, "GET", "/audit?type=permissions&q=%E0%B8%8A&from=2026-10-01T00:00:00Z")
	if w.Code != http.StatusOK || last.PageSize != 50 || !slices.Equal(last.Types, []string{"role"}) || last.Q == nil || last.From == nil {
		t.Errorf("filter = %+v (%d)", last, w.Code)
	}
	if !strings.Contains(w.Body.String(), `"pageSize":50`) {
		t.Errorf("meta: %s", w.Body.String())
	}
	if w := call(r, "GET", "/audit?type=nope&from=yesterday"); w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), `"type":"INVALID"`) || !strings.Contains(w.Body.String(), `"from":"INVALID"`) {
		t.Errorf("invalid query: %d %s", w.Code, w.Body.String())
	}
	if w := call(r, "GET", "/audit/actors"); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "ณัฐพล") {
		t.Errorf("actors: %d", w.Code)
	}
}
