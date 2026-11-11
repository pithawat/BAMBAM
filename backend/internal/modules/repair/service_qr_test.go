package repair

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// ---- Stage 5 QR fakes ----

func (f *fakeRepo) LookupAsset(_ context.Context, code string) (AssetLookup, error) {
	f.dash.lookedUp++
	a, ok := f.dash.lookups[strings.ToLower(code)]
	if !ok {
		return AssetLookup{}, ErrAssetNotFound
	}
	return a, nil
}

func (f *fakeRepo) AssetTypeCategories(_ context.Context, typeID, buildingID uuid.UUID) ([]AssetCategory, error) {
	return f.dash.typeCats[[2]uuid.UUID{typeID, buildingID}], nil
}

func (f *fakeRepo) ActiveAssetIDByCode(_ context.Context, code string) (uuid.UUID, bool, error) {
	for id, a := range f.dash.assets {
		if a.IsActive && strings.EqualFold(a.Code, code) {
			return id, true, nil
		}
	}
	return uuid.Nil, false, nil
}

// qrAsset registers AC-05-012 in a room of building b with the given type categories.
func qrAsset(f *fakeRepo, b uuid.UUID, cats ...AssetCategory) AssetLookup {
	a := AssetLookup{Code: "AC-05-012", Name: "เครื่องปรับอากาศ ห้องประชุม 5B", TypeID: uuid.New(),
		Building: Ref{ID: b, Name: "อาคาร 1"}, Floor: Ref{ID: uuid.New(), Name: "5"}, Room: Ref{ID: uuid.New(), Name: "ห้องประชุม 5B"}}
	f.dash.lookups[strings.ToLower(a.Code)] = a
	f.dash.typeCats[[2]uuid.UUID{a.TypeID, b}] = cats
	return a
}

func cat(name string, used, other bool) AssetCategory {
	return AssetCategory{Ref: Ref{ID: uuid.New(), Name: name}, UsedInBuilding: used, IsOther: other}
}

// ---- #25 lookup (F13-B) ----

func TestLookupAssetPrefillsPlaceAndCategory(t *testing.T) {
	f := newFixture(t)
	aircon := cat("ระบบปรับอากาศ", true, false)
	want := qrAsset(f.repo, f.building, aircon)

	// BR-F13B-3: the code alone finds the asset; typed codes are trimmed and matched ignoring case
	got, err := f.svc.LookupAsset(context.Background(), f.reporter, "  ac-05-012 ")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if got.Code != want.Code || got.Room != want.Room || got.Floor != want.Floor || got.Building != want.Building {
		t.Fatalf("place = %+v, want %+v", got, want)
	}
	if got.Category == nil || *got.Category != aircon.Ref {
		t.Fatalf("category = %v, want %v", got.Category, aircon.Ref)
	}
}

// CR-025 (BR-F02-8): never prefill a category the building's type does not use.
func TestLookupAssetCategoryFollowsBuildingType(t *testing.T) {
	notUsed, used, other := cat("ห้องประชุมและโสตฯ", false, false), cat("ไฟฟ้าและแสงสว่าง", true, false), cat("อื่น ๆ", false, true)
	cases := []struct {
		name string
		cats []AssetCategory
		want *Ref
	}{
		{"first used category", []AssetCategory{notUsed, used}, &used.Ref},
		{"none used → dropped", []AssetCategory{notUsed}, nil},
		{"\"อื่น ๆ\" is used everywhere", []AssetCategory{notUsed, other}, &other.Ref},
		{"type without categories", nil, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			qrAsset(f.repo, f.building, tc.cats...)
			got, err := f.svc.LookupAsset(context.Background(), f.reporter, "AC-05-012")
			if err != nil {
				t.Fatalf("lookup: %v", err)
			}
			if (got.Category == nil) != (tc.want == nil) || (got.Category != nil && *got.Category != *tc.want) {
				t.Fatalf("category = %v, want %v", got.Category, tc.want)
			}
		})
	}
}

func TestLookupAssetNotFound(t *testing.T) {
	f := newFixture(t)
	qrAsset(f.repo, f.building, cat("ระบบปรับอากาศ", true, false))
	for _, c := range []string{"XX-99", "", "   ", "AC 05/012", "../etc", strings.Repeat("A", MaxAssetCodeChars+1)} {
		if _, err := f.svc.LookupAsset(context.Background(), f.reporter, c); !errors.Is(err, ErrAssetNotFound) {
			t.Fatalf("%q: err = %v, want ASSET_NOT_FOUND", c, err)
		}
	}
	// a code that can never exist (BR-F31-1) does not reach the database
	if f.repo.dash.lookedUp != 1 {
		t.Fatalf("repository lookups = %d, want 1 (only XX-99)", f.repo.dash.lookedUp)
	}
}

