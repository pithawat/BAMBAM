package config

import (
	"strings"
	"testing"
)

func env(over map[string]string) func(string) (string, bool) {
	base := map[string]string{
		"APP_ENV":                      "development",
		"DATABASE_URL":                 "postgres://x",
		"SSO_ISSUER":                   "https://rmc-sso.cipcloud.net",
		"SSO_AUTHORIZE_URL":            "a",
		"SSO_TOKEN_URL":                "t",
		"SSO_USERINFO_URL":             "u",
		"SSO_END_SESSION_URL":          "e",
		"SSO_CLIENT_ID":                "bam",
		"SSO_CLIENT_SECRET":            "client-secret",
		"SSO_REDIRECT_URI":             "http://localhost:3000/api/auth/callback/rmc-sso",
		"SSO_POST_LOGOUT_REDIRECT_URI": "http://localhost:3000/signed-out",
		"APP_SESSION_SECRET":           strings.Repeat("s", 40),
		"ROLE_SWITCHER_ENABLED":        "true",
		"PHOTO_STORAGE_DIR":            "/var/lib/bambam/photos",
	}
	for k, v := range over {
		base[k] = v
	}
	return func(k string) (string, bool) { v, ok := base[k]; return v, ok }
}

func TestRoleSwitcherNeverInProduction(t *testing.T) {
	c, err := FromLookup(env(map[string]string{"APP_ENV": "production"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.RoleSwitcherEnabled {
		t.Fatal("role switcher enabled in production (D-005)")
	}
	if c.EnvironmentLabel() != "" {
		t.Fatalf("production label = %q, want empty", c.EnvironmentLabel())
	}
	dev, _ := FromLookup(env(nil))
	if !dev.RoleSwitcherEnabled || dev.EnvironmentLabel() != "DEV" {
		t.Fatalf("dev: switcher=%v label=%q", dev.RoleSwitcherEnabled, dev.EnvironmentLabel())
	}
}

func TestValidation(t *testing.T) {
	if _, err := FromLookup(env(map[string]string{"SSO_CLIENT_SECRET": ""})); err == nil || !strings.Contains(err.Error(), "SSO_CLIENT_SECRET") {
		t.Fatalf("missing secret not reported: %v", err)
	}
	if _, err := FromLookup(env(map[string]string{"APP_SESSION_SECRET": "short"})); err == nil {
		t.Fatal("short session secret accepted")
	}
	same := strings.Repeat("x", 40)
	if _, err := FromLookup(env(map[string]string{"APP_SESSION_SECRET": same, "SSO_CLIENT_SECRET": same})); err == nil {
		t.Fatal("session secret equal to client secret accepted")
	}
	if _, err := FromLookup(env(map[string]string{"APP_ENV": "staging"})); err == nil {
		t.Fatal("unknown APP_ENV accepted")
	}
}

func TestPhotoStorageDir(t *testing.T) {
	dev, err := FromLookup(env(map[string]string{"PHOTO_STORAGE_DIR": ""}))
	if err != nil || dev.PhotoStorageDir != "data/photos" {
		t.Fatalf("dev default: dir=%q err=%v", dev.PhotoStorageDir, err)
	}
	if _, err := FromLookup(env(map[string]string{"APP_ENV": "production", "PHOTO_STORAGE_DIR": ""})); err == nil || !strings.Contains(err.Error(), "PHOTO_STORAGE_DIR") {
		t.Fatalf("missing PHOTO_STORAGE_DIR in production not reported: %v", err)
	}
}
