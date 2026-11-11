// System Atlas config — copy to the project root and fill in. Engine: tools/atlas (do not edit per project).
const baseURL = process.env.ATLAS_BASE_URL ?? "http://localhost:3000";

export default {
  dataDir: "docs/atlas",
  port: 4400,
  baseURL,
  allowHosts: ["localhost", "127.0.0.1"], // dev / UAT hosts only — never production
  // The app under test, started on the first run when its url does not answer (same shape as Playwright webServer).
  // Use a test stack with its own database so tour data never lands in the dev database.
  // stack: { servers: [{ command: "npm run dev -- --port 3100", cwd: "frontend", url: "http://localhost:3100", env: {} }] },
  playwrightFrom: "frontend",             // folder with playwright or @playwright/test in node_modules
  browser: { viewport: { width: 1280, height: 800 }, locale: "th-TH", timezoneId: "Asia/Bangkok" },

  // Return Playwright cookies for a demo user of `role` (a key of project.json → sessionRoles).
  // Use whatever your e2e setup uses: a dev-only CLI that mints a session, a test login endpoint, …
  async session(role) {
    throw new Error(`atlas.config.mjs: implement session("${role}")`);
    // return [{ name: "session", value: token, domain: new URL(baseURL).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }];
  },
};
