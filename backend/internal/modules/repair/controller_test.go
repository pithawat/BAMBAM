package repair

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

type fixedSession struct{ p middleware.Principal }

func (s fixedSession) Resolve(*gin.Context) (middleware.Principal, error) { return s.p, nil }

func newTestRouter(f *fixture, role string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	authed := r.Group("/api/v1", middleware.RequireAuth(fixedSession{middleware.Principal{UserID: f.reporter.ID, Role: role}}))
	RegisterRoutes(authed.Group("/repair"), NewController(f.svc))
	return r
}

type errorEnvelope struct {
	Error struct {
		Code   string            `json:"code"`
		Fields map[string]string `json:"fields"`
	} `json:"error"`
}

func do(t *testing.T, r http.Handler, method, path string, body []byte, contentType string) (*httptest.ResponseRecorder, errorEnvelope) {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var env errorEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &env)
	return w, env
}

func multipartFile(t *testing.T, field string, data []byte) ([]byte, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile(field, "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write(data)
	_ = mw.Close()
	return buf.Bytes(), mw.FormDataContentType()
}

func TestControllerStatusCodes(t *testing.T) {
	f := newFixture(t)
	r := newTestRouter(f, users.RoleEmployee)

	cases := []struct {
		name   string
		method string
		path   string
		body   string
		status int
		code   string
		field  string
	}{
		{"malformed json", "POST", "/api/v1/repair/tickets", "{", 400, "VALIDATION_FAILED", ""},
		{"bad id", "POST", "/api/v1/repair/tickets", `{"categoryId":"nope"}`, 400, "VALIDATION_FAILED", "categoryId"},
		{"empty form", "POST", "/api/v1/repair/tickets", `{}`, 400, "VALIDATION_FAILED", "photoIds"},
		{"team handled", "POST", "/api/v1/repair/tickets", `{"teamHandled":{"note":"x"}}`, 403, "TEAM_HANDLED_NOT_ALLOWED", ""},
		{"scope all by employee", "GET", "/api/v1/repair/tickets?scope=all", "", 403, "FORBIDDEN", ""},
		{"bad status", "GET", "/api/v1/repair/tickets?status=done", "", 400, "VALIDATION_FAILED", "status"},
		{"bad date", "GET", "/api/v1/repair/tickets?createdFrom=yesterday", "", 400, "VALIDATION_FAILED", "createdFrom"},
		{"bad relation", "GET", "/api/v1/repair/tickets/counts?relation=x", "", 400, "VALIDATION_FAILED", "relation"},
		{"ticket non-uuid", "GET", "/api/v1/repair/tickets/abc", "", 404, "TICKET_NOT_FOUND", ""},
		{"ticket unknown", "GET", "/api/v1/repair/tickets/" + uuid.NewString(), "", 404, "TICKET_NOT_FOUND", ""},
		{"photo unknown", "GET", "/api/v1/repair/photos/" + uuid.NewString(), "", 404, "PHOTO_NOT_FOUND", ""},
		{"photo bad size", "GET", "/api/v1/repair/photos/" + uuid.NewString() + "?size=huge", "", 400, "VALIDATION_FAILED", "size"},
		{"upload without file", "POST", "/api/v1/repair/photos", "", 400, "VALIDATION_FAILED", "file"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ct := ""
			if tc.method == "POST" {
				ct = "application/json"
			}
			w, env := do(t, r, tc.method, tc.path, []byte(tc.body), ct)
			if w.Code != tc.status || env.Error.Code != tc.code {
				t.Fatalf("got %d %s, want %d %s (%s)", w.Code, env.Error.Code, tc.status, tc.code, w.Body.String())
			}
			if tc.field != "" && env.Error.Fields[tc.field] == "" {
				t.Fatalf("field %s missing in %v", tc.field, env.Error.Fields)
			}
		})
	}
}

