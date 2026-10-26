import { expect, test, type Page } from "@playwright/test";
import { API, as, auth, confirm, newContractor, report, resolvedTicket, tag } from "./helpers";

// F06 (Stage 1 / 2N / 3U, CR-011 / CR-019): S06 lists the tickets I reported or follow — relation tabs, search,
// status, 10 per page, all in the URL — with my tickets awaiting my rating first (BR-F06-2); S07 shows the
// progress with who and when (BR-F06-3) and a contractor job only by its type (BR-F06-4); a follower reads it
// without actions, anyone else is refused (BR-F06-1). Real API.

const visible = (page: Page, name: string | RegExp) => page.getByRole("link", { name }).filter({ visible: true });
const progress = (page: Page) => page.getByRole("region", { name: "ความคืบหน้าของงาน" });

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("AC4: tabs, status, search and pages live in the URL; a ticket opened from the list returns with them", async ({ page, baseURL }, info) => {
    test.slow(); // 11 reports + first visits compile on `next dev`
    const employee = await as("employee", baseURL);
    const batch = tag(info, "จุดชุด");
    const tickets = [];
    for (let i = 0; i < 11; i++) tickets.push(await report(employee, `${batch} ${String.fromCharCode(65 + i)}`));

    await page.goto("/repair/my");
    await page.getByLabel("ค้นหาเลขงาน หรือสถานที่").fill(batch);
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.getByText("แสดง 1–10 จาก 11 งาน")).toBeVisible();
    await page.getByRole("button", { name: "หน้า 2" }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByText("แสดง 11–11 จาก 11 งาน")).toBeVisible();
    // default order = updated last first, so the first report is alone on page 2
    await expect(visible(page, `ดูงาน ${tickets[0].ticketNo}`)).toHaveCount(1);

    // Status filter goes back to page 1
    await page.getByRole("combobox", { name: "กรองสถานะ: ทุกสถานะ" }).click();
    await page.getByRole("option", { name: "ปิดงานแล้ว" }).click();
    await expect(page).toHaveURL(/[?&]status=closed/);
    await expect(page).not.toHaveURL(/[?&]page=/);
    await expect(page.getByText(`ไม่พบงานที่ตรงกับ "${batch}"`)).toBeVisible();
    await page.getByRole("combobox", { name: "กรองสถานะ: ปิดงานแล้ว" }).click();
    await page.getByRole("option", { name: "รับเรื่องแล้ว" }).click();
    await expect(page.getByText("แสดง 1–10 จาก 11 งาน")).toBeVisible();

    // Relation tabs
    await page.getByRole("group", { name: "งานที่แสดง" }).getByRole("button", { name: "ที่ฉันติดตาม" }).click();
    await expect(page).toHaveURL(/[?&]scope=following/);
    await expect(page.getByText(`ไม่พบงานที่ตรงกับ "${batch}"`)).toBeVisible();
    await page.getByRole("group", { name: "งานที่แสดง" }).getByRole("button", { name: "ที่ฉันแจ้ง" }).click();
    await expect(page.getByText("แสดง 1–10 จาก 11 งาน")).toBeVisible();

    // Open one and come back: the filters are kept
    const kept = new URL(page.url()).search;
    await visible(page, `ดูงาน ${tickets[10].ticketNo}`).click();
    await expect(page).toHaveURL(new RegExp(`/repair/tickets/${tickets[10].id}`), { timeout: 30_000 });
    await expect(page.getByText(tickets[10].ticketNo).first()).toBeVisible();
    await page.getByRole("link", { name: /^กลับไป/ }).click();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(`/repair/my${kept}`);
    await expect(page.getByText("แสดง 1–10 จาก 11 งาน")).toBeVisible();

    const admin = await as("admin", baseURL);
    for (const t of tickets) expect((await admin.post(`${API}/tickets/${t.id}/close`, { data: { reason: "ล้างข้อมูลทดสอบ" } })).status()).toBe(200);
  });

  test("BR-F06-2 / 3 / 4: my ticket awaiting my rating comes first; a contractor job shows its type only; the progress shows who and when", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const technician = await as("technician", baseURL);
    const contractor = await newContractor(technician, tag(info, "ร้านแอร์ลับ"));
    const ticket = await resolvedTicket(baseURL, tag(info), contractor.id);
    const staff = (await (await technician.get(`${API}/tickets/${ticket.id}`)).json()).data;

    await page.goto("/repair/my");
    await expect(visible(page, /^(ตรวจงาน|ดูงาน) /).first()).toHaveAccessibleName(`ตรวจงาน ${ticket.ticketNo}`);
    await visible(page, `ตรวจงาน ${ticket.ticketNo}`).click();
    await expect(page).toHaveURL(new RegExp(`/repair/tickets/${ticket.id}`), { timeout: 30_000 });

    await page.getByRole("tab", { name: "ข้อมูลแจ้งซ่อม" }).click();
    await expect(page.getByText("ช่างภายนอก · แอร์").first()).toBeVisible();
    await expect(page.getByText(contractor.name)).toHaveCount(0);
    await expect(page.getByText("คะแนนช่างภายนอก")).toHaveCount(0);
    await expect(page.getByText("ความเร่งด่วน")).toHaveCount(0);

    const stages = progress(page).getByRole("listitem");
    await expect(stages).toHaveCount(5);
    await expect(stages.nth(0)).toContainText("แจ้งงาน");
    await expect(stages.nth(1)).toContainText("รับเรื่อง");
    await expect(stages.nth(2)).toContainText("กำลังดำเนินการ");
    await expect(stages.nth(2)).toContainText(`${staff.technician.name}`);
    await expect(stages.nth(2)).toContainText("ช่างภายนอก");
    await expect(stages.nth(3)).toContainText("เสร็จ");
    await expect(stages.nth(4)).toContainText("รอคุณประเมินตรวจงาน");
    await progress(page).getByRole("button", { name: "ดูประวัติทั้งหมด" }).click();
    const history = page.getByRole("dialog", { name: "ประวัติทั้งหมด" });
    await expect(history).toContainText("เริ่มดำเนินการ");
    await expect(history).toContainText(staff.technician.name);
    await expect(history).not.toContainText(contractor.name);
    await history.getByRole("button", { name: "ปิดประวัติ" }).click();
    await confirm(await as("employee", baseURL), ticket.id);
  });
});

