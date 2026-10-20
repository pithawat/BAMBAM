import { defineConfig, devices } from "@playwright/test";

// E2E runs against the real Go API (NEXT_PUBLIC_USE_MOCKS=false) and a local
// Postgres (`docker compose up -d db` + `make migrate-up` in backend/).
// Real RMC SSO cannot be automated: e2e/global-setup.ts creates a demo-user
// session through `go run ./cmd/devsession` (dev/UAT only, no HTTP backdoor).

// E2E_PORT / E2E_API_URL point the run at another local stack (defaults: 3000 / 8080).
const PORT = Number(process.env.E2E_PORT ?? 3000);
const API_URL = (process.env.E2E_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

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
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        // software WebGL for the S29 3D card (CR-016) in headless Chrome
        launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "go run ./cmd/api",
      cwd: "../backend",
      url: `${API_URL}/api/v1/health`,
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
