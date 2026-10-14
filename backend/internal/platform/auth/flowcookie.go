package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// flowState is kept between /api/auth/login and the callback in a short-lived,
// HMAC-signed, httpOnly cookie: state, PKCE verifier and the page to return to.
type flowState struct {
	State    string `json:"s"`
	Verifier string `json:"v"`
	Next     string `json:"n"`
	Expires  int64  `json:"e"`
}

var errBadFlowCookie = errors.New("invalid or expired login flow cookie")

func signFlow(secret []byte, f flowState) (string, error) {
	payload, err := json.Marshal(f)
	if err != nil {
		return "", err
	}
	p := base64.RawURLEncoding.EncodeToString(payload)
	return p + "." + base64.RawURLEncoding.EncodeToString(mac(secret, p)), nil
}

func verifyFlow(secret []byte, value string, now time.Time) (flowState, error) {
	p, sig, ok := strings.Cut(value, ".")
	if !ok {
		return flowState{}, errBadFlowCookie
	}
	got, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil || !hmac.Equal(got, mac(secret, p)) {
		return flowState{}, errBadFlowCookie
	}
	raw, err := base64.RawURLEncoding.DecodeString(p)
	if err != nil {
		return flowState{}, errBadFlowCookie
	}
	var f flowState
	if err := json.Unmarshal(raw, &f); err != nil || now.Unix() > f.Expires {
		return flowState{}, errBadFlowCookie
	}
	return f, nil
}

func mac(secret []byte, msg string) []byte {
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(msg))
	return h.Sum(nil)
}

// SafeNext keeps only same-origin relative paths ("/repair/my?x=1"); anything else becomes "/".
func SafeNext(next string) string {
	if next == "" || !strings.HasPrefix(next, "/") || strings.HasPrefix(next, "//") ||
		strings.HasPrefix(next, "/\\") || strings.ContainsAny(next, "\r\n\\") {
		return "/"
	}
	if strings.HasPrefix(next, "/api/") || strings.HasPrefix(next, "/login") || strings.HasPrefix(next, "/signed-out") {
		return "/"
	}
	return next
}
