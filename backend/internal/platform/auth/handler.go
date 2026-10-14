// Package auth implements RMC SSO login (OIDC Authorization Code + PKCE), the
// app session and the dev/UAT role switch. Single source for behaviour:
// docs/shared/integrations/sso.md.
package auth

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/config"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

const flowTTL = 10 * time.Minute

// MeBuilder builds the P1 payload (users.Controller implements it).
type MeBuilder interface {
	MeFor(ctx context.Context, u users.User) (users.MeResponse, error)
}

// ReadyCheck reports whether a core dependency is up (e.g. db ping).
type ReadyCheck func(ctx context.Context) error

type Handler struct {
	cfg      config.Config
	oidc     *oidcClient
	sessions *SessionStore
	users    *users.Service
	me       MeBuilder
	ready    ReadyCheck
	now      func() time.Time
}

func NewHandler(cfg config.Config, sessions *SessionStore, us *users.Service, me MeBuilder, ready ReadyCheck) *Handler {
	return &Handler{cfg: cfg, oidc: newOIDCClient(cfg.SSO), sessions: sessions, users: us, me: me, ready: ready, now: time.Now}
}

// Login handles GET /api/auth/login?next=… : creates state + PKCE verifier and
// redirects to the RMC SSO authorize endpoint. Started only by the user (S01).
func (h *Handler) Login(c *gin.Context) {
	f := flowState{
		State:    randomToken(32),
		Verifier: randomToken(48),
		Next:     SafeNext(c.Query("next")),
		Expires:  h.now().Add(flowTTL).Unix(),
	}
	v, err := signFlow(h.cfg.SessionSecret, f)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name: flowCookie, Value: v, Path: "/api/auth", MaxAge: int(flowTTL.Seconds()),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	c.Redirect(http.StatusFound, h.oidc.authorizeURL(f.State, pkceChallenge(f.Verifier)))
}

// Callback handles GET /api/auth/callback/rmc-sso?code&state (registered redirect URI).
func (h *Handler) Callback(c *gin.Context) {
	ctx := c.Request.Context()
	fail := func(reason string, err error) {
		// never log tokens, codes or claim payloads
		attrs := []any{"reason", reason}
		if err != nil {
			attrs = append(attrs, "err", err.Error())
		}
		slog.WarnContext(ctx, "sso login failed", attrs...)
		clearCookiePath(c, flowCookie, "/api/auth")
		c.Redirect(http.StatusFound, "/login?error="+reason)
	}

	if c.Query("error") != "" {
		fail("sso_denied", nil)
		return
	}
	raw, err := c.Cookie(flowCookie)
	if err != nil {
		fail("state_missing", nil)
		return
	}
	f, err := verifyFlow(h.cfg.SessionSecret, raw, h.now())
	if err != nil {
		fail("state_invalid", nil)
		return
	}
	if subtle.ConstantTimeCompare([]byte(f.State), []byte(c.Query("state"))) != 1 {
		fail("state_mismatch", nil)
		return
	}
	code := c.Query("code")
	if code == "" {
		fail("code_missing", nil)
		return
	}

	tok, err := h.oidc.exchange(ctx, code, f.Verifier)
	if err != nil {
		fail("token_exchange", err)
		return
	}
	idt, err := validateIDToken(tok.IDToken, h.cfg.SSO.ClientID, []byte(h.cfg.SSO.ClientSecret), h.cfg.SSO.Issuer, h.now)
	if err != nil {
		fail("id_token_invalid", err)
		return
	}
	if idt.MissingIss {
		slog.WarnContext(ctx, "sso id_token without iss accepted (provider compatibility, see sso.md)")
	}
	info, err := h.oidc.userInfo(ctx, tok.AccessToken)
	if err != nil {
		fail("userinfo", err)
		return
	}
	if sub, _ := info["sub"].(string); sub != idt.Subject {
		fail("sub_mismatch", nil)
		return
	}

	u, err := h.users.UpsertFromSSO(ctx, mapClaims(idt.Subject, info, idt.Claims))
	if err != nil {
		fail("user_upsert", err)
		return
	}
	token, expires, err := h.sessions.Create(ctx, u.ID, nil)
	if err != nil {
		fail("session_create", err)
		return
	}
	clearCookiePath(c, flowCookie, "/api/auth")
	setSessionCookie(c, token, expires)
	c.Redirect(http.StatusFound, f.Next)
}

// Logout handles POST /api/auth/logout: clear the app session first, then
// RMC SSO End Session, which returns to the public /signed-out page.
func (h *Handler) Logout(c *gin.Context) {
	if token, err := c.Cookie(SessionCookie); err == nil && token != "" {
		if err := h.sessions.Delete(c.Request.Context(), token); err != nil {
			slog.ErrorContext(c.Request.Context(), "delete session", "err", err)
		}
	}
	clearCookie(c, SessionCookie)
	clearCookie(c, seenCookie)
	c.Redirect(http.StatusSeeOther, h.oidc.endSessionURL(randomToken(16)))
}

type roleSwitchRequest struct {
	Role string `json:"role"`
}

// RoleSwitch handles POST /api/v1/dev/role-switch (dev/UAT only, D-005): the
// session is replaced by one for the role's demo user. A real user's role is never changed.
func (h *Handler) RoleSwitch(c *gin.Context) {
	ctx := c.Request.Context()
	p, ok := middleware.CurrentUser(c)
	if !ok {
		httpx.Error(c, apperr.ErrUnauthenticated)
		return
	}
	if !strings.HasPrefix(c.ContentType(), "application/json") {
		httpx.Error(c, apperr.Validation(map[string]string{"role": "INVALID"}))
		return
	}
	var req roleSwitchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, apperr.Validation(map[string]string{"role": "INVALID"}))
		return
	}
	demo, err := h.users.DemoUserForRole(ctx, req.Role)
	if err != nil {
		httpx.Error(c, err)
		return
	}

	origin := p.OriginUserID
	if origin == nil {
		id := p.UserID
		origin = &id
	}
	token, expires, err := h.sessions.Create(ctx, demo.ID, origin)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	if old, err := c.Cookie(SessionCookie); err == nil {
		_ = h.sessions.Delete(ctx, old)
	}
	if err := h.users.Audit(ctx, origin, "dev.role_switch", "user", demo.ID.String(),
		map[string]string{"role": demo.Role, "fromUserId": p.UserID.String()}); err != nil {
		slog.ErrorContext(ctx, "audit role switch", "err", err)
	}
	setSessionCookie(c, token, expires)

	me, err := h.me.MeFor(ctx, demo)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, me)
}

// Ready handles GET /health/ready for RMC SSO (sso.md "Maintenance guard"):
// requires Authorization: Bearer <SSO_CLIENT_SECRET>.
func (h *Handler) Ready(c *gin.Context) {
	want := "Bearer " + h.cfg.SSO.ClientSecret
	if subtle.ConstantTimeCompare([]byte(c.GetHeader("Authorization")), []byte(want)) != 1 {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"ready": false})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	if err := h.ready(ctx); err != nil {
		slog.ErrorContext(ctx, "readiness check failed", "err", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"ready": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ready": true})
}
