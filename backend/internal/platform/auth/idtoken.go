package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// idTokenResult is what the callback needs from a validated id_token.
type idTokenResult struct {
	Subject    string
	MissingIss bool
	Claims     jwt.MapClaims
}

// validateIDToken implements docs/shared/integrations/sso.md "id_token validation":
// HS256 signature with the client secret, aud contains the client id, exp required,
// iat checked when present, sub required, and iss — when present — must equal the
// configured issuer (trailing slash normalised). A missing iss is allowed for this
// provider only and reported back so the caller can log a warning.
// Remove the missing-iss exception once RMC SSO issues RS256 tokens via JWKS.
func validateIDToken(raw, clientID string, secret []byte, issuer string, now func() time.Time) (idTokenResult, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithAudience(clientID),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(60*time.Second),
		jwt.WithTimeFunc(now),
	)
	claims := jwt.MapClaims{}
	if _, err := parser.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) { return secret, nil }); err != nil {
		return idTokenResult{}, fmt.Errorf("id_token: %w", err)
	}

	sub, _ := claims["sub"].(string)
	if strings.TrimSpace(sub) == "" {
		return idTokenResult{}, errors.New("id_token: sub missing")
	}

	res := idTokenResult{Subject: sub, Claims: claims}
	issClaim, present := claims["iss"]
	if !present {
		res.MissingIss = true
		return res, nil
	}
	iss, ok := issClaim.(string)
	if !ok || normaliseIssuer(iss) != normaliseIssuer(issuer) {
		return idTokenResult{}, errors.New("id_token: iss mismatch")
	}
	return res, nil
}

func normaliseIssuer(s string) string { return strings.TrimRight(strings.TrimSpace(s), "/") }
