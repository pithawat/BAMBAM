import { env } from "@/lib/env";
import { http } from "@/lib/http";
import { mockRole } from "@/lib/platform/api";
import { mockMeByRole } from "@/lib/platform/mocks";
import { canAny, PERM, type PermissionKey } from "@/lib/platform/permissions";
import { mockErrors, mockRoles, mockScenario } from "./mocks";
import type { Role } from "./types";

// Settings API (docs/modules/settings/04-api-contract.md). Every call goes through lib/http; with
// NEXT_PUBLIC_USE_MOCKS=true it returns mocks/scenarios and applies the same permission as the route.

const BASE = "/settings";

/** #2 GET /settings/roles — roles with user counts (S24 list, S25 role filter). Needs roles or users. */
export async function getRoles(): Promise<Role[]> {
  if (env.useMocks) return mockRead(() => mockRoles, PERM.settingsRoles, PERM.settingsUsers);
  return http.get<Role[]>(`${BASE}/roles`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mockRead<T>(fn: () => T, ...perms: PermissionKey[]): Promise<T> {
  const scenario = mockScenario();
  await sleep(scenario === "slow" ? 3000 : 300);
  if (scenario === "forbidden" || !canAny(mockMeByRole[mockRole()], ...perms)) throw mockErrors.forbidden();
  if (scenario === "error") throw mockErrors.server();
  const data = fn();
  return (scenario === "empty" && Array.isArray(data) ? [] : data) as T;
}
