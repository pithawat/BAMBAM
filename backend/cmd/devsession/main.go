// Command devsession prints a session token for a seeded demo user, for
// Playwright e2e tests and local API checks without a real RMC SSO login.
// It talks to the database directly (no HTTP backdoor) and refuses to run in production.
//
//	go run ./cmd/devsession -role employee
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/pithawat/BAMBAM/backend/internal/platform/auth"
	"github.com/pithawat/BAMBAM/backend/internal/platform/config"
	"github.com/pithawat/BAMBAM/backend/internal/platform/db"
	"github.com/pithawat/BAMBAM/backend/internal/platform/users"
)

func main() {
	role := flag.String("role", users.RoleEmployee, "demo user role")
	flag.Parse()
	if err := run(*role); err != nil {
		fmt.Fprintln(os.Stderr, "devsession:", err)
		os.Exit(1)
	}
}

func run(role string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if cfg.AppEnv == config.EnvProduction || !cfg.RoleSwitcherEnabled {
		return fmt.Errorf("only available when APP_ENV is not production and ROLE_SWITCHER_ENABLED=true")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	svc := users.NewService(users.NewRepository(pool))
	if err := svc.EnsureDemoUsers(ctx); err != nil {
		return err
	}
	u, err := svc.DemoUserForRole(ctx, role)
	if err != nil {
		return err
	}
	token, _, err := auth.NewSessionStore(pool, svc, cfg.SessionTTL).Create(ctx, u.ID, nil)
	if err != nil {
		return err
	}
	fmt.Println(token)
	return nil
}
