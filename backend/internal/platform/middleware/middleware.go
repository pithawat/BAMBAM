// Package middleware holds the Gin middleware shared by every route:
// request id, slog logging, recovery, CORS and the auth guard.
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
)

const HeaderRequestID = "X-Request-ID"

type requestIDKey struct{}

// RequestIDFromContext is used by the slog handler to tag every log line.
func RequestIDFromContext(ctx context.Context) string {
	s, _ := ctx.Value(requestIDKey{}).(string)
	return s
}

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(HeaderRequestID)
		if id == "" || len(id) > 64 {
			b := make([]byte, 8)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		c.Header(HeaderRequestID, id)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), requestIDKey{}, id))
		c.Next()
	}
}

// Logger logs one line per request. It logs the route pattern, never the query
// string (it can carry the OIDC code/state).
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		slog.InfoContext(c.Request.Context(), "request",
			"method", c.Request.Method,
			"route", route,
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
		)
	}
}

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, rec any) {
		slog.ErrorContext(c.Request.Context(), "panic recovered", "panic", rec)
		httpx.Error(c, errInternal{})
	})
}

type errInternal struct{}

func (errInternal) Error() string { return "panic" }

// CORS allows credentialed requests from the configured origins only. With the
// Next.js rewrite the browser calls the API same-origin, so this matters only
// for direct calls to the API origin.
func CORS(allowed []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && slices.Contains(allowed, origin) {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			h.Add("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// SessionResolver turns the session cookie into a principal (implemented by platform/auth).
type SessionResolver interface {
	Resolve(c *gin.Context) (Principal, error)
}

// RequireAuth is the backend auth gate. Never rely on the frontend gate alone.
func RequireAuth(r SessionResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		p, err := r.Resolve(c)
		if err != nil {
			if _, ok := apperr.As(err); !ok {
				slog.ErrorContext(c.Request.Context(), "resolve session", "err", err)
			}
			httpx.Error(c, apperr.ErrUnauthenticated)
			return
		}
		setPrincipal(c, p)
		c.Next()
	}
}
