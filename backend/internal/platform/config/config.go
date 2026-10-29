// Package config loads and validates all settings from environment variables.
// A .env file is read only when APP_ENV=development; other environments get
// their values from the deploy platform.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	EnvDevelopment = "development"
	EnvUAT         = "uat"
	EnvProduction  = "production"
)

type Config struct {
	AppEnv             string
	GinMode            string
	HTTPPort           string
	DatabaseURL        string
	CORSAllowedOrigins []string

	SessionSecret []byte
	SessionTTL    time.Duration

	// PhotoStorageDir is the persistent directory for repair photos (D-022).
	// Required outside development; development defaults to ./data/photos.
	PhotoStorageDir string

	// RoleSwitcherEnabled is true only when ROLE_SWITCHER_ENABLED=true and APP_ENV is not production (D-005).
	RoleSwitcherEnabled bool

	SSO SSO
}

type SSO struct {
	Issuer                string
	AuthorizeURL          string
	TokenURL              string
	UserInfoURL           string
	EndSessionURL         string
	ClientID              string
	ClientSecret          string
	RedirectURI           string
	PostLogoutRedirectURI string
	Scope                 string

	// ClockSkew is the leeway for id_token iat/exp checks. Raise it only while the
	// SSO server clock is known to be off (D-037).
	ClockSkew time.Duration
}

// EnvironmentLabel is the tag shown in the UI (GET /api/v1/me "environment"): DEV, UAT, or "" in production.
func (c Config) EnvironmentLabel() string {
	switch c.AppEnv {
	case EnvDevelopment:
		return "DEV"
	case EnvUAT:
		return "UAT"
	default:
		return ""
	}
}

// Load reads the environment. If APP_ENV=development it first loads .env (existing env vars win).
func Load() (Config, error) {
	if os.Getenv("APP_ENV") == EnvDevelopment {
		_ = godotenv.Load()
	}
	return FromLookup(os.LookupEnv)
}

// FromLookup builds the config from any lookup function (used by tests).
func FromLookup(lookup func(string) (string, bool)) (Config, error) {
	var missing []string
	get := func(key, def string) string {
		if v, ok := lookup(key); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
		return def
	}
	req := func(key string) string {
		v := get(key, "")
		if v == "" {
			missing = append(missing, key)
		}
		return v
	}

	c := Config{
		AppEnv:      req("APP_ENV"),
		GinMode:     get("GIN_MODE", "release"),
		HTTPPort:    get("HTTP_PORT", "8080"),
		DatabaseURL: req("DATABASE_URL"),
		SSO: SSO{
			Issuer:                req("SSO_ISSUER"),
			AuthorizeURL:          req("SSO_AUTHORIZE_URL"),
			TokenURL:              req("SSO_TOKEN_URL"),
			UserInfoURL:           req("SSO_USERINFO_URL"),
			EndSessionURL:         req("SSO_END_SESSION_URL"),
			ClientID:              req("SSO_CLIENT_ID"),
			ClientSecret:          req("SSO_CLIENT_SECRET"),
			RedirectURI:           req("SSO_REDIRECT_URI"),
			PostLogoutRedirectURI: req("SSO_POST_LOGOUT_REDIRECT_URI"),
			Scope:                 get("SSO_SCOPE", "openid profile email offline_access"),
		},
	}
	for _, o := range strings.Split(get("CORS_ALLOWED_ORIGINS", ""), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSAllowedOrigins = append(c.CORSAllowedOrigins, o)
		}
	}
	if c.AppEnv == EnvDevelopment {
		c.PhotoStorageDir = get("PHOTO_STORAGE_DIR", "data/photos")
	} else {
		c.PhotoStorageDir = req("PHOTO_STORAGE_DIR")
	}
	secret := req("APP_SESSION_SECRET")
	c.SessionSecret = []byte(secret)

	var errs []error
	if len(missing) > 0 {
		errs = append(errs, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", ")))
	}
	switch c.AppEnv {
	case "", EnvDevelopment, EnvUAT, EnvProduction:
	default:
		errs = append(errs, fmt.Errorf("APP_ENV must be development, uat or production, got %q", c.AppEnv))
	}
	if secret != "" && len(secret) < 32 {
		errs = append(errs, errors.New("APP_SESSION_SECRET must be at least 32 characters"))
	}
	if secret != "" && secret == c.SSO.ClientSecret {
		errs = append(errs, errors.New("APP_SESSION_SECRET must differ from SSO_CLIENT_SECRET"))
	}

	skew, err := time.ParseDuration(get("SSO_CLOCK_SKEW", "60s"))
	if err != nil || skew < 0 || skew > 10*time.Minute {
		errs = append(errs, errors.New("SSO_CLOCK_SKEW must be a Go duration between 0 and 10m, e.g. 5m"))
	}
	c.SSO.ClockSkew = skew

	ttl, err := time.ParseDuration(get("APP_SESSION_TTL", "12h"))
	if err != nil || ttl <= 0 {
		errs = append(errs, errors.New("APP_SESSION_TTL must be a positive Go duration, e.g. 12h"))
	}
	c.SessionTTL = ttl

	switcher, _ := strconv.ParseBool(get("ROLE_SWITCHER_ENABLED", "false"))
	c.RoleSwitcherEnabled = switcher && c.AppEnv != EnvProduction

	return c, errors.Join(errs...)
}
