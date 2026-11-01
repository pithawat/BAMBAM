import { expect, test } from "@playwright/test";
import { apiAs, browserAs, createRole, SETTINGS_API, setRoleKeys, unique } from "./sessions";

// Settings Stage R1 AC5 (CR-006): S29 shows the floor list and no 3D without `repair.building3d.view`; the API leaves
// the models out (#27). Real API, on a Role this file creates.

const OVERVIEW = "repair.overview.view";
const BUILDING_3D = "repair.building3d.view";
const VIEW_ALL = "repair.ticket.view_all";

// WebGL on (Chrome's new headless, D-103), so a missing 3D card is the permission, not the browser
test.use({ channel: "chromium" });

test.describe("AC5: S29 without 3D", () => {
  test.skip(({ isMobile }) => isMobile, "3D is desktop only");
  test("a role with ดูภาพรวมอาคาร but not ดูโมเดล 3D อาคาร gets the floor list and no 3D; #27 has no models", async ({ browser, baseURL }) => {
    test.slow();
    const superApi = await apiAs(baseURL, "super_admin");
    const role = await createRole(superApi, unique("E2E ไม่มี 3D"));
    try {
      await setRoleKeys(superApi, role.id, [OVERVIEW, VIEW_ALL]);
      const ctx = await browserAs(browser, baseURL, role.key);
      const page = await ctx.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /งานค้างตามชั้น$/ })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /^ชั้น 1 งานค้าง/ })).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.getByText("อาคารนี้ยังไม่มีโมเดล 3 มิติ")).toHaveCount(0);

      const overview = (await (await page.request.get("/api/v1/repair/admin/overview")).json()).data;
      expect(overview.site).toEqual([]);
      for (const b of overview.buildings) expect(b.hasModel).toBe(false);

      // ticking 3D (needs overview, which the role has) brings the model back on the next request
      await setRoleKeys(superApi, role.id, [OVERVIEW, VIEW_ALL, BUILDING_3D]);
      await page.reload();
      await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
      await ctx.close();
    } finally {
      await superApi.delete(`${SETTINGS_API}/roles/${role.id}`);
    }
  });
});
