import { expect, test } from "@playwright/test";
import { API, as, auth } from "./helpers";

// CR-034 (Stage 5P) on F06: tracking follows `repair.ticket.report`. The technician (no report by default) has no
// ติดตามงานซ่อม, `/repair/my` shows the forbidden state and #35 answers 403; the employee keeps it. Real API.

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC7: no ติดตามงานซ่อม, /repair/my forbidden, #35 403", async ({ page, baseURL }) => {
    test.slow(); // first visits compile on `next dev`
    const technician = await as("technician", baseURL);
    const res = await technician.get(`${API}/tickets/mine`);
    expect([res.status(), (await res.json()).error.code]).toEqual([403, "FORBIDDEN"]);

    await page.goto("/repair/work");
    const nav = page.getByRole("navigation", { name: "เมนูงานซ่อม" });
    await expect(nav.getByRole("link", { name: "งานซ่อม" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "ติดตามงานซ่อม" })).toHaveCount(0);

    await page.goto("/repair/my");
    await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์ดูหน้านี้" })).toBeVisible();
  });
});

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("AC7: the employee still tracks own tickets", async ({ page, baseURL }) => {
    const employee = await as("employee", baseURL);
    expect((await employee.get(`${API}/tickets/mine`)).status()).toBe(200);
    await page.goto("/repair/my");
    await expect(page.getByRole("heading", { name: "ติดตามงานซ่อม", level: 1 })).toBeVisible();
  });
});
