import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROLES } from "../src/lib/platform/types";

// Creates one session per demo role through the backend CLI and stores a
// Playwright storageState per role in e2e/.auth/<role>.json.
export const AUTH_DIR = path.join(__dirname, ".auth");

export default function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const backend = path.join(__dirname, "..", "..", "backend");
  // Each role gets a shared session; the role switch test gets its own per project,
  // because switching replaces (deletes) the session it runs on.
  const sessions: [string, string][] = [
    ...ROLES.map((r): [string, string] => [r, r]),
    ["switch-desktop", "employee"],
    ["switch-mobile", "employee"],
  ];
  for (const [file, role] of sessions) {
    const token = execFileSync("go", ["run", "./cmd/devsession", "-role", role], {
      cwd: backend,
      env: { ...process.env, APP_ENV: "development" },
      encoding: "utf8",
    }).trim();
    const state = {
      cookies: [
        {
          name: "bam_session",
          value: token,
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 3600,
          httpOnly: true,
          secure: true,
          sameSite: "Lax" as const,
        },
      ],
      origins: [],
    };
    writeFileSync(path.join(AUTH_DIR, `${file}.json`), JSON.stringify(state));
  }
}
