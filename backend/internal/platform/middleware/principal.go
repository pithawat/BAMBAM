package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Principal is the logged-in user as seen by every module. Modules read it with
// CurrentUser and never look at cookies or tokens themselves.
type Principal struct {
	UserID uuid.UUID
	Role   string
	IsDemo bool
	// OriginUserID is the real SSO user behind a role-switcher session (nil otherwise).
	OriginUserID *uuid.UUID
}

type principalKey struct{}

const ginPrincipalKey = "platform.principal"

func setPrincipal(c *gin.Context, p Principal) {
	c.Set(ginPrincipalKey, p)
	c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), principalKey{}, p))
}

// CurrentUser returns the principal set by the auth guard. ok=false means no session.
func CurrentUser(c *gin.Context) (Principal, bool) {
	v, ok := c.Get(ginPrincipalKey)
	if !ok {
		return Principal{}, false
	}
	p, ok := v.(Principal)
	return p, ok
}

// PrincipalFromContext is the same for code that only has a context.Context.
func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok
}
