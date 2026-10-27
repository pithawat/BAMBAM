import path from "node:path";
import { expect, request as playwrightRequest, test, type Page } from "@playwright/test";

// F25 (settings Stage 1, CR-001 / CR-003 / CR-004): the "ตั้งค่าระบบ" entry, the administration shell (sidebar ≥ 1024px,
// drawer below) and access per page (BR-ALL-1). Superadmin sees every item; Admin only ข้อมูลกลาง and gets Forbidden
// on the Superadmin pages; every other role has no entry and a full-page Forbidden. The API refuses the same. Real API.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

const SERVICES = ["หน้าแรก", "แจ้งซ่อม"];
const SOON = ["จองรถ", "จองห้องประชุม"];
const MASTER_DATA = ["อาคารและอุปกรณ์", "หมวดงานและอาการ"];
const SUPERADMIN_ONLY = [
  { label: "ประเภทผู้รับเหมา", path: "/settings/contractor-types" },
  { label: "ผู้ใช้", path: "/settings/users" },
  { label: "Role และสิทธิ์", path: "/settings/roles" },
  { label: "ประวัติการเปลี่ยนแปลง", path: "/settings/audit" },
];
const NO_ACCESS = "คุณไม่มีสิทธิ์เข้าถึงหน้านี้";

/** #2–#12 (roles, permissions, users, audit): Superadmin only. */
const IDENTITY_ROUTES: [string, string][] = [
  ["GET", "/roles"], ["POST", "/roles"], ["PATCH", "/roles/00000000-0000-4000-8000-000000000000"], ["DELETE", "/roles/00000000-0000-4000-8000-000000000000"],
  ["GET", "/permissions"], ["PUT", "/permissions"],
  ["GET", "/users"], ["GET", "/users/00000000-0000-4000-8000-000000000000"], ["PUT", "/users/00000000-0000-4000-8000-000000000000/role"],
  ["GET", "/audit"], ["GET", "/audit/actors"],
];

/** The sidebar (desktop) or the opened drawer (phone). */
async function openNav(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole("complementary", { name: "เมนูหลัก" });
  await page.getByRole("button", { name: "เปิดเมนูหลัก" }).click();
  return page.getByRole("dialog", { name: "เมนูหลัก" });
}

/** "ตั้งค่าระบบ" in the top navbar (desktop) or on the profile page (phone). */
async function settingsEntry(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.goto("/profile");
    await expect(page.getByText("ข้อมูลจาก RMC SSO").filter({ visible: true }).first()).toBeVisible();
    return page.getByRole("main").getByRole("link", { name: "ตั้งค่าระบบ" });
  }
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "บริการหลัก" }).filter({ visible: true })).toBeVisible();
  return page.getByRole("navigation", { name: "บริการหลัก" }).filter({ visible: true }).getByRole("link", { name: "ตั้งค่าระบบ" });
}

async function status(role: string, baseURL: string | undefined, method: string, url: string) {
  const api = await playwrightRequest.newContext({ baseURL, storageState: auth(role) });
  return (await api.fetch(`${API}${url}`, { method, data: method === "GET" || method === "DELETE" ? undefined : {} })).status();
}

test.describe("super_admin", () => {
  test.use({ storageState: auth("super_admin") });

  test("AC1: ตั้งค่าระบบ opens อาคารและอุปกรณ์ in the administration shell with every item; Home is S29", async ({ page, isMobile }) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/");
    await expect(page.getByText("ภาพรวมวันนี้").first()).toBeVisible();

    await (await settingsEntry(page, isMobile)).click();
    await expect(page).toHaveURL(/\/settings\/buildings$/, { timeout: 30_000 }); // first compile of /settings on `next dev`
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "เลือกห้องจากผัง" })).toBeVisible();
    // No top bar on settings pages (CR-001); guardian mascot beside the heading (CR-003)
    await expect(page.getByRole("navigation", { name: "บริการหลัก" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /เมนูบัญชี/ })).toHaveCount(0);
    await expect(page.locator('main img[src*="superadmin-guardian"]')).toBeVisible();

    const nav = await openNav(page, isMobile);
    await expect(nav.getByRole("img", { name: "BAMBAM" })).toBeVisible();
    for (const label of [...SERVICES, ...MASTER_DATA, ...SUPERADMIN_ONLY.map((p) => p.label)]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    for (const label of SOON) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
    }
    await expect(nav.getByRole("link", { name: "อาคารและอุปกรณ์" })).toHaveAttribute("aria-current", "page");
    if (isMobile) await page.keyboard.press("Escape");

    // Every Superadmin page opens
    for (const p of SUPERADMIN_ONLY) {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1, name: p.label })).toBeVisible();
      await expect(page.getByText(NO_ACCESS)).toHaveCount(0);
    }
  });

  test("API: the settings reads of every stage answer for Superadmin", async ({ baseURL }) => {
    for (const url of ["/roles", "/permissions", "/users", "/audit", "/buildings", "/categories", "/contractor-types", "/asset-types"]) {
      expect(await status("super_admin", baseURL, "GET", url), url).toBe(200);
    }
  });
});

