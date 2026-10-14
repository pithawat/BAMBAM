package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	testClient = "bam"
	testIssuer = "https://rmc-sso.cipcloud.net"
)

var testSecret = []byte("test-client-secret-test-client-secret")

func sign(t *testing.T, method jwt.SigningMethod, key any, claims jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func baseClaims(now time.Time) jwt.MapClaims {
	return jwt.MapClaims{
		"sub": "user-1",
		"aud": testClient,
		"exp": now.Add(5 * time.Minute).Unix(),
		"iat": now.Unix(),
	}
}

func TestValidateIDToken(t *testing.T) {
	now := time.Now()
	clock := func() time.Time { return now }

	tests := []struct {
		name        string
		mutate      func(jwt.MapClaims)
		key         []byte
		wantErr     bool
		wantMissing bool
	}{
		{name: "missing iss is accepted and flagged", mutate: func(jwt.MapClaims) {}, wantMissing: true},
		{name: "matching iss", mutate: func(c jwt.MapClaims) { c["iss"] = testIssuer }},
		{name: "iss with trailing slash is normalised", mutate: func(c jwt.MapClaims) { c["iss"] = testIssuer + "/" }},
		{name: "mismatching iss is rejected", mutate: func(c jwt.MapClaims) { c["iss"] = "https://evil.example" }, wantErr: true},
		{name: "aud array containing client", mutate: func(c jwt.MapClaims) { c["aud"] = []string{"other", testClient} }, wantMissing: true},
		{name: "wrong aud", mutate: func(c jwt.MapClaims) { c["aud"] = "other" }, wantErr: true},
		{name: "expired", mutate: func(c jwt.MapClaims) { c["exp"] = now.Add(-10 * time.Minute).Unix() }, wantErr: true},
		{name: "exp missing", mutate: func(c jwt.MapClaims) { delete(c, "exp") }, wantErr: true},
		{name: "iat in the future", mutate: func(c jwt.MapClaims) { c["iat"] = now.Add(10 * time.Minute).Unix() }, wantErr: true},
		{name: "sub missing", mutate: func(c jwt.MapClaims) { delete(c, "sub") }, wantErr: true},
		{name: "bad signature", mutate: func(jwt.MapClaims) {}, key: []byte("another-secret-another-secret-xx"), wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := baseClaims(now)
			tt.mutate(c)
			key := testSecret
			if tt.key != nil {
				key = tt.key
			}
			res, err := validateIDToken(sign(t, jwt.SigningMethodHS256, key, c), testClient, testSecret, testIssuer, clock)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && res.MissingIss != tt.wantMissing {
				t.Fatalf("MissingIss = %v, want %v", res.MissingIss, tt.wantMissing)
			}
		})
	}
}

func TestValidateIDTokenRejectsOtherAlgorithms(t *testing.T) {
	now := time.Now()
	raw := sign(t, jwt.SigningMethodHS512, testSecret, baseClaims(now))
	if _, err := validateIDToken(raw, testClient, testSecret, testIssuer, func() time.Time { return now }); err == nil {
		t.Fatal("HS512 token accepted, want only HS256")
	}
	none := sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, baseClaims(now))
	if _, err := validateIDToken(none, testClient, testSecret, testIssuer, func() time.Time { return now }); err == nil {
		t.Fatal("alg=none token accepted")
	}
}

func TestFlowCookie(t *testing.T) {
	secret := []byte("session-secret-session-secret-123")
	now := time.Now()
	f := flowState{State: "s", Verifier: "v", Next: "/repair/my", Expires: now.Add(time.Minute).Unix()}
	v, err := signFlow(secret, f)
	if err != nil {
		t.Fatal(err)
	}
	got, err := verifyFlow(secret, v, now)
	if err != nil || got != f {
		t.Fatalf("round trip = %+v, %v", got, err)
	}
	if _, err := verifyFlow([]byte("other-secret-other-secret-other-1"), v, now); err == nil {
		t.Fatal("cookie signed with another secret accepted")
	}
	if _, err := verifyFlow(secret, v+"x", now); err == nil {
		t.Fatal("tampered cookie accepted")
	}
	if _, err := verifyFlow(secret, v, now.Add(2*time.Minute)); err == nil {
		t.Fatal("expired cookie accepted")
	}
}

func TestSafeNext(t *testing.T) {
	cases := map[string]string{
		"":                     "/",
		"/repair/my?tab=all":   "/repair/my?tab=all",
		"//evil.example":       "/",
		"/\\evil.example":      "/",
		"https://evil.example": "/",
		"repair":               "/",
		"/api/auth/login":      "/",
		"/login?next=/x":       "/",
		"/ok\r\nSet-Cookie:":   "/",
	}
	for in, want := range cases {
		if got := SafeNext(in); got != want {
			t.Errorf("SafeNext(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPKCEChallenge(t *testing.T) {
	// RFC 7636 appendix B test vector
	if got := pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"); got != "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" {
		t.Fatalf("challenge = %s", got)
	}
}

func TestMapClaimsSkipsUnusedClaims(t *testing.T) {
	info := map[string]any{"sub": "s", "USER": "600123", "FIRSTNAME_TH": "วรรณา", "LINE_USER_ID": "U123", "EMAIL": " a@b.c "}
	c := mapClaims("s", info, map[string]any{"DEPARTMENT": "ฝ่ายบัญชี", "USER": "ignored"})
	if c.EmployeeCode != "600123" || c.FirstNameTH != "วรรณา" || c.Department != "ฝ่ายบัญชี" || c.Email != "a@b.c" {
		t.Fatalf("unexpected claims %+v", c)
	}
	numeric := mapClaims("s", map[string]any{"USER": float64(600123)}, nil)
	if numeric.EmployeeCode != "600123" {
		t.Fatalf("numeric USER = %q", numeric.EmployeeCode)
	}
}
