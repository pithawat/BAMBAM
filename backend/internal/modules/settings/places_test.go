package settings

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/assets"
	"github.com/pithawat/BAMBAM/backend/internal/platform/locations"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/roles"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// Stage 4 (#13, #15, #27, #46–#52): fakes for the platform services and the controller mapping.

type fakeLocations struct{ err error }

var planRoom = locations.Room{ID: uuid.New(), Name: "พื้นที่ส่วนกลางชั้น 1", AreaType: locations.AreaCommon, ActiveAssetCount: 2}

func (f fakeLocations) Tree(context.Context) ([]locations.Building, error) {
	return []locations.Building{{ID: uuid.New(), Name: "อาคาร 1", Floors: []locations.Floor{{ID: uuid.New(), Name: "ชั้น 1", Level: 1, Rooms: []locations.Room{planRoom}}}}}, f.err
}
func (f fakeLocations) RenameBuilding(_ context.Context, _, id uuid.UUID, name string, _ time.Time) (locations.Building, error) {
	return locations.Building{ID: id, Name: name, Floors: []locations.Floor{}}, f.err
}
func (f fakeLocations) RenameRoom(_ context.Context, _, id uuid.UUID, name string, _ time.Time) (locations.Room, error) {
	return locations.Room{ID: id, Name: name}, f.err
}

type fakeAssets struct {
	err  error
	last *assets.AssetInput
}

var sampleAsset = assets.Asset{ID: uuid.New(), Code: "AC-1-001", Name: "แอร์ห้องประชุม 1A", IsActive: true, Type: assets.TypeRef{Key: "aircon", Icon: "air-vent"}}

func (f fakeAssets) RoomAssets(context.Context, assets.ListInput) ([]assets.Asset, error) {
	return []assets.Asset{sampleAsset}, f.err
}
func (f fakeAssets) CreateAsset(_ context.Context, _ uuid.UUID, in assets.AssetInput) (assets.Asset, error) {
	if f.last != nil {
		*f.last = in
	}
	return sampleAsset, f.err
}
func (f fakeAssets) UpdateAsset(_ context.Context, _, _ uuid.UUID, in assets.AssetInput) (assets.Asset, error) {
	if f.last != nil {
		*f.last = in
	}
	return sampleAsset, f.err
}
func (f fakeAssets) SuggestCode(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "AC-1-003", f.err
}
func (f fakeAssets) Types(context.Context) ([]assets.AssetType, error) {
	return []assets.AssetType{{ID: uuid.New(), Key: "aircon", Name: "เครื่องปรับอากาศ", CodePrefix: "AC", Icon: "air-vent", Mount: "wall"}}, f.err
}
func (f fakeAssets) CreateType(context.Context, uuid.UUID, assets.TypeInput) (assets.AssetType, error) {
	return assets.AssetType{ID: uuid.New()}, f.err
}
func (f fakeAssets) UpdateType(context.Context, uuid.UUID, uuid.UUID, assets.TypeInput) (assets.AssetType, error) {
	return assets.AssetType{ID: uuid.New()}, f.err
}

type fakeRepair struct{}

func (fakeRepair) OpenTicketCounts(_ context.Context, ids []uuid.UUID) (map[uuid.UUID]int64, error) {
	out := map[uuid.UUID]int64{}
	for _, id := range ids {
		out[id] = 2
	}
	return out, nil
}

func placesRouter(role string, l fakeLocations, a fakeAssets) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	p := middleware.Principal{UserID: viewerID, Role: role, Permissions: registry.Effective(role, nil)}
	svc := NewService(Deps{Roles: fakeRoles{list: []roles.Role{superRole}}, Users: fakeUsers{}, Audit: fakeAudit{}, Locations: l, Assets: a, Repair: fakeRepair{}})
	RegisterRoutes(r.Group("/api/v1/settings", middleware.RequireAuth(fixedSession{p})), NewController(svc))
	return r
}

