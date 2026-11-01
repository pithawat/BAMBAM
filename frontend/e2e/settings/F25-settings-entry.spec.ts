import path from "node:path";
import { expect, request as playwrightRequest, test, type Locator, type Page } from "@playwright/test";
import { viewerWith } from "./sessions";

// F25 (settings Stage 1, CR-001 / CR-003, CR-006): the "ตั้งค่าระบบ" menu in the app navbar — a dropdown ≥ 1024px
// (groups left, the hovered group's sub-menus right), a sheet below (groups, then sub-menus) — on every page, settings
// included, and access per page (BR-ALL-1). Superadmin and (CR-006 defaults) Admin see every item; a Role with only
// some settings keys sees those and gets Forbidden on the rest; every other seeded role has no menu and a full-page
// Forbidden. The API refuses the same. Real API.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

/** Every group and sub-menu (CR-006 `_common.md` §2); `soon` items are not links. */
const FULL_MENU: Record<string, string[]> = {
  สถานที่และอุปกรณ์: ["อาคารและอุปกรณ์", "ประเภทอาคาร", "ประเภทอุปกรณ์"],
  การให้บริการ: ["หมวดงานและอาการ", "ประเภทผู้รับเหมา"],
  ผู้ใช้งานและสิทธิ์: ["ผู้ใช้งาน", "บทบาทและสิทธิ์", "ประวัติการเปลี่ยนแปลง"],
};
const SOON = ["การจองรถ", "การจองห้องประชุม"];
const PAGES = [
  { heading: "ประเภทผู้รับเหมา", path: "/settings/contractor-types" },
  { heading: "ผู้ใช้", path: "/settings/users" },
  { heading: "Role และสิทธิ์", path: "/settings/roles" },
  { heading: "ประวัติการเปลี่ยนแปลง", path: "/settings/audit" },
];
const NO_ACCESS = "คุณไม่มีสิทธิ์เข้าถึงหน้านี้";

/** #2–#12 (roles, permissions, users, audit): need their settings keys. */
const IDENTITY_ROUTES: [string, string][] = [
  ["GET", "/roles"], ["POST", "/roles"], ["PATCH", "/roles/00000000-0000-4000-8000-000000000000"], ["DELETE", "/roles/00000000-0000-4000-8000-000000000000"],
  ["GET", "/permissions"], ["PUT", "/permissions"],
  ["GET", "/users"], ["GET", "/users/00000000-0000-4000-8000-000000000000"], ["PUT", "/users/00000000-0000-4000-8000-000000000000/role"],
  ["GET", "/audit"], ["GET", "/audit/actors"],
];

const menuButton = (page: Page) => page.getByRole("button", { name: "ตั้งค่าระบบ" }).filter({ visible: true });

/** Opens the menu (dropdown or sheet). */
async function openMenu(page: Page) {
  await menuButton(page).click();
  const menu = page.getByRole("dialog", { name: "การตั้งค่าระบบ" });
  await expect(menu).toBeVisible();
  return menu;
}

/** The sub-menus of `group`: hover / tap the group (phones: tap it, then come back for the next one). */
async function subMenu(menu: Locator, group: string) {
  await menu.getByRole("button", { name: new RegExp(`^${group}`) }).click();
  return menu.getByRole("navigation", { name: group });
}

/** The menu lists exactly `expected` (groups → links). */
async function expectMenu(page: Page, isMobile: boolean, expected: Record<string, string[]>) {
  const menu = await openMenu(page);
  const groups = menu.getByRole("group", { name: "กลุ่มการตั้งค่า" }).getByRole("button");
  await expect(groups).toHaveCount(Object.keys(expected).length);
  for (const [group, items] of Object.entries(expected)) {
    const nav = await subMenu(menu, group);
    await expect(nav.getByRole("link")).toHaveCount(items.length);
    for (const label of items) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    if (group === "การให้บริการ") {
      for (const label of SOON) {
        await expect(nav.getByText(label)).toBeVisible();
        await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
      }
    }
    if (isMobile) await menu.getByRole("button", { name: "กลุ่มทั้งหมด" }).click();
  }
  return menu;
}

/** Menu → `group` → `item`. */
async function go(page: Page, isMobile: boolean, group: string, item: string) {
  const menu = await openMenu(page);
  await (await subMenu(menu, group)).getByRole("link", { name: item, exact: true }).click();
  await expect(menu).toBeHidden();
}

async function status(role: string, baseURL: string | undefined, method: string, url: string) {
  const api = await playwrightRequest.newContext({ baseURL, storageState: auth(role) });
  return (await api.fetch(`${API}${url}`, { method, data: method === "GET" || method === "DELETE" ? undefined : {} })).status();
}

