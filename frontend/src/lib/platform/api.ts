import { env } from "@/lib/env";
import { http } from "@/lib/http";
import { mockDemoUsers, mockMeByRole } from "./mocks";
import { ROLES, type DemoUser, type Me, type Role } from "./types";

// Platform API (P1–P3). Returns mocks when NEXT_PUBLIC_USE_MOCKS=true so the UI
// can be built without the backend; the mock role is kept in localStorage.

const MOCK_ROLE_KEY = "bambam.mockRole";

function mockRole(): Role {
  try {
    const r = window.localStorage.getItem(MOCK_ROLE_KEY);
    if (r && (ROLES as readonly string[]).includes(r)) return r as Role;
  } catch {
    // storage unavailable — fall back to employee
  }
  return "employee";
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export async function getMe(): Promise<Me> {
  if (env.useMocks) {
    await delay();
    return mockMeByRole[mockRole()];
  }
  return http.get<Me>("/me");
}

export async function getDemoUsers(): Promise<DemoUser[]> {
  if (env.useMocks) {
    await delay();
    return mockDemoUsers;
  }
  return http.get<DemoUser[]>("/dev/demo-users");
}

export async function switchRole(role: Role): Promise<Me> {
  if (env.useMocks) {
    await delay(400);
    try {
      window.localStorage.setItem(MOCK_ROLE_KEY, role);
    } catch {
      // ignore
    }
    return mockMeByRole[role];
  }
  return http.post<Me>("/dev/role-switch", { role });
}

/** Login start (S01). Full-page navigation: the API redirects to RMC SSO. */
export function loginUrl(next: string): string {
  return `/api/auth/login?${new URLSearchParams({ next: safeNext(next) })}`;
}

/** Logout endpoint: POSTed by a form so the browser follows the redirect to SSO End Session. */
export const LOGOUT_URL = "/api/auth/logout";

/** Same-origin relative paths only; anything else becomes "/" (S01). Mirrors auth.SafeNext in Go. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n\\]/.test(next)) {
    return "/";
  }
  if (next.startsWith("/api/") || next.startsWith("/login") || next.startsWith("/signed-out")) return "/";
  return next;
}