func TestControllerReportFlow(t *testing.T) {
	f := newFixture(t)
	r := newTestRouter(f, users.RoleEmployee)

	body, ct := multipartFile(t, "file", pngBytes(t, 800, 600))
	w, _ := do(t, r, "POST", "/api/v1/repair/photos", body, ct)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	var up struct {
		Data PhotoDTO `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &up)
	if !strings.HasSuffix(up.Data.ThumbURL, up.Data.ID.String()+"?size=thumb") {
		t.Fatalf("photo dto: %+v", up.Data)
	}
	f.repo.photoAt[up.Data.ID] = f.now

	w, _ = do(t, r, "GET", "/api/v1/repair/photos/"+up.Data.ID.String()+"?size=thumb", nil, "")
	if w.Code != 200 || w.Header().Get("Content-Type") != "image/jpeg" || w.Header().Get("Cache-Control") != "private, max-age=86400" {
		t.Fatalf("thumb: %d %v", w.Code, w.Header())
	}

	req, _ := json.Marshal(map[string]any{
		"categoryId": f.cat, "symptomIds": []uuid.UUID{f.sym1}, "buildingId": f.building, "floorId": f.floor, "roomId": f.room,
		"priority": "high", "photoIds": []uuid.UUID{up.Data.ID}, "teamHandled": nil,
	})
	w, _ = do(t, r, "POST", "/api/v1/repair/tickets", req, "application/json")
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	var created struct {
		Data map[string]any `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	for _, k := range []string{"ticketNo", "viewerRelation", "awaitingMyConfirmation", "photos", "timeline", "allowedActions", "blockedActions", "asset", "result", "room"} {
		if _, ok := created.Data[k]; !ok {
			t.Errorf("response missing %q", k)
		}
	}
	if created.Data["ticketNo"] != "RP-2569-000001" {
		t.Fatalf("ticketNo = %v", created.Data["ticketNo"])
	}

	w, _ = do(t, r, "GET", "/api/v1/repair/tickets?status=in_progress", nil, "")
	var list struct {
		Data []map[string]any `json:"data"`
		Meta map[string]any   `json:"meta"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if w.Code != 200 || len(list.Data) != 1 || list.Meta["pageSize"] != float64(20) {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}

	// #35 (CR-019): the S06 route answers with a page of 10 by default (the fake repo returns no rows).
	w, _ = do(t, r, "GET", "/api/v1/repair/tickets/mine?status=closed", nil, "")
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if w.Code != 200 || list.Meta["pageSize"] != float64(10) {
		t.Fatalf("mine: %d %s", w.Code, w.Body.String())
	}
}

// Stage 3 AC3: the executive is read-only — every write except reporting returns 403.
func TestExecutiveWritesForbidden(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	f.repo.tickets[d.ID].Status = StatusResolved
	gin.SetMode(gin.TestMode)
	r := gin.New()
	exec := middleware.Principal{UserID: uuid.New(), Role: users.RoleExecutive}
	RegisterRoutes(r.Group("/api/v1", middleware.RequireAuth(fixedSession{exec})).Group("/repair"), NewController(f.svc))

	ticket := "/api/v1/repair/tickets/" + d.ID.String()
	cases := []struct{ method, path, body string }{
		{"POST", ticket + "/assess", `{"expectedDoneOn":"2026-10-20","workBy":"in_house"}`},
		{"POST", ticket + "/resolve", `{"note":"ซ่อมแล้ว","photoIds":[]}`},
		{"POST", ticket + "/confirm", `{"rating":5}`},
		{"POST", ticket + "/send-back", `{"reason":"ยังไม่หาย"}`},
		{"POST", ticket + "/close", `{"reason":"ปิด"}`},
		{"POST", "/api/v1/repair/contractor-types", `{"name":"แอร์"}`},
		{"POST", "/api/v1/repair/contractors", `{"name":"ช่าง ก.","typeIds":[]}`},
		{"PUT", "/api/v1/repair/contractors/" + uuid.NewString(), `{"name":"ช่าง ก.","typeIds":[],"isActive":true}`},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			w, env := do(t, r, tc.method, tc.path, []byte(tc.body), "application/json")
			if w.Code != http.StatusForbidden {
				t.Fatalf("got %d %s, want 403 (%s)", w.Code, env.Error.Code, w.Body.String())
			}
		})
	}
}

func TestCloseStatusCodes(t *testing.T) {
	f := newFixture(t)
	d := f.create(t)
	r := newTestRouter(f, users.RoleAdmin)
	path := "/api/v1/repair/tickets/" + d.ID.String() + "/close"

	w, env := do(t, r, "POST", path, []byte(`{"reason":""}`), "application/json")
	if w.Code != 400 || env.Error.Fields["reason"] != "REQUIRED" {
		t.Fatalf("empty reason: %d %v", w.Code, env.Error)
	}
	if w, _ = do(t, r, "POST", path, []byte(`{"reason":"ส่งซ่อมภายนอกแล้ว"}`), "application/json"); w.Code != 200 {
		t.Fatalf("close: %d %s", w.Code, w.Body.String())
	}
	w, env = do(t, r, "POST", path, []byte(`{"reason":"อีกครั้ง"}`), "application/json")
	if w.Code != 409 || env.Error.Code != "TICKET_CLOSED" {
		t.Fatalf("close twice: %d %s", w.Code, env.Error.Code)
	}
}
