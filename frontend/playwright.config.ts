import { defineConfig, devices } from "@playwright/test";

// E2E runs against the real Go API (NEXT_PUBLIC_USE_MOCKS=false) and a local
// Postgres (`docker compose up -d db` + `make migrate-up` in backend/).
// Real RMC SSO cannot be automated: e2e/global-setup.ts creates a demo-user
// session through `go run ./cmd/devsession` (dev/UAT only, no HTTP backdoor).

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "go run ./cmd/api",
      cwd: "../backend",
      url: "http://localhost:8080/api/v1/health",
      env: { APP_ENV: "development" },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx next dev --port ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      env: { NEXT_PUBLIC_USE_MOCKS: "false", NEXT_PUBLIC_ROLE_SWITCHER: "true" },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
