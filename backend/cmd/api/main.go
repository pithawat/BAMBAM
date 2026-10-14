// Command api is the BAMBAM HTTP API. Wiring only:
// config → db pool → repos → services → controllers → routes.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/pithawat/BAMBAM/backend/internal/platform/auth"
	"github.com/pithawat/BAMBAM/backend/internal/platform/config"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/httpx"
	"github.com/pithawat/BAMBAM/backend/internal/platform/middleware"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	slog.SetDefault(middleware.NewLogger(os.Stdout, cfg.AppEnv != config.EnvDevelopment))
	gin.SetMode(cfg.GinMode)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// platform
	userSvc := users.NewService(users.NewRepository(pool))
	userCtl := users.NewController(userSvc, cfg.EnvironmentLabel())
	sessions := auth.NewSessionStore(pool, userSvc, cfg.SessionTTL)
	authH := auth.NewHandler(cfg, sessions, userSvc, userCtl, func(ctx context.Context) error { return pool.Ping(ctx) })

	if cfg.RoleSwitcherEnabled {
		if err := userSvc.EnsureDemoUsers(ctx); err != nil {
			return err
		}
		slog.Info("role switcher enabled, demo users seeded")
	}

	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(middleware.RequestID(), middleware.Logger(), middleware.Recovery(), middleware.CORS(cfg.CORSAllowedOrigins))

	auth.RegisterRoutes(r, authH)
	api := r.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) { httpx.OK(c, gin.H{"status": "ok"}) })

	authed := api.Group("", middleware.RequireAuth(sessions))
	users.RegisterRoutes(authed, userCtl)
	if cfg.RoleSwitcherEnabled {
		dev := authed.Group("/dev")
		users.RegisterDevRoutes(dev, userCtl)
		auth.RegisterDevRoutes(dev, authH)
	}
	// modules: <module>.RegisterRoutes(authed.Group("/<module>"), ctl)

	go purgeSessions(ctx, sessions)

	srv := &http.Server{Addr: ":" + cfg.HTTPPort, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	errCh := make(chan error, 1)
	go func() {
		slog.Info("api listening", "addr", srv.Addr, "env", cfg.AppEnv)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func purgeSessions(ctx context.Context, s *auth.SessionStore) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n, err := s.PurgeExpired(ctx); err != nil {
				slog.Error("purge expired sessions", "err", err)
			} else if n > 0 {
				slog.Info("purged expired sessions", "count", n)
			}
		}
	}
}
