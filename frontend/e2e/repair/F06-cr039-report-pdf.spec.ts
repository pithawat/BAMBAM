import { expect, test } from "@playwright/test";
import { API, as, auth, report, tag } from "./helpers";

// CR-039 (D-144): S07 "บันทึก PDF" prints the report template (logo · รายงานการดำเนินงาน · ticket no · QR to this
// ticket's S07 page, ข้อมูลทั่วไป + one table per step) instead of the screen; the reporter's report has no
// priority. The QR deep link sends a signed-out phone to S01 and back to the ticket. Real API.

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("CR-039: บันทึก PDF prints the report with a QR to this ticket; no priority for the reporter", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await report(await as("employee", baseURL), tag(info));
    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(page.getByRole("button", { name: "บันทึก PDF" })).toBeVisible();

    const sheet = page.getByTestId("ticket-report");
    await expect(sheet).toBeHidden(); // screen only shows the page
    await page.emulateMedia({ media: "print" });
    await expect(sheet).toBeVisible();
    await expect(page.locator("article[aria-labelledby=ticket-title]")).toBeHidden();
    await expect(sheet.getByRole("heading", { name: "รายงานการดำเนินงาน" })).toBeVisible();
    await expect(sheet).toContainText(`หมายเลขรายการ: ${ticket.ticketNo}`);
    for (const h of ["ข้อมูลทั่วไป", "แจ้งซ่อม", "รับเรื่อง"]) await expect(sheet.getByRole("heading", { name: h, exact: true })).toBeVisible();
    await expect(sheet.locator("svg[data-qr]")).toHaveAttribute("data-qr", `${new URL(baseURL!).origin}/repair/tickets/${ticket.id}`);
    await expect(sheet).not.toContainText("ความเร่งด่วน");

    expect((await (await as("admin", baseURL)).post(`${API}/tickets/${ticket.id}/close`, { data: { reason: "ล้างข้อมูลทดสอบ" } })).status()).toBe(200);
  });
});

test.describe("signed out", () => {
  test("CR-039: the QR link asks a signed-out visitor to log in and returns to the ticket", async ({ page }) => {
    const id = "0b9c6a1e-0000-4000-8000-000000000001";
    await page.goto(`/repair/tickets/${id}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/repair/tickets/${id}`)}`));
  });
});
