import { defineConfig, devices } from "@playwright/test";
import stack from "./e2e/test-stack.cjs";

// E2E runs against the real Go API (NEXT_PUBLIC_USE_MOCKS=false) on its own local test stack
// (e2e/test-stack.cjs, D-092): the docker Postgres from docker-compose.yml, database bambam_e2e
// (created + migrated when the API starts), API :8090, web :3100 — never the dev servers or their database.
// Real RMC SSO cannot be automated: e2e/global-setup.ts creates a demo-user
// session through `go run ./cmd/devsession` (dev/UAT only, no HTTP backdoor) in the same database.
// E2E_DATABASE_URL / E2E_PORT / E2E_API_URL override the stack; the System Atlas runner uses the same one.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: stack.BASE_URL,
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
        // The 3D specs (F23, F31) switch to Chrome's new headless for WebGL (D-103). Software WebGL
        // (swiftshader) on the whole project delayed canvas / paint work on other pages by 10–30 s.
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // reused when already up (e.g. started by the Atlas runner) — both use the same ports and database
  webServer: stack.servers.map((s) => ({ ...s, reuseExistingServer: !process.env.CI })),
});