test.describe("follower", () => {
  test.use({ storageState: auth("security_lead") });

  test("BR-F06-1: a follower reads the progress without actions; the ticket sits under ที่ฉันติดตาม", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await resolvedTicket(baseURL, tag(info));
    const follow = await (await as("security_lead", baseURL)).post(`${API}/tickets/${ticket.id}/follow`, { data: { note: "ห้องนี้แอร์มีน้ำหยดเหมือนกัน", photoIds: [] } });
    expect(follow.status()).toBe(200);

    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(page.getByRole("region", { name: "สิ่งที่เกิดขึ้นตอนนี้" })).toContainText("คุณติดตามงานนี้ เราจะแจ้งเตือนเมื่อมีความคืบหน้า");
    await expect(page.getByRole("group", { name: "เลือกคะแนนเพื่อเปิดแบบประเมิน" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ประเมินตรวจงาน|ส่งกลับให้แก้/ })).toHaveCount(0);
    await expect(progress(page).getByRole("listitem").first()).toContainText("คุณติดตามงานนี้");

    await page.goto(`/repair/my?scope=following&q=${ticket.ticketNo}`);
    await expect(visible(page, `ดูงาน ${ticket.ticketNo}`)).toHaveCount(1);
    await confirm(await as("employee", baseURL), ticket.id);
  });
});

test.describe("someone else", () => {
  test.use({ storageState: auth("housekeeper_lead") });

  test("BR-F06-1: a lead who neither reported nor follows gets the forbidden state; the API says 403", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await report(await as("employee", baseURL), tag(info));
    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(page.getByText("งานนี้ไม่ได้อยู่ในรายการที่คุณแจ้ง ติดตาม หรือรับผิดชอบ")).toBeVisible();
    expect((await (await as("housekeeper_lead", baseURL)).get(`${API}/tickets/${ticket.id}`)).status()).toBe(403);
    expect((await (await as("admin", baseURL)).post(`${API}/tickets/${ticket.id}/close`, { data: { reason: "ล้างข้อมูลทดสอบ" } })).status()).toBe(200);
  });
});
