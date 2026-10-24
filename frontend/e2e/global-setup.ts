import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROLES } from "../src/lib/platform/types";
import stack from "./test-stack.cjs";

// Creates one session per demo role through the backend CLI and stores a
// Playwright storageState per role in e2e/.auth/<role>.json.
export const AUTH_DIR = path.join(__dirname, ".auth");

export default async function globalSetup() {
  // Where this run goes, and proof that it is the test stack (D-092): never the dev database,
  // and the API under test accepts a session created in the test database.
  console.log(`e2e → ${stack.describe()}`);
  stack.assertNotDevDb();
  await stack.assertApiUsesTestDb();
  mkdirSync(AUTH_DIR, { recursive: true });
  // Each role gets a shared session; the role switch test gets its own per project,
  // because switching replaces (deletes) the session it runs on.
  const sessions: [string, string][] = [
    ...ROLES.map((r): [string, string] => [r, r]),
    ["switch-desktop", "employee"],
    ["switch-mobile", "employee"],
  ];
  for (const [file, role] of sessions) {
    const token = stack.sessionToken(role); // test database (e2e/test-stack.cjs), same as the API under test
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
