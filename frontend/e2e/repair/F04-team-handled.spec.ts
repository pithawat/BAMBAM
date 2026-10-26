import { expect, test } from "@playwright/test";
import { API, as, attachPhoto, auth, fillPlace, postTicket, tag, uploadVia } from "./helpers";

// F04 (Stage 4, CR-021): team leads record a job the team already fixed — closed at once, never reaches the
// technician (BR-F04-1/2/3). The team form opens only from S06 บันทึกงานที่ทีมแก้แล้ว (?mode=team, no switch). Real API.

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("AC3: no team entry for the employee (?mode=team = normal form); the API rejects teamHandled with 403", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/repair/my");
    await expect(page.getByRole("button", { name: "ทีมแก้เอง" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "บันทึกงานที่ทีมแก้แล้ว" })).toHaveCount(0);
    await fillPlace(page, tag(info), "/repair/new?mode=team");
    await expect(page.getByRole("heading", { name: "แจ้งซ่อมใหม่", level: 1 })).toBeVisible();
    await expect(page.getByText("ต้องการเปลี่ยนประเภทงาน?")).toHaveCount(0);
    const res = await postTicket(await as("employee", baseURL), tag(info), { note: "เช็ดแล้ว" });
    expect([res.status(), (await res.json()).error.code]).toEqual([403, "TEAM_HANDLED_NOT_ALLOWED"]);
  });
});

test.describe("housekeeper lead", () => {
  test.use({ storageState: auth("housekeeper_lead") });

  test("AC3 + AC4 + AC6: S06 บันทึกงานที่ทีมแก้แล้ว → locked team form → closed at once → ทีมแก้เอง tab", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/repair/my");
    await page.getByRole("link", { name: "บันทึกงานที่ทีมแก้แล้ว" }).click();
    await expect(page).toHaveURL(/\/repair\/new\?mode=team$/);
    await expect(page.getByRole("heading", { name: "บันทึกงานที่ทีมแก้แล้ว", level: 1 })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "ประเภทการแจ้ง" })).toHaveCount(0);
    await expect(page.getByText("ต้องการเปลี่ยนประเภทงาน? ปิดฟอร์มนี้แล้วเริ่มใหม่ ข้อมูลที่กรอกจะไม่ถูกบันทึก")).toBeVisible();
    await fillPlace(page, tag(info), "/repair/new?mode=team");
    await attachPhoto(page);

    await page.getByRole("button", { name: "ยืนยันบันทึกงานทีม" }).click();
    await expect(page.getByText("กรุณาบอกสิ่งที่ทีมทำ").first()).toBeVisible();
    await expect(page.getByText("แนบรูปหลังทำอย่างน้อย 1 รูป").first()).toBeVisible();

    await page.getByLabel("สิ่งที่ทีมทำ").fill("เช็ดพื้นและวางป้ายระวังลื่นแล้ว");
    await uploadVia(page, page.locator('[data-field="teamHandled.photoIds"] input[type=file]'));
    await page.getByRole("button", { name: "ยืนยันบันทึกงานทีม" }).click();
    await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "บันทึกงานทีมเรียบร้อย" })).toBeVisible();

    const id = new URL(page.url()).searchParams.get("id")!;
    const detail = (await (await as("housekeeper_lead", baseURL)).get(`${API}/tickets/${id}`)).json();
    const d = (await detail).data;
    expect(d).toMatchObject({ status: "closed", closedReason: "team_handled", step: "closed" });
    expect(d.timeline[0]).toMatchObject({ type: "team_handled", note: "เช็ดพื้นและวางป้ายระวังลื่นแล้ว" });
    expect(d.timeline[0].photos).toHaveLength(1);
    expect(d.allowedActions).toContain("handover");

    // AC4: never in the technician's open lists.
    const technician = await as("technician", baseURL);
    const open = (await (await technician.get(`${API}/tickets?scope=all&status=in_progress,resolved&q=${d.ticketNo}`)).json()).data;
    expect(open).toHaveLength(0);

    // CR-021: the lead finds it under ทีมแก้เอง (#35 relation=reported + closedReason=team_handled).
    await page.goto(`/repair/my?scope=team&q=${d.ticketNo}`);
    await expect(page.getByRole("button", { name: "ทีมแก้เอง", pressed: true })).toBeVisible();
    await expect(page.getByText(`${d.ticketNo}`).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("· ทีมแก้เอง ·").filter({ visible: true }).first()).toBeVisible();
  });
});
