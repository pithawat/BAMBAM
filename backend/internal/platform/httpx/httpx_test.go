package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

func TestErrorEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		err    error
		status int
		code   string
	}{
		{apperr.ErrUnauthenticated, http.StatusUnauthorized, "UNAUTHENTICATED"},
		{apperr.ErrForbidden, http.StatusForbidden, "FORBIDDEN"},
		{apperr.Validation(map[string]string{"role": "INVALID"}), http.StatusBadRequest, "VALIDATION_FAILED"},
		{apperr.New(apperr.KindBusinessRule, "TECHNICIAN_BUSY", "x"), http.StatusUnprocessableEntity, "TECHNICIAN_BUSY"},
		{errors.New("db exploded: secret detail"), http.StatusInternalServerError, "INTERNAL"},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
		Error(c, tc.err)
		if w.Code != tc.status {
			t.Errorf("%v: status %d, want %d", tc.err, w.Code, tc.status)
		}
		var body struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		if body.Error.Code != tc.code {
			t.Errorf("%v: code %q, want %q", tc.err, body.Error.Code, tc.code)
		}
		if tc.code == "INTERNAL" && body.Error.Message != "internal error" {
			t.Errorf("internal error text leaked: %q", body.Error.Message)
		}
	}
}

func TestErrorDetails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		err  *apperr.Error
		want string
	}{
		{&apperr.Error{Kind: apperr.KindConflict, Code: "DUPLICATE_FOUND", Message: "x", Details: gin.H{"ticketId": "t1"}}, `{"ticketId":"t1"}`},
		{apperr.ErrForbidden, ""},
	} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
		Error(c, tc.err)
		var body struct {
			Error map[string]json.RawMessage `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		if got := string(body.Error["details"]); got != tc.want {
			t.Errorf("%s: details %q, want %q", tc.err.Code, got, tc.want)
		}
	}
}
