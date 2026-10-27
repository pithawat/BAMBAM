package settings

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/modules/repair"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Stage 5 (#32–#45): a fake repair SettingsAdmin and the controller mapping.

type fakeMaster struct {
	err       error
	lastOrder *[]uuid.UUID
}

var sampleCategory = repair.CategoryAdmin{ID: uuid.New(), Name: "ระบบปรับอากาศ", Icon: "snowflake", DefaultPriority: "medium", AreaTypes: []string{}, ActiveSymptomCount: 5}

func (f fakeMaster) Categories(context.Context) ([]repair.CategoryAdmin, error) {
	return []repair.CategoryAdmin{sampleCategory}, f.err
}
func (f fakeMaster) CreateCategory(context.Context, uuid.UUID, repair.CategoryInput) (repair.CategoryAdmin, error) {
	return sampleCategory, f.err
}
func (f fakeMaster) UpdateCategory(context.Context, uuid.UUID, uuid.UUID, repair.CategoryInput) (repair.CategoryAdmin, error) {
	return sampleCategory, f.err
}
func (f fakeMaster) DeleteCategory(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeMaster) ReorderCategories(_ context.Context, _ uuid.UUID, ids []uuid.UUID, _ time.Time) ([]repair.CategoryAdmin, error) {
	if f.lastOrder != nil {
		*f.lastOrder = ids
	}
	return []repair.CategoryAdmin{sampleCategory}, f.err
}
func (f fakeMaster) Symptoms(context.Context, uuid.UUID) ([]repair.SymptomAdmin, error) {
	return []repair.SymptomAdmin{{ID: uuid.New(), Name: "แอร์ไม่เย็น", Priority: "medium"}}, f.err
}
func (f fakeMaster) CreateSymptom(context.Context, uuid.UUID, uuid.UUID, repair.SymptomInput) (repair.SymptomAdmin, error) {
	return repair.SymptomAdmin{ID: uuid.New()}, f.err
}
func (f fakeMaster) UpdateSymptom(context.Context, uuid.UUID, uuid.UUID, repair.SymptomInput) (repair.SymptomAdmin, error) {
	return repair.SymptomAdmin{ID: uuid.New()}, f.err
}
func (f fakeMaster) DeleteSymptom(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeMaster) ReorderSymptoms(context.Context, uuid.UUID, uuid.UUID, []uuid.UUID, time.Time) ([]repair.SymptomAdmin, error) {
	return nil, f.err
}
func (f fakeMaster) ContractorTypes(context.Context) ([]repair.ContractorTypeAdmin, error) {
	return []repair.ContractorTypeAdmin{{ID: uuid.New(), Name: "งานโครงสร้าง", CreatedByTechnician: true}}, f.err
}
func (f fakeMaster) CreateContractorType(context.Context, uuid.UUID, repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error) {
	return repair.ContractorTypeAdmin{ID: uuid.New()}, f.err
}
func (f fakeMaster) UpdateContractorType(context.Context, uuid.UUID, uuid.UUID, repair.ContractorTypeInput) (repair.ContractorTypeAdmin, error) {
	return repair.ContractorTypeAdmin{ID: uuid.New()}, f.err
}
func (f fakeMaster) DeleteContractorType(context.Context, uuid.UUID, uuid.UUID) error { return f.err }

func routerWithMaster(role string, m fakeMaster) http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: viewerID, Role: role, Permissions: registry.Effective(role, nil)}
	svc := NewService(Deps{Roles: fakeRoles{list: []roles.Role{superRole}}, Users: fakeUsers{}, Audit: fakeAudit{},
		Locations: fakeLocations{}, Assets: fakeAssets{}, Repair: fakeRepair{}, Master: m})
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(svc))
	return r
}

func TestMasterMapping(t *testing.T) {
	cases := []struct {
		name, role, method, path, body string
		m                              fakeMaster
		status                         int
		want                           string
	}{
		{"list shape", users.RoleAdmin, "GET", "/categories", "", fakeMaster{}, 200, `"activeSymptomCount":5`},
		{"in use", users.RoleAdmin, "DELETE", "/categories/:id", "", fakeMaster{err: repair.ErrMasterInUse}, 409, "IN_USE"},
		{"symptom taken", users.RoleSuperAdmin, "POST", "/categories/:id/symptoms", `{"name":"แอร์ไม่เย็น","priority":"high"}`, fakeMaster{err: repair.ErrMasterNameTaken}, 409, "NAME_TAKEN"},
		{"order needs version", users.RoleAdmin, "PUT", "/categories/order", `{"ids":[]}`, fakeMaster{}, 400, "version"},
		{"order bad id", users.RoleAdmin, "PUT", "/categories/order", `{"ids":["x"],"version":"2026-10-16T02:11:09Z"}`, fakeMaster{}, 400, "ids"},
		{"order conflict", users.RoleAdmin, "PUT", "/categories/order", `{"ids":[],"version":"2026-10-16T02:11:09Z"}`, fakeMaster{err: repair.ErrMasterVersionChanged}, 409, "VERSION_CONFLICT"},
		{"types badge", users.RoleSuperAdmin, "GET", "/contractor-types", "", fakeMaster{}, 200, `"createdByTechnician":true`},
		{"admin has no contractor types", users.RoleAdmin, "GET", "/contractor-types", "", fakeMaster{}, 403, "FORBIDDEN"},
		{"bad category id", users.RoleAdmin, "PATCH", "/categories/nope", `{}`, fakeMaster{}, 404, "CATEGORY_NOT_FOUND"},
	}
	for _, tc := range cases {
		w := callBody(routerWithMaster(tc.role, tc.m), tc.method, tc.path, tc.body)
		if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.want) {
			t.Errorf("%s: %d %s", tc.name, w.Code, w.Body.String())
		}
	}
}