// settings CR-006: F13-B needs `repair.ticket.report` (or a lead's team_handle).
func TestLookupAssetPermission(t *testing.T) {
	f := newFixture(t)
	qrAsset(f.repo, f.building, cat("ระบบปรับอากาศ", true, false))
	if _, err := f.svc.LookupAsset(context.Background(), viewerAs(users.RoleTechnician, uuid.New()), "AC-05-012"); !errors.Is(err, apperr.ErrForbidden) {
		t.Fatalf("technician: err = %v, want forbidden", err)
	}
	lead := Viewer{ID: uuid.New(), Permissions: []string{PermTeamHandle}}
	if _, err := f.svc.LookupAsset(context.Background(), lead, "AC-05-012"); err != nil {
		t.Fatalf("lead without report: %v", err)
	}
}

// ---- #5 links the asset (Stage 5, AC4) ----

func TestCreateTicketLinksAsset(t *testing.T) {
	f := newFixture(t)
	active, inactive := uuid.New(), uuid.New()
	f.repo.dash.assets[active] = &fakeAsset{LockedAsset{ID: active, Code: "AC-05-012", IsActive: true}}
	f.repo.dash.assets[inactive] = &fakeAsset{LockedAsset{ID: inactive, Code: "AC-05-099", IsActive: false}}

	cases := []struct {
		name, code string
		want       *uuid.UUID
	}{
		{"active asset, other case", "ac-05-012", &active},
		{"unknown code kept unlinked", "XX-99", nil},
		{"inactive asset not linked", "AC-05-099", nil},
		{"no code", "", nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := f.input(f.upload(t, f.reporter))
			in.AssetCode = tc.code
			if _, err := f.svc.CreateTicket(context.Background(), f.reporter, in); err != nil {
				t.Fatalf("create: %v", err)
			}
			got := f.repo.inserted[len(f.repo.inserted)-1]
			if (got.AssetID == nil) != (tc.want == nil) || (got.AssetID != nil && *got.AssetID != *tc.want) {
				t.Fatalf("asset id = %v, want %v", got.AssetID, tc.want)
			}
			// the typed code is stored as sent (trimmed), linked or not
			if tc.code != "" && (got.AssetCode == nil || *got.AssetCode != tc.code) {
				t.Fatalf("asset code = %v, want %q", got.AssetCode, tc.code)
			}
		})
	}
}

// #25 over HTTP: the JSON shape of 04-api-contract.md, 404 / 403, and suggest-code still routes.
func TestControllerAssetLookup(t *testing.T) {
	f := newFixture(t)
	aircon := cat("ระบบปรับอากาศ", true, false)
	qrAsset(f.repo, f.building, aircon)
	r := newTestRouter(f, users.RoleEmployee)

	w, _ := do(t, r, "GET", "/api/v1/repair/assets/ac-05-012", nil, "")
	if w.Code != 200 {
		t.Fatalf("found: %d %s", w.Code, w.Body.String())
	}
	var body struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"code", "name", "category", "building", "floor", "room", "locationDetail"} {
		if _, ok := body.Data[k]; !ok {
			t.Errorf("field %s missing in %s", k, w.Body.String())
		}
	}
	if string(body.Data["locationDetail"]) != "null" || !strings.Contains(string(body.Data["category"]), aircon.ID.String()) {
		t.Errorf("body = %s", w.Body.String())
	}

	if w, env := do(t, r, "GET", "/api/v1/repair/assets/XX-99", nil, ""); w.Code != 404 || env.Error.Code != "ASSET_NOT_FOUND" {
		t.Fatalf("not found: %d %s", w.Code, env.Error.Code)
	}
	// suggest-code (#34) is a static route next to /assets/{code}: admin only, so 403 here
	if w, env := do(t, r, "GET", "/api/v1/repair/assets/suggest-code?assetTypeId="+uuid.NewString()+"&floorId="+uuid.NewString(), nil, ""); w.Code != 403 {
		t.Fatalf("suggest-code: %d %s", w.Code, env.Error.Code)
	}
	tech := newTestRouter(f, users.RoleTechnician)
	if w, env := do(t, tech, "GET", "/api/v1/repair/assets/AC-05-012", nil, ""); w.Code != 403 || env.Error.Code != "FORBIDDEN" {
		t.Fatalf("technician: %d %s", w.Code, env.Error.Code)
	}
}
