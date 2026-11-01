import path from "node:path";
import { expect, request as playwrightRequest, type APIRequestContext, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import stack from "../test-stack.cjs";

// Sessions and roles for the CR-006 specs (settings Stage R1). The matrix is shared by every spec, so permission
// writes run on Roles a spec creates (reached through their demo user via the dev role switch) and are removed after.

export const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
export const SETTINGS_API = "/api/v1/settings";
/** A save under full-suite load (4 workers on `next dev`) can take longer than the default 5 s. */
export const SAVE = 20_000;

export type RoleItem = { id: string; key: string; name: string; guard: string | null; assignable: boolean };
export type Matrix = { version: number; grantable: string[]; roles: { id: string; key: string; guard: string | null; permissions: string[] }[] };

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 100)}`;

export async function apiAs(baseURL: string | undefined, role: string) {
  return playwrightRequest.newContext({ baseURL, storageState: auth(role) });
}

export async function createRole(api: APIRequestContext, name: string, copyFromRoleId: string | null = null): Promise<RoleItem> {
  const res = await api.post(`${SETTINGS_API}/roles`, { data: { name, description: "e2e", copyFromRoleId } });
  expect(res.status()).toBe(201);
  return (await res.json()).data;
}

export async function roles(api: APIRequestContext): Promise<RoleItem[]> {
  return (await (await api.get(`${SETTINGS_API}/roles`)).json()).data;
}

export async function matrix(api: APIRequestContext): Promise<Matrix> {
  return (await (await api.get(`${SETTINGS_API}/permissions`)).json()).data;
}

/** Saves `changes` for one role (version read first); returns the response. */
export async function savePermissions(api: APIRequestContext, roleId: string, changes: Record<string, boolean>) {
  const m = await matrix(api);
  return api.put(`${SETTINGS_API}/permissions`, {
    data: { version: m.version, changes: Object.entries(changes).map(([permission, granted]) => ({ roleId, permission, granted })) },
  });
}

/** Sets a role to exactly `keys` (Superadmin api). */
export async function setRoleKeys(api: APIRequestContext, roleId: string, keys: string[]) {
  const m = await matrix(api);
  const current = m.roles.find((r) => r.id === roleId)!.permissions;
  const all = new Set([...current, ...keys]);
  const changes: Record<string, boolean> = {};
  for (const k of all) if (current.includes(k) !== keys.includes(k)) changes[k] = keys.includes(k);
  if (Object.keys(changes).length === 0) return;
  const res = await savePermissions(api, roleId, changes);
  expect(res.status(), await res.text()).toBe(200);
}

/**
 * With "บันทึกการเปลี่ยนสิทธิ์?" open: confirm. Other workers save the shared matrix too — on the conflict take
 * "โหลดข้อมูลล่าสุด" (pending changes are kept) and save again from the save bar.
 */
export async function confirmSave(page: Page) {
  const dialog = page.getByRole("alertdialog", { name: "บันทึกการเปลี่ยนสิทธิ์?" });
  const reload = dialog.getByRole("button", { name: "โหลดข้อมูลล่าสุด" });
  const state = async () => ((await reload.isVisible()) ? "conflict" : (await dialog.isVisible()) ? "saving" : "done");
  for (let attempt = 0; attempt < 8; attempt++) {
    await dialog.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
    await expect.poll(state, { timeout: SAVE }).not.toBe("saving");
    if ((await state()) === "done") return;
    await reload.click();
    await page.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
  }
  throw new Error("matrix save kept conflicting");
}

/** บันทึกสิทธิ์ (save bar) → confirm. */
export async function saveMatrix(page: Page) {
  await page.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
  await confirmSave(page);
}

/** A fresh API session switched to the demo user of `roleKey` (the switch replaces the session it runs on). */
export async function sessionAs(baseURL: string | undefined, roleKey: string) {
  const token = stack.sessionToken("employee");
  const api = await playwrightRequest.newContext({
    baseURL,
    storageState: {
      cookies: [{ name: "bam_session", value: token, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, secure: true, sameSite: "Lax" }],
      origins: [],
    },
  });
  const res = await api.post("/api/v1/dev/role-switch", { data: { role: roleKey } });
  expect(res.status()).toBe(200);
  return api;
}

/** A browser context signed in as the demo user of `roleKey`; `device` = the project's viewport / mobile options. */
export async function browserAs(browser: Browser, baseURL: string | undefined, roleKey: string, device: BrowserContextOptions = {}) {
  const api = await sessionAs(baseURL, roleKey);
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor } = device;
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL, storageState: await api.storageState() });
  await api.dispose();
  return ctx;
}

/**
 * A viewer whose Role has exactly `keys` (a Role made for the test; `close` deletes it with its demo user). Since
 * CR-006 Admin holds every settings key, so "no access" cases use one of these instead of the seeded Admin.
 */
export async function viewerWith(browser: Browser, baseURL: string | undefined, keys: string[], device: BrowserContextOptions = {}) {
  const superApi = await apiAs(baseURL, "super_admin");
  const role = await createRole(superApi, unique("E2E สิทธิ์"));
  await setRoleKeys(superApi, role.id, keys);
  const ctx = await browserAs(browser, baseURL, role.key, device);
  const page = await ctx.newPage();
  return {
    role,
    page,
    close: async () => {
      await ctx.close();
      await superApi.delete(`${SETTINGS_API}/roles/${role.id}`);
      await superApi.dispose();
    },
  };
}
