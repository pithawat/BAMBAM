package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
)

type session struct {
	p   Principal
	err error
}

func (s session) Resolve(*gin.Context) (Principal, error) { return s.p, s.err }

func TestRequirePermission(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name string
		s    session
		want int
	}{
		{"no session", session{err: apperr.ErrUnauthenticated}, http.StatusUnauthorized},
		{"lacks the key", session{p: Principal{UserID: uuid.New(), Permissions: []string{"repair.ticket.work"}}}, http.StatusForbidden},
		{"has one of the keys", session{p: Principal{UserID: uuid.New(), Permissions: []string{"settings.users.manage"}}}, http.StatusOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/x", RequireAuth(c.s), RequirePermission("settings.roles.manage", "settings.users.manage"), func(ctx *gin.Context) { ctx.Status(http.StatusOK) })
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", "/x", nil))
			if w.Code != c.want {
				t.Fatalf("status = %d, want %d", w.Code, c.want)
			}
		})
	}
}
