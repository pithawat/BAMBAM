// System Atlas config for BAMBAM (engine: tools/atlas, data: docs/atlas).
// Run: node tools/atlas/cli.mjs serve   → http://127.0.0.1:4400
// Tours run on the same local test stack as Playwright e2e (frontend/e2e/test-stack.cjs, D-092):
// docker Postgres database bambam_e2e, API :8090, web :3100 — the dev servers and their database are never touched.
import { createRequire } from "node:module";

const stack = createRequire(import.meta.url)("./frontend/e2e/test-stack.cjs");
const baseURL = process.env.ATLAS_BASE_URL ?? stack.BASE_URL;

export default {
  dataDir: "docs/atlas",
  port: 4400,
  baseURL,
  // Hosts the runner may drive. Never add production.
  allowHosts: ["localhost", "127.0.0.1"],
  // started on the first run when not already up (reused if e2e or a previous run left them running)
  stack: { servers: stack.servers },
  // shown in the Atlas header and the run popup: where tours go
  target: stack.describe(),
  // before every run: never the dev database, and the API really uses the test database
  async preflight() {
    stack.assertNotDevDb();
    await stack.assertApiUsesTestDb();
  },
  // Folder whose node_modules has playwright or @playwright/test (reuses the e2e browsers).
  playwrightFrom: "frontend",
  browser: {
    viewport: { width: 1280, height: 800 },
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    // headless runs use Chrome's new headless with the GPU; these args are only the fallback for the old headless shell
    captureArgs: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
  // Cookies for a demo-user session of `role` in the test database (same as frontend/e2e/global-setup.ts).
  session(role) {
    return [{ name: "bam_session", value: stack.sessionToken(role), domain: new URL(baseURL).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }];
  },
};
