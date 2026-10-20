import path from "node:path";
import { expect, request as playwrightRequest, test } from "@playwright/test";

// F23 (Stage 3D, CR-016): S29 dashboard Home for admin / executive — numbers equal S11, อาคาร 1 in 3D with
// floor drill-down, executive read-only, other roles keep the normal Home; phones get the floor list.
// Runs against the real API (migration 20261020000001: อาคาร 1, 6 floors with traced rooms).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/repair";
const CARD = "section[aria-label='อาคาร 1 แบบ 3 มิติ']";

test.describe("admin", () => {
  test.use({ storageState: auth("admin") });

  test("AC1: the key numbers match S11", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /^สวัสดีตอน.+ คุณ/ })).toBeVisible();
    const overview = (await (await page.request.get(`${API}/admin/overview`)).json()).data;
    const s11 = (await (await page.request.get(`${API}/tickets/counts?scope=all`)).json()).data;
    expect(overview.counts.awaitingAssessment).toBe(s11.awaitingAssessment);
    expect(overview.counts.inRepair).toBe(s11.inRepair);
    expect(overview.counts.awaitingRating).toBe(s11.resolved);
    expect(overview.counts.open).toBe(s11.inProgress + s11.resolved);

    const tile = (label: string) => page.getByRole("link").filter({ hasText: label });
    await expect(tile("งานค้างทั้งหมด")).toContainText(String(overview.counts.open));
    await expect(tile("แจ้งซ่อมวันนี้")).toContainText(String(overview.counts.reportedToday));
    const repair = page.getByRole("region", { name: "แจ้งซ่อม" });
    await expect(repair.getByRole("link").filter({ hasText: "รับเรื่อง" })).toContainText(String(overview.counts.awaitingAssessment));
    // CR-017: no sample numbers — car / room services only say they are not open yet
    await expect(page.getByRole("region", { name: "บริการอื่น" })).toContainText("ยังไม่เปิดใช้งาน");
    await expect(page.getByText("ข้อมูลตัวอย่าง")).toHaveCount(0);

    await repair.getByRole("link").filter({ hasText: "รับเรื่อง" }).click();
    await expect(page).toHaveURL(/\/repair\/admin\/queue\?tab=assess/, { timeout: 60_000 }); // dev compiles the route on first visit
  });

  test("AC2: อาคาร 1 shows 6 floors, a floor opens its plan with rooms, back to the building", async ({ page, isMobile }) => {
    test.skip(isMobile, "3D is desktop only");
    await page.goto("/");
    const card = page.locator(CARD);
    await expect(card.locator("canvas")).toBeVisible({ timeout: 60_000 }); // lazy three.js chunk
    const picker = card.getByRole("group", { name: "เลือกชั้น" });
    await expect(picker.getByRole("button")).toHaveCount(6);

    await picker.getByRole("button", { name: /^ชั้น 1 / }).click();
    await expect(card.getByText(/ชั้น 1 · งานค้าง/)).toBeVisible();
    await expect(card).toContainText("Data and Digitization");
    await expect(card).toContainText("237.80 ตร.ม.");

    await picker.getByRole("button", { name: /^ชั้น 5 / }).focus();
    await page.keyboard.press("ArrowUp"); // ↑ = floor 6
    await expect(card.getByText(/ชั้น 6 · งานค้าง/)).toBeVisible();
    await expect(card).toContainText("Strategic Planning");

    await card.getByRole("button", { name: "ภาพอาคาร" }).click();
    await expect(card.getByText(/6 ชั้น · งานค้าง/)).toBeVisible();
  });

  test("CR-017: floor badges show open tickets per step from #27; a floor shows one pin per open ticket from #6", async ({ page, isMobile }) => {
    test.skip(isMobile, "3D is desktop only");
    // a fresh ticket in อาคาร 1 so at least one floor has an open ticket
    const api = page.request;
    const categories = (await (await api.get(`${API}/categories`)).json()).data;
    const buildings = (await (await api.get(`${API}/buildings`)).json()).data;
    const b1 = buildings.find((b: { name: string }) => b.name === "อาคาร 1");
    const floor = b1.floors.find((f: { level: number }) => f.level === 3);
    const room = floor.rooms.find((r: { areaType: string }) => r.areaType === "office");
    const photo = await api.post(`${API}/photos`, { multipart: { file: { name: "p.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") } } });
    const cat = categories.find((c: { symptoms: unknown[] }) => c.symptoms.length > 2);
    const created = await api.post(`${API}/tickets`, { data: {
      categoryId: cat.id, symptomIds: [cat.symptoms[Date.now() % cat.symptoms.length].id], buildingId: b1.id, floorId: floor.id, roomId: room.id,
      locationDetail: `e2e ${Date.now()}`, photoIds: [(await photo.json()).data.id], teamHandled: null } });
    expect(created.status()).toBe(201);
    const ticketNo: string = (await created.json()).data.ticketNo;

    await page.goto("/");
    const card = page.locator(CARD);
    await expect(card.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const overview = (await (await api.get(`${API}/admin/overview`)).json()).data;
    const f3 = overview.buildings.find((b: { name: string }) => b.name === "อาคาร 1").floors.find((f: { level: number }) => f.level === 3);
    expect(f3.steps.awaitingAssessment + f3.steps.inRepair + f3.steps.awaitingRating).toBe(f3.openCount);
    const badge = card.getByRole("button", { name: /^ชั้น 3 งานค้าง \d+:/ });
    await expect(badge).toHaveAccessibleName(new RegExp(`งานค้าง ${f3.openCount}:.*รับเรื่อง ${f3.steps.awaitingAssessment}`));

    await badge.click();
    await expect(card.getByText(/ชั้น 3 · งานค้าง/)).toBeVisible();
    const pins = card.getByRole("button", { name: /^RP-/ });
    await expect(pins).toHaveCount(f3.openCount, { timeout: 15_000 });
    await card.getByRole("button", { name: new RegExp(`^${ticketNo} `) }).click();
    const pop = page.locator("[data-slot=popover-content]");
    await expect(pop).toContainText("รับเรื่อง");
    await expect(pop).toContainText(room.name);
    await pop.getByRole("link", { name: "ดูรายละเอียดงาน" }).click();
    await expect(page).toHaveURL(/\/repair\/tickets\//, { timeout: 60_000 }); // dev compiles the route on first visit
  });

  test("AC6: phone shows the floor list, no 3D and no horizontal scroll", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/");
    const list = page.getByRole("region", { name: /อาคาร 1 · งานค้างตามชั้น/ });
    await expect(list).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(list.getByText("จัดวางอุปกรณ์ได้บนคอมพิวเตอร์")).toBeVisible();
    await list.getByRole("button", { name: /^ชั้น 1 / }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("Data and Digitization");
    await expect(sheet).toContainText("พื้นที่ส่วนกลางชั้น 1");
    await sheet.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("executive", () => {
  test.use({ storageState: auth("executive") });

  test("AC5: same dashboard without edit controls; writes are 403", async ({ page, baseURL, isMobile }) => {
    await page.goto("/");
    await expect(page.getByText("ภาพรวมวันนี้").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "จัดวางอุปกรณ์" })).toHaveCount(0);
    if (!isMobile) {
      await page.locator(CARD).getByRole("group", { name: "เลือกชั้น" }).getByRole("button", { name: /^ชั้น 1 / }).click();
      await expect(page.locator(CARD)).toContainText("HR 3");
      await expect(page.getByRole("button", { name: "เพิ่มอุปกรณ์" })).toHaveCount(0);
    }
    const api = await playwrightRequest.newContext({ baseURL, storageState: auth("executive") });
    const types = (await (await api.get(`${API}/asset-types`)).json()).data;
    expect(types.map((t: { key: string }) => t.key)).toEqual(["aircon", "microphone", "speaker", "tv"]);
    const res = await api.post(`${API}/assets`, { data: { assetTypeId: types[0].id, code: "EXEC-NO", name: "x", roomId: "c016e001-0000-4000-8000-000000000001" } });
    expect(res.status()).toBe(403);
  });
});

for (const role of ["employee", "technician"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });

    test(`AC5: ${role} keeps the normal Home; #27 is 403`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /^สวัสดี คุณ/ }).first()).toBeVisible();
      await expect(page.getByText("ภาพรวมวันนี้")).toHaveCount(0);
      expect((await page.request.get(`${API}/admin/overview`)).status()).toBe(403);
    });
  });
}