test.describe("super_admin", () => {
  test.use({ storageState: auth("super_admin") });

  test("AC1: the navbar menu lists every group; อาคารและอุปกรณ์ opens with the navbar kept; Home is S29", async ({ page, isMobile }) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/");
    await expect(page.getByText("ภาพรวมวันนี้").first()).toBeVisible();

    await expectMenu(page, isMobile, FULL_MENU);
    await page.keyboard.press("Escape");
    await go(page, isMobile, "สถานที่และอุปกรณ์", "อาคารและอุปกรณ์");
    await expect(page).toHaveURL(/\/settings\/buildings$/, { timeout: 30_000 }); // first compile of /settings on `next dev`
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "เลือกห้องจากผัง" })).toBeVisible();
    // the app navbar stays on settings pages (CR-006); guardian mascot beside the heading (CR-003)
    await expect(page.getByRole("link", { name: "BAMBAM หน้าแรก" })).toBeVisible();
    await expect(page.getByRole("button", { name: /เมนูบัญชี/ })).toBeVisible();
    await expect(page.locator('main img[src*="superadmin-guardian"]')).toBeVisible();

    // the current page is checked in the menu
    const menu = await openMenu(page);
    await expect((await subMenu(menu, "สถานที่และอุปกรณ์")).getByRole("link", { name: "อาคารและอุปกรณ์" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    // a tab item opens S20 on that tab
    await go(page, isMobile, "สถานที่และอุปกรณ์", "ประเภทอาคาร");
    await expect(page).toHaveURL(/tab=building-types/);

    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
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

  test("AC1b (CR-006): Admin holds every settings key — every item, planner mascot", async ({ page, isMobile }) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/");
    await expectMenu(page, isMobile, FULL_MENU);
    await page.keyboard.press("Escape");
    await go(page, isMobile, "สถานที่และอุปกรณ์", "อาคารและอุปกรณ์");
    await expect(page).toHaveURL(/\/settings\/buildings$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
    await expect(page.locator('main img[src*="admin-planner"]')).toBeVisible();
  });

  test("AC1b (CR-006): the API answers #2–#12 reads", async ({ baseURL }) => {
    for (const [method, url] of IDENTITY_ROUTES.filter(([m]) => m === "GET")) {
      expect(await status("admin", baseURL, method, url), `${method} ${url}`).not.toBe(403);
    }
  });
});

test.describe("a Role with only อาคารและห้อง", () => {
  test("the menu shows only that group's pages; the others are Forbidden with a way back; the API refuses #2–#12", async ({ browser, baseURL, isMobile }) => {
    test.slow();
    const v = await viewerWith(browser, baseURL, ["settings.locations.manage"], test.info().project.use);
    try {
      const page = v.page;
      await page.goto("/");
      // ประเภทอุปกรณ์ needs settings.assets.manage too
      await expectMenu(page, isMobile, { สถานที่และอุปกรณ์: ["อาคารและอุปกรณ์", "ประเภทอาคาร"] });
      await page.keyboard.press("Escape");

      for (const p of PAGES) {
        await page.goto(p.path);
        await expect(page.getByRole("heading", { name: NO_ACCESS })).toBeVisible();
        await expect(page.getByText("ส่วนนี้กำลังพัฒนา")).toHaveCount(0);
      }
      await page.getByRole("link", { name: "ไปที่อาคารและอุปกรณ์" }).click();
      await expect(page).toHaveURL(/\/settings\/buildings$/);
      await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();

      for (const [method, url] of IDENTITY_ROUTES) {
        const res = await page.request.fetch(`${API}${url}`, { method, data: method === "GET" || method === "DELETE" ? undefined : {} });
        expect(res.status(), `${method} ${url}`).toBe(403);
      }
    } finally {
      await v.close();
    }
  });
});

for (const role of ["employee", "technician", "housekeeper_lead", "security_lead"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });

    test(`AC2: ${role} has no settings menu; /settings is a full-page Forbidden; the API refuses`, async ({ page, baseURL }) => {
      test.slow(); // first visits compile on `next dev`
      await page.goto("/");
      await expect(page.getByRole("link", { name: "BAMBAM หน้าแรก" })).toBeVisible();
      await expect(menuButton(page)).toHaveCount(0);

      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: NO_ACCESS })).toBeVisible();
      await expect(page.getByRole("link", { name: "กลับหน้าแรก" })).toBeVisible();
      await expect(menuButton(page)).toHaveCount(0);
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

test.describe("phone sheet", () => {
  test.use({ storageState: auth("super_admin") });

  test("AC2b: Escape closes the sheet and focus returns to the menu button; navigating closes it", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the sheet is the < 1024px layout");
    test.slow(); // first visits compile on `next dev`
    await page.goto("/settings/buildings");
    await expect(page.getByRole("heading", { level: 1, name: "อาคารและอุปกรณ์" })).toBeVisible();
    const sheet = await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(menuButton(page)).toBeFocused();

    await go(page, true, "การให้บริการ", "หมวดงานและอาการ");
    await expect(page).toHaveURL(/\/settings\/categories$/);
    await expect(page.getByRole("heading", { level: 1, name: "หมวดงานและอาการ" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
