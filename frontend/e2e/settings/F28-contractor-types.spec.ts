import path from "node:path";
import { expect, test } from "@playwright/test";
import { psql } from "./people";
import { viewerWith } from "./sessions";

// F28 (settings Stage 5, S23, CR-001): Superadmin adds / renames / deactivates contractor types; a deactivated type
// leaves the technician's picker and typing its name there re-activates it (audit row by the technician).
// A Role without `settings.contractor_types.manage` has no ประเภทผู้รับเหมา (CR-006: seeded Admin has it). Real API;
// rows this spec creates are removed afterwards.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

test.describe("super_admin", () => {
  test.use({ storageState: auth("super_admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC3: counts and badges; deactivate → gone from the technician picker; the technician's name re-activates it", async ({ page, browser, baseURL }) => {
    test.slow();
    const name = `แอร์ทดสอบ ${Date.now().toString(36).slice(-5)}`;
    try {
      await page.goto("/settings/contractor-types");
      await expect(page.getByRole("heading", { name: "ประเภทผู้รับเหมา", level: 1 })).toBeVisible();
      await page.getByRole("button", { name: "เพิ่มประเภท" }).click();
      const dialog = page.getByRole("dialog", { name: "เพิ่มประเภท" });
      await dialog.getByLabel("ชื่อประเภท").fill(name);
      await dialog.getByRole("button", { name: "เพิ่มประเภท" }).click();
      await expect(page.getByText("เพิ่มประเภทแล้ว")).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toContainText("ยังไม่มีผู้รับเหมา");

      // case-insensitive duplicate
      await page.getByRole("button", { name: "เพิ่มประเภท" }).click();
      await dialog.getByLabel("ชื่อประเภท").fill(` ${name} `);
      await dialog.getByRole("button", { name: "เพิ่มประเภท" }).click();
      await expect(dialog.getByText("ชื่อนี้มีอยู่แล้ว")).toBeVisible();
      await dialog.getByRole("button", { name: "ยกเลิก" }).click();

      // deactivate
      await row.getByRole("button", { name: `ตัวเลือกของ ${name}` }).click();
      await page.getByRole("menuitem", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByRole("alertdialog").getByText("ช่างเลือกประเภทนี้ให้ผู้รับเหมาใหม่ไม่ได้")).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByText(`ปิดใช้งาน "${name}" แล้ว`)).toBeVisible();
      await expect(row).toHaveCount(0);

      const tech = await browser.newContext({ storageState: auth("technician"), baseURL });
      const picker = async () => ((await (await tech.request.get("/api/v1/repair/contractor-types")).json()).data as { name: string }[]).map((t) => t.name);
      expect(await picker()).not.toContain(name);
      // the technician types the name in the assess sheet → the same type comes back active
      const created = await tech.request.post("/api/v1/repair/contractor-types", { data: { name } });
      expect([200, 201]).toContain(created.status());
      expect(await picker()).toContain(name);
      await tech.close();

      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
      const audit = (await (await page.request.get(`${API}/audit?type=master&q=${encodeURIComponent(name)}`)).json()).data as { action: string; actor: { name: string } | null }[];
      expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["create", "deactivate", "activate"]));

      // unused → can be deleted
      await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: `ตัวเลือกของ ${name}` }).click();
      await page.getByRole("menuitem", { name: /^ลบ/ }).click();
      await page.getByRole("alertdialog", { name: `ลบ "${name}"?` }).getByRole("button", { name: "ลบ" }).click();
      await expect(page.getByText(`ลบ "${name}" แล้ว`)).toBeVisible();
    } finally {
      psql(`DELETE FROM repair.contractor_types WHERE name = '${name}';`);
    }
  });
});

test("AC5: without the contractor-types key: no ประเภทผู้รับเหมา item, Forbidden, the API refuses", async ({ browser, baseURL, isMobile }) => {
  test.skip(isMobile, "runs once (desktop)");
  const v = await viewerWith(browser, baseURL, ["settings.categories.manage"]);
  try {
    const page = v.page;
    await page.goto("/settings/contractor-types");
    await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
    await page.getByRole("button", { name: "ตั้งค่าระบบ" }).filter({ visible: true }).click();
    const menu = page.getByRole("dialog", { name: "การตั้งค่าระบบ" });
    await menu.getByRole("button", { name: /^การให้บริการ/ }).click();
    await expect(menu.getByRole("link", { name: "หมวดงานและอาการ" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "ประเภทผู้รับเหมา" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect((await page.request.get(`${API}/contractor-types`)).status()).toBe(403);
    // still manages categories (AC5 part 1)
    expect((await page.request.get(`${API}/categories`)).status()).toBe(200);
  } finally {
    await v.close();
  }
});
