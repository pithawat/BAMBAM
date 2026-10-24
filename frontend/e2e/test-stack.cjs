// The local test stack shared by Playwright e2e and the System Atlas runner (D-092):
// the docker Postgres from docker-compose.yml (database bambam_e2e), the Go API on :8090
// and Next on :3100 with its own .next-e2e folder — never the dev servers (3000 / 8080) or their database.
// Override with E2E_DATABASE_URL / E2E_API_URL / E2E_PORT.
//
//   node frontend/e2e/test-stack.cjs prepare   start the docker db, create the database if missing, migrate
/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://bambam:bambam@localhost:5433/bambam_e2e?sslmode=disable";
const WEB_PORT = Number(process.env.E2E_PORT ?? 3100);
const API_URL = (process.env.E2E_API_URL ?? "http://localhost:8090").replace(/\/$/, "");
const BASE_URL = `http://localhost:${WEB_PORT}`;

/** Env for the Go API and cmd/devsession: same database, so demo sessions are valid on this API. */
const apiEnv = {
  APP_ENV: "development",
  DATABASE_URL,
  HTTP_PORT: new URL(API_URL).port || "80",
  ROLE_SWITCHER_ENABLED: "true",
};

/** Env for `next dev`: proxies /api to the test API; .next-e2e so it can run beside the dev server. */
const webEnv = {
  NEXT_PUBLIC_USE_MOCKS: "false",
  NEXT_PUBLIC_ROLE_SWITCHER: "true",
  API_INTERNAL_URL: API_URL,
  NEXT_DIST_DIR: ".next-e2e",
};

const PREPARE = `node "${path.join(__dirname, "test-stack.cjs")}" prepare`;

/** Servers in Playwright webServer shape; the API command migrates the database first. */
const servers = [
  { command: `${PREPARE} && go run ./cmd/api`, cwd: path.join(ROOT, "backend"), url: `${API_URL}/api/v1/health`, env: apiEnv, timeout: 240_000 },
  { command: `npx next dev --port ${WEB_PORT}`, cwd: path.join(ROOT, "frontend"), url: `${BASE_URL}/login`, env: webEnv, timeout: 240_000 },
];

/** Readable target without the password, e.g. "bambam_e2e @ localhost:5433". */
const mask = (url) => { const u = new URL(url); return `${decodeURIComponent(u.pathname.slice(1))} @ ${u.hostname}:${u.port || "5432"}`; };
const DATABASE_LABEL = mask(DATABASE_URL);

/** DATABASE_URL of the dev API (backend/.env), if there is one — never printed. */
function devDatabaseUrl() {
  try {
    const line = require("node:fs").readFileSync(path.join(ROOT, "backend", ".env"), "utf8").split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : null;
  } catch { return null; }
}

/** Guard 1: the test database must not be the dev database (same host, port and database name). */
function assertNotDevDb() {
  const dev = devDatabaseUrl();
  if (dev && mask(dev) === DATABASE_LABEL) {
    throw new Error(`E2E_DATABASE_URL points at the dev database (${DATABASE_LABEL}) — use a separate database, e.g. bambam_e2e`);
  }
}

/** Guard 2: the API under test really uses the test database — a session created there must be accepted by it. */
async function assertApiUsesTestDb() {
  const token = sessionToken("employee");
  const res = await fetch(`${API_URL}/api/v1/me`, { headers: { cookie: `bam_session=${token}` } }).catch((e) => ({ status: 0, e }));
  if (res.status !== 200) {
    throw new Error(`the API at ${API_URL} does not accept a session from ${DATABASE_LABEL} (HTTP ${res.status}) — it is running on another database; stop it and run again`);
  }
}

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

/** docker compose up db → CREATE DATABASE if missing (local docker only) → goose up. */
function prepare() {
  assertNotDevDb();
  const u = new URL(DATABASE_URL);
  const name = decodeURIComponent(u.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`E2E_DATABASE_URL: unexpected database name "${name}"`);
  if (["localhost", "127.0.0.1"].includes(u.hostname) && (u.port || "5432") === "5433") {
    const compose = ["compose", "-f", path.join(ROOT, "docker-compose.yml")];
    run("docker", [...compose, "up", "-d", "--wait", "db"]);
    const psql = (sql, db = "postgres") => run("docker", [...compose, "exec", "-T", "db", "psql", "-U", decodeURIComponent(u.username), "-d", db, "-tAc", sql]).trim();
    if (psql(`SELECT 1 FROM pg_database WHERE datname = '${name}'`) !== "1") psql(`CREATE DATABASE ${name}`);
  }
  run("goose", ["-dir", path.join(ROOT, "backend", "db", "migrations"), "postgres", DATABASE_URL, "up"]);
}

/** Session token for the demo user of `role`, created in the test database. */
function sessionToken(role) {
  return run("go", ["run", "./cmd/devsession", "-role", role], { cwd: path.join(ROOT, "backend"), env: { ...process.env, ...apiEnv } }).trim();
}

/** One line that says where a run goes; printed by e2e and shown in the Atlas header. */
const describe = () => `web ${BASE_URL} · API ${API_URL} · DB ${DATABASE_LABEL}`;

module.exports = { DATABASE_URL, DATABASE_LABEL, API_URL, WEB_PORT, BASE_URL, apiEnv, webEnv, servers, prepare, sessionToken, assertNotDevDb, assertApiUsesTestDb, describe };

// node frontend/e2e/test-stack.cjs browse [role]  — a Chromium window on the test web, signed in as the demo user
// of `role` (default admin). Real SSO cannot sign in on the test stack; this is the manual way in.
if (require.main === module && process.argv[2] === "browse") {
  const role = process.argv[3] ?? "admin";
  (async () => {
    const { chromium } = require("@playwright/test");
    assertNotDevDb();
    const token = sessionToken(role);
    const browser = await chromium.launch({ headless: false });
    const ctx = await browser.newContext({ viewport: null, locale: "th-TH", timezoneId: "Asia/Bangkok" });
    await ctx.addCookies([{ name: "bam_session", value: token, domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { timeout: 180_000 });
    console.log(`signed in as demo ${role} → ${describe()} (close the window to stop; switch roles with the role switcher)`);
    browser.on("disconnected", () => process.exit(0));
  })().catch((e) => { console.error(`browse failed: ${String(e.stderr || e.message).trim()}`); process.exit(1); });
}

if (require.main === module && process.argv[2] === "prepare") {
  try {
    prepare();
    console.log(`test database ready: ${DATABASE_LABEL}`);
  } catch (e) {
    console.error(`test-stack prepare failed: ${String(e.stderr || e.message).trim()}`);
    console.error("Is Docker Desktop running? (docker compose up -d db) Is goose on PATH? (go install github.com/pressly/goose/v3/cmd/goose@latest)");
    process.exit(1);
  }
}
