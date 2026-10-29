package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pithawat/BAMBAM/backend/internal/platform/apperr"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/platformdb"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

const (
	SessionCookie = "bam_session"
	// seenCookie is a non-secret marker ("this browser had a session") so
	// proxy.ts can tell an expired session from a first visit (S01 ?reason=expired).
	seenCookie = "bam_seen"
	flowCookie = "bam_oidc"
)

// SessionStore keeps app sessions in platform.sessions. The cookie carries a
// random token; the database stores only its SHA-256.
type SessionStore struct {
	q     *platformdb.Queries
	users *users.Service
	ttl   time.Duration
}

func NewSessionStore(dbtx platformdb.DBTX, us *users.Service, ttl time.Duration) *SessionStore {
	return &SessionStore{q: platformdb.New(dbtx), users: us, ttl: ttl}
}

// Create starts a session and returns the cookie token.
func (s *SessionStore) Create(ctx context.Context, userID uuid.UUID, origin *uuid.UUID) (string, time.Time, error) {
	token := randomToken(32)
	expires := time.Now().Add(s.ttl)
	_, err := s.q.CreateSession(ctx, platformdb.CreateSessionParams{
		TokenHash: hashToken(token), UserID: userID, OriginUserID: origin, ExpiresAt: expires,
	})
	return token, expires, err
}

func (s *SessionStore) Delete(ctx context.Context, token string) error {
	return s.q.DeleteSessionByTokenHash(ctx, hashToken(token))
}

// Resolve implements middleware.SessionResolver.
func (s *SessionStore) Resolve(c *gin.Context) (middleware.Principal, error) {
	token, err := c.Cookie(SessionCookie)
	if err != nil || token == "" {
		return middleware.Principal{}, apperr.ErrUnauthenticated
	}
	ctx := c.Request.Context()
	sess, err := s.q.GetActiveSession(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		// expired or unknown: drop the stale cookie so proxy.ts sends the user to S01 ?reason=expired
		clearCookie(c, SessionCookie)
		return middleware.Principal{}, apperr.ErrUnauthenticated
	}
	if err != nil {
		return middleware.Principal{}, err
	}
	u, err := s.users.Get(ctx, sess.UserID)
	if err != nil {
		return middleware.Principal{}, err
	}
	return middleware.Principal{UserID: u.ID, Role: u.Role, IsDemo: u.IsDemo, OriginUserID: sess.OriginUserID}, nil
}

// PurgeExpired deletes expired sessions; main.go runs it periodically.
func (s *SessionStore) PurgeExpired(ctx context.Context) (int64, error) {
	return s.q.DeleteExpiredSessions(ctx)
}

func setSessionCookie(c *gin.Context, token string, expires time.Time) {
	maxAge := int(time.Until(expires).Seconds())
	http.SetCookie(c.Writer, &http.Cookie{
		Name: SessionCookie, Value: token, Path: "/", MaxAge: maxAge,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name: seenCookie, Value: "1", Path: "/", MaxAge: 30 * 24 * 3600,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}

func clearCookie(c *gin.Context, name string) { clearCookiePath(c, name, "/") }

func clearCookiePath(c *gin.Context, name, path string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: name, Value: "", Path: path, MaxAge: -1,
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}
