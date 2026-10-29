import path from "node:path";
import { expect, test } from "@playwright/test";

// Stage 4R (CR-024): no executive role, no notifications — AC1 / AC2 / AC3 (S11 without a read-only mode).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);

test.describe("employee session", () => {
  test.use({ storageState: auth("employee") });

  test("AC1: role-switch to executive is 400, the switcher has no ผู้บริหาร", async ({ page, request }) => {
    const res = await request.post("/api/v1/dev/role-switch", { data: { role: "executive" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.fields.role).toBe("INVALID");

    await page.goto("/");
    await page.getByRole("button", { name: "เปลี่ยน" }).first().click();
    const picker = page.getByRole("radiogroup", { name: "เลือกบทบาท" });
    await expect(picker).toBeVisible();
    for (const name of ["พนักงานทั่วไป", "ช่าง", "Admin"]) await expect(picker).toContainText(name);
    await expect(picker).not.toContainText("ผู้บริหาร");
  });

  test("AC2: no bell and no แจ้งเตือน text; /notifications is 404", async ({ page }) => {
    for (const url of ["/", "/repair/my", "/repair/new"]) {
      await page.goto(url);
      await expect(page.getByRole("navigation").first()).toBeVisible();
      await expect(page.getByRole("link", { name: /แจ้งเตือน/ })).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("แจ้งเตือน");
    }
    const res = await page.goto("/notifications");
    expect(res?.status()).toBe(404);
  });
});

test.describe("admin session", () => {
  test.use({ storageState: auth("admin") });

  test("AC3: S11 shows the manage column for admin", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/repair/admin/queue");
    await expect(page.getByRole("heading", { name: "งานทั้งหมด" }).first()).toBeVisible();
    await expect(page.getByText("ดูได้อย่างเดียว")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "จัดการงาน" })).toBeAttached();
  });
});
