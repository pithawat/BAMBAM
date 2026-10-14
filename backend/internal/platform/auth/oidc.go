package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pithawat/BAMBAM/backend/internal/platform/config"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

// oidcClient talks to RMC SSO server-side only. Tokens never reach the browser
// and are never logged.
type oidcClient struct {
	cfg  config.SSO
	http *http.Client
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	TokenType   string `json:"token_type"`
}

func newOIDCClient(cfg config.SSO) *oidcClient {
	return &oidcClient{cfg: cfg, http: &http.Client{Timeout: 15 * time.Second}}
}

func (o *oidcClient) authorizeURL(state, challenge string) string {
	q := url.Values{
		"response_type":         {"code"},
		"client_id":             {o.cfg.ClientID},
		"redirect_uri":          {o.cfg.RedirectURI},
		"scope":                 {o.cfg.Scope},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
	return o.cfg.AuthorizeURL + "?" + q.Encode()
}

func (o *oidcClient) endSessionURL(state string) string {
	q := url.Values{
		"client_id":                {o.cfg.ClientID},
		"post_logout_redirect_uri": {o.cfg.PostLogoutRedirectURI},
		"state":                    {state},
	}
	return o.cfg.EndSessionURL + "?" + q.Encode()
}

// exchange swaps the code at the token endpoint (client_secret_post + PKCE verifier).
func (o *oidcClient) exchange(ctx context.Context, code, verifier string) (tokenResponse, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {o.cfg.RedirectURI},
		"client_id":     {o.cfg.ClientID},
		"client_secret": {o.cfg.ClientSecret},
		"code_verifier": {verifier},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.cfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return tokenResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := o.http.Do(req)
	if err != nil {
		return tokenResponse{}, fmt.Errorf("token request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		// Only the standard OAuth error fields are kept; the rest of the body is never logged.
		var e struct {
			Error       string `json:"error"`
			Description string `json:"error_description"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&e)
		return tokenResponse{}, fmt.Errorf("token endpoint status %d: error=%q description=%q",
			resp.StatusCode, truncate(e.Error, 100), truncate(e.Description, 200))
	}
	var t tokenResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&t); err != nil {
		return tokenResponse{}, fmt.Errorf("decode token response: %w", err)
	}
	if t.AccessToken == "" || t.IDToken == "" {
		return tokenResponse{}, fmt.Errorf("token response missing access_token or id_token")
	}
	return t, nil
}

func (o *oidcClient) userInfo(ctx context.Context, accessToken string) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.cfg.UserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := o.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("userinfo status %d", resp.StatusCode)
	}
	var claims map[string]any
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&claims); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}
	return claims, nil
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// mapClaims picks the claims BAMBAM stores, preferring UserInfo and falling back
// to the id_token. Nothing else (e.g. LINE_USER_ID) is kept.
func mapClaims(sub string, userinfo, idToken map[string]any) users.SSOClaims {
	get := func(key string) string {
		for _, src := range []map[string]any{userinfo, idToken} {
			if v, ok := src[key]; ok && v != nil {
				switch t := v.(type) {
				case string:
					if s := strings.TrimSpace(t); s != "" {
						return s
					}
				case float64:
					return strconv.FormatFloat(t, 'f', -1, 64)
				}
			}
		}
		return ""
	}
	return users.SSOClaims{
		Subject:      sub,
		EmployeeCode: get("USER"),
		FirstNameTH:  get("FIRSTNAME_TH"),
		LastNameTH:   get("LASTNAME_TH"),
		FirstNameEN:  get("FIRSTNAME_EN"),
		LastNameEN:   get("LASTNAME_EN"),
		Email:        get("EMAIL"),
		Department:   get("DEPARTMENT"),
		Division:     get("DIVISION"),
		PositionTH:   get("POSITION_TH"),
	}
}
