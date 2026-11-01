import path from "node:path";
import { expect, request as playwrightRequest, test } from "@playwright/test";

// Settings Stage 6 (BR-ALL-1, CR-001, CR-006): every role × every settings page and a read of each page's API with
// the seed defaults. Admin and Superadmin reach every page (CR-006: Admin holds every settings key); every other role
// is refused everywhere — the page shows Forbidden and never any data. A Role with only some keys: F25-settings-entry.
// Real API.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);

const PAGES = [
  { path: "/settings/buildings", api: "/api/v1/settings/buildings" },
  { path: "/settings/categories", api: "/api/v1/settings/categories" },
  { path: "/settings/contractor-types", api: "/api/v1/settings/contractor-types" },
  { path: "/settings/users", api: "/api/v1/settings/users" },
  { path: "/settings/roles", api: "/api/v1/settings/permissions" },
  { path: "/settings/audit", api: "/api/v1/settings/audit" },
];
const ROLES = ["employee", "housekeeper_lead", "security_lead", "technician", "admin", "super_admin"] as const;
const allowed = (role: string) => role === "super_admin" || role === "admin";

test.describe("API", () => {
  test.skip(({ isMobile }) => isMobile, "API checks run once");
  for (const role of ROLES) {
    test(`${role}: each settings read answers by permission`, async ({ baseURL }) => {
      const api = await playwrightRequest.newContext({ baseURL, storageState: auth(role) });
      for (const p of PAGES) {
        const status = (await api.get(p.api)).status();
        expect(status, `${role} ${p.api}`).toBe(allowed(role) ? 200 : 403);
      }
      await api.dispose();
    });
  }
});

test.describe("pages", () => {
  test.skip(({ isMobile }) => isMobile, "the drawer variant is covered by F25-settings-entry");
  for (const role of ["technician", "admin"] as const) {
    test(`${role}: every settings page shows its content or the Forbidden state`, async ({ browser, baseURL }) => {
      test.slow(); // first visits compile on `next dev`
      const ctx = await browser.newContext({ storageState: auth(role), baseURL });
      const page = await ctx.newPage();
      for (const p of PAGES) {
        await page.goto(p.path);
        const forbidden = page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
        if (allowed(role)) {
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(forbidden).toHaveCount(0);
        } else {
          await expect(forbidden).toBeVisible();
          // never partial data: no tables, matrices or lists of the page
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByRole("checkbox")).toHaveCount(0);
        }
      }
      await ctx.close();
    });
  }
});