func TestPlanTreeShape(t *testing.T) {
	w := call(placesRouter(users.RoleAdmin, fakeLocations{}, fakeAssets{}), "GET", "/buildings")
	var body struct {
		Data []PlanBuildingResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || w.Code != http.StatusOK {
		t.Fatalf("%d %v", w.Code, err)
	}
	room := body.Data[0].Floors[0].Rooms[0]
	if !room.IsCommonArea || room.ActiveAssetCount != 2 || room.AreaType != "common_area" {
		t.Errorf("room = %+v", room)
	}
}

func TestPlacesErrors(t *testing.T) {
	at := `"updatedAt":"2026-10-20T03:00:00Z"`
	cases := []struct {
		name, method, path, body string
		l                        fakeLocations
		a                        fakeAssets
		status                   int
		code                     string
	}{
		{"rename without updatedAt", "PATCH", "/buildings/:id", `{"name":"อาคาร 1"}`, fakeLocations{}, fakeAssets{}, 400, "VALIDATION_FAILED"},
		{"rename conflict", "PATCH", "/rooms/:id", `{"name":"x",` + at + `}`, fakeLocations{err: locations.ErrVersionConflict}, fakeAssets{}, 409, "VERSION_CONFLICT"},
		{"rename taken", "PATCH", "/buildings/:id", `{"name":"x",` + at + `}`, fakeLocations{err: locations.ErrNameTaken}, fakeAssets{}, 409, "NAME_TAKEN"},
		{"bad building id", "PATCH", "/buildings/nope", `{"name":"x",` + at + `}`, fakeLocations{}, fakeAssets{}, 404, "BUILDING_NOT_FOUND"},
		{"code taken", "POST", "/assets", `{"code":"ac-1-001","name":"x"}`, fakeLocations{}, fakeAssets{err: assets.ErrCodeTaken}, 409, "ASSET_CODE_TAKEN"},
		{"bad room id", "POST", "/assets", `{"roomId":"x"}`, fakeLocations{}, fakeAssets{}, 400, "roomId"},
		{"prefix taken", "POST", "/asset-types", `{"name":"x","codePrefix":"AC"}`, fakeLocations{}, fakeAssets{err: assets.ErrPrefixTaken}, 409, "CODE_PREFIX_TAKEN"},
		{"suggest needs ids", "GET", "/assets/suggest-code?assetTypeId=x&roomId=y", "", fakeLocations{}, fakeAssets{}, 400, "assetTypeId"},
	}
	for _, tc := range cases {
		w := callBody(placesRouter(users.RoleSuperAdmin, tc.l, tc.a), tc.method, tc.path, tc.body)
		if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.code) {
			t.Errorf("%s: %d %s", tc.name, w.Code, w.Body.String())
		}
	}
}

func TestAssetsCarryOpenTickets(t *testing.T) {
	var last assets.AssetInput
	r := placesRouter(users.RoleAdmin, fakeLocations{}, fakeAssets{last: &last})
	w := call(r, "GET", "/rooms/:id/assets?includeInactive=true")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"openTicketCount":2`) || !strings.Contains(w.Body.String(), `"icon":"air-vent"`) {
		t.Errorf("list: %d %s", w.Code, w.Body.String())
	}
	room := uuid.NewString()
	w = callBody(r, "PATCH", "/assets/:id", `{"roomId":"`+room+`","updatedAt":"2026-10-20T03:00:00Z"}`)
	if w.Code != http.StatusOK || last.RoomID == nil || last.RoomID.String() != room || last.UpdatedAt.IsZero() {
		t.Errorf("patch: %d %+v", w.Code, last)
	}
	if w := call(r, "GET", "/assets/suggest-code?assetTypeId="+uuid.NewString()+"&roomId="+uuid.NewString()); !strings.Contains(w.Body.String(), "AC-1-003") {
		t.Errorf("suggest: %s", w.Body.String())
	}
}