test.describe("admin", () => {
  test.use({ storageState: auth("admin") });

  test("AC1b: sidebar shows only ข้อมูลกลาง; Superadmin pages are Forbidden with a way back", async ({ page, isMobile }) => {
    test.slow(); // first visits compile on `next dev`
    await (await settingsEntry(page, isMobile)).click();
    await expect(page).toHaveURL(/\/settings\/buildings$/, { timeout: 30_000 }); // first compile of /settings on `next dev`
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
    await expect(page.locator('main img[src*="admin-planner"]')).toBeVisible();

    const nav = await openNav(page, isMobile);
    for (const label of [...SERVICES, ...MASTER_DATA]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    for (const p of SUPERADMIN_ONLY) await expect(nav.getByText(p.label, { exact: true })).toHaveCount(0);
    await expect(nav.getByText("ผู้ใช้และสิทธิ์")).toHaveCount(0);
    if (isMobile) await page.keyboard.press("Escape");

    for (const p of SUPERADMIN_ONLY) {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { name: NO_ACCESS })).toBeVisible();
      await expect(page.getByText("ส่วนนี้กำลังพัฒนา")).toHaveCount(0);
    }
    await page.getByRole("link", { name: "ไปที่อาคารและอุปกรณ์" }).click();
    await expect(page).toHaveURL(/\/settings\/buildings$/);
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
  });

  test("AC1b: the API returns 403 for #2–#12", async ({ baseURL }) => {
    for (const [method, url] of IDENTITY_ROUTES) expect(await status("admin", baseURL, method, url), `${method} ${url}`).toBe(403);
  });
});

for (const role of ["employee", "technician", "housekeeper_lead", "security_lead"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });

    test(`AC2: ${role} has no settings entry; /settings is a full-page Forbidden; the API refuses`, async ({ page, baseURL, isMobile }) => {
      test.slow(); // first visits compile on `next dev`
      const entry = await settingsEntry(page, isMobile);
      await expect(entry).toHaveCount(0);

      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: NO_ACCESS })).toBeVisible();
      await expect(page.getByRole("link", { name: "กลับหน้าแรก" })).toBeVisible();
      await expect(page.getByRole("complementary", { name: "เมนูหลัก" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "เปิดเมนูหลัก" })).toHaveCount(0);
      await page.goto("/settings/users");
      await expect(page.getByRole("heading", { name: NO_ACCESS })).toBeVisible();

      expect(await status(role, baseURL, "GET", "/roles")).toBe(403);
      expect(await status(role, baseURL, "GET", "/categories")).toBe(403);
    });
  });
}

test("API: no session gets 401", async ({ request }) => {
  const res = await request.get(`${API}/roles`);
  expect([res.status(), (await res.json()).error.code]).toEqual([401, "UNAUTHENTICATED"]);
});

test.describe("phone drawer", () => {
  test.use({ storageState: auth("super_admin") });

  test("AC2b: Escape closes the drawer and focus returns to the menu button; navigating closes it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "drawer is the < 1024px layout");
    test.slow(); // first visits compile on `next dev`
    await page.goto("/settings/buildings");
    await expect(page.getByRole("complementary", { name: "เมนูหลัก" })).toBeHidden();
    const menu = page.getByRole("button", { name: "เปิดเมนูหลัก" });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "เมนูหลัก" });
    await expect(drawer.getByRole("button", { name: "ปิดเมนู" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await drawer.getByRole("link", { name: "หมวดงานและอาการ" }).click();
    await expect(page).toHaveURL(/\/settings\/categories$/);
    await expect(page.getByRole("heading", { level: 1, name: "หมวดงานและอาการ" })).toBeVisible();
    await expect(drawer).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
