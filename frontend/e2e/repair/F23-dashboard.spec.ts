import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// F23 (Stage 3D, CR-016): S29 dashboard Home for admin (no executive, repair CR-024) — numbers equal S11, อาคาร 1 in
// 3D with floor drill-down, other roles keep the normal Home; phones get the floor list.
// Runs against the real API (migration 20261020000001: อาคาร 1, 6 floors with traced rooms).
// CR-027 (migration 20261029000002): S29 opens on the campus site view; อาคาร 2 (4 floors) opens like อาคาร 1.
// CR-030 (migration 20261029000003): อาคาร 3 / 4, TrialMix, โรงอาหาร, ห้องประชุม 60 ปี open the same way.
// CR-031 (migration 20261030000001): the nine Riverside buildings too (side 2).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/repair";
const SITE = "section[aria-label='ภาพรวมพื้นที่ แบบ 3 มิติ']";

type Stats = { mode: string; frames: number; calls: number; triangles: number; geometries: number; textures: number };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __s29Engine: { stats: () => Stats } }).__s29Engine.stats());

/** CR-031: Riverside buildings sit on side 2 of the site view. */
const RIVERSIDE = /Riverside|CCTC|Warehouse|โรงเรือน/;
const marker = (name: string) => new RegExp(`^${name.replace(/[()]/g, "\\$&")} งานค้าง`);
async function showSide(page: Page, name: string) {
  if (RIVERSIDE.test(name)) await page.locator(SITE).getByRole("group", { name: "เลือกฝั่ง" }).getByRole("button", { name: "ฝั่ง Riverside" }).click();
}

/** S29 → site view → the building's marker → its model. */
async function openBuilding(page: Page, name: string) {
  await page.goto("/");
  await expect(page.locator(SITE).locator("canvas")).toBeVisible({ timeout: 60_000 }); // lazy three.js chunk
  await showSide(page, name);
  // keyboard: neighbouring markers can overlap on the Riverside side (Riverside 2 / 3)
  await page.locator(SITE).getByRole("button", { name: marker(name) }).focus();
  await page.keyboard.press("Enter");
  const card = page.locator(`section[aria-label='${name} แบบ 3 มิติ']`);
  await expect(card.getByRole("group", { name: "เลือกชั้น" })).toBeVisible();
  return card;
}

// The 3D card needs WebGL: Chrome's new headless keeps it on the GPU (D-103). Only the 3D specs use it.
test.use({ channel: "chromium" });

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
    test.slow(); // WebGL + model build compete with the other workers
    const card = await openBuilding(page, "อาคาร 1");
    const picker = card.getByRole("group", { name: "เลือกชั้น" });
    await expect(picker.getByRole("button")).toHaveCount(6);

    await picker.getByRole("button", { name: /^ชั้น 1 / }).click();
    await expect(card.getByText(/ชั้น 1 · งานค้าง/)).toBeVisible();
    await expect(card).toContainText("Data and Digitization", { timeout: 15_000 }); // model load + lift + plan build
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
    test.slow(); // WebGL + model build compete with the other workers
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
    const { id, ticketNo } = (await created.json()).data as { id: string; ticketNo: string };

    const card = await openBuilding(page, "อาคาร 1");
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
    // Close it again so runs do not pile pins into this room (the F31 tour drags into it).
    expect((await api.post(`${API}/tickets/${id}/close`, { data: { reason: "ล้างข้อมูลทดสอบ" } })).status()).toBe(200);
  });

  test("CR-027 AC1: S29 opens on the site view — every map block, a marker with the open count on อาคาร 1 / 2", async ({ page, isMobile }) => {
    test.skip(isMobile, "3D is desktop only");
    test.slow(); // WebGL + model build compete with the other workers
    await page.goto("/");
    const site = page.locator(SITE);
    await expect(site.locator("canvas")).toBeVisible({ timeout: 60_000 });
    const overview = (await (await page.request.get(`${API}/admin/overview`)).json()).data;
    expect(overview.site).toHaveLength(16);
    // CR-028: one side at a time
    const side1 = overview.site.filter((b: { side: number }) => b.side === 1).length;
    await expect(site.getByText(new RegExp(`^ฝั่งสำนักงานใหญ่ · ${side1} อาคาร · งานค้าง`))).toBeVisible();
    // อาคาร 1 gets tickets from other specs running in parallel: its marker only has to show a count
    await expect(site.getByRole("button", { name: /^อาคาร 1 งานค้าง \d+/ })).toBeVisible();
    const b2 = overview.buildings.find((x: { name: string }) => x.name === "อาคาร 2");
    const open = b2.floors.reduce((n: number, f: { openCount: number }) => n + f.openCount, 0);
    await expect(site.getByRole("button", { name: new RegExp(`^อาคาร 2 งานค้าง ${open}(,|$)`) })).toBeVisible();
    // CR-030: every office-side block is a real building with a marker
    for (const b of overview.site.filter((x: { side: number }) => x.side === 1)) {
      await expect(site.getByRole("button", { name: new RegExp(`^${b.name} งานค้าง`) })).toBeVisible();
    }
    await expect(site.getByRole("group", { name: "เลือกชั้น" })).toHaveCount(0);
    await site.getByRole("group", { name: "เลือกฝั่ง" }).getByRole("button", { name: "ฝั่ง Riverside" }).click();
    await expect(site.getByText(new RegExp(`^ฝั่ง Riverside · ${overview.site.length - side1} อาคาร`))).toBeVisible();
    await expect(site.getByRole("button", { name: /^อาคาร 1 งานค้าง/ })).toHaveCount(0);
  });

  test("CR-027 AC2: อาคาร 2 → 4 floors → floor 2 plan with its rooms → back to the building and the site", async ({ page, isMobile }) => {
    test.skip(isMobile, "3D is desktop only");
    test.slow(); // WebGL + model build compete with the other workers
    const card = await openBuilding(page, "อาคาร 2");
    const picker = card.getByRole("group", { name: "เลือกชั้น" });
    await expect(picker.getByRole("button")).toHaveCount(4);
    await expect(card.getByText(/4 ชั้น · งานค้าง/)).toBeVisible();
    await picker.getByRole("button", { name: /^ชั้น 2 / }).click();
    await expect(card.getByText(/ชั้น 2 · งานค้าง/)).toBeVisible();
    await expect(card).toContainText("ทีม Marketing and Branding", { timeout: 15_000 }); // model load + lift + plan build
    await expect(card).toContainText("99 ตร.ม.");
    await expect(card).toContainText("พื้นที่ส่วนกลาง");
    await card.getByRole("button", { name: "ภาพอาคาร" }).click();
    await expect(card.getByText(/4 ชั้น · งานค้าง/)).toBeVisible();
    await card.getByRole("button", { name: "ภาพรวมพื้นที่" }).click();
    await expect(page.locator(SITE).getByRole("button", { name: /^อาคาร 2 งานค้าง/ })).toBeVisible();
  });

  for (const [name, floors, room] of [
    ["อาคาร 3", 1, "RMC Excellence โรงซ่อมอุปกรณ์"],
    ["อาคาร 4", 2, "อ.4 ห้อง 101"],
    ["อาคาร TrialMix และห้องทดสอบหินทราย", 1, "RMC METRO ห้องทดสอบหินทราย"],
    ["โรงอาหาร", 1, "พื้นที่ส่วนกลาง"],
    ["ห้องประชุม 60 ปี", 1, "ห้องละมาด"],
    // CR-031: the Riverside side
    ["อาคาร Riverside อเนกประสงค์", 1, "ห้อง Fitness"],
    ["อาคาร Riverside 1", 2, "น.SSB ชั้น 1"],
    ["อาคาร Riverside 2", 2, "น.SSB ห้องติดตั้ง"],
    ["อาคาร Riverside 3", 2, "น.SSB ชั้น 1"],
    ["อาคาร CCTC", 2, "น.I&T 2"],
    ["CPAC Warehouse 1 (3D print)", 1, "น.3D Printing"],
    ["CPAC Warehouse 2", 1, "บ.เท็กซ์พลอร์"],
    ["CPAC Warehouse 3", 1, "SCG Express"],
    ["อาคารโรงเรือน CPAC", 1, "โรงเรือนเพาะปลูก"],
  ] as const) {
    test(`CR-030 AC1: ${name} → ${floors} floor(s) → floor 1 plan with its rooms → back to the site`, async ({ page, isMobile }) => {
      test.skip(isMobile, "3D is desktop only");
      test.slow(); // WebGL + model build compete with the other workers
      const card = await openBuilding(page, name);
      const picker = card.getByRole("group", { name: "เลือกชั้น" });
      await expect(picker.getByRole("button")).toHaveCount(floors);
      await picker.getByRole("button", { name: /^ชั้น 1 / }).click();
      await expect(card.getByText(/ชั้น 1 · งานค้าง/)).toBeVisible();
      await expect(card).toContainText(room, { timeout: 15_000 }); // model load + lift + plan build
      await card.getByRole("button", { name: "ภาพอาคาร" }).click();
      await expect(card.getByText(new RegExp(`${floors} ชั้น · งานค้าง`))).toBeVisible();
      await card.getByRole("button", { name: "ภาพรวมพื้นที่" }).click();
      const side = RIVERSIDE.test(name) ? "ฝั่ง Riverside" : "ฝั่งสำนักงานใหญ่"; // back on the building's own side
      await expect(page.locator(SITE).getByText(new RegExp(`^${side} · \\d+ อาคาร`))).toBeVisible();
    });
  }

  test("CR-027 AC3 / CR-028: budget — a side ≤ 20k triangles, no frames while idle, GPU memory flat over 10 enter / leave cycles", async ({ page, isMobile }) => {
    test.skip(isMobile, "3D is desktop only");
    test.setTimeout(240_000); // 10 model cycles + both sides while the other workers use the GPU
    await page.goto("/");
    const site = page.locator(SITE);
    await expect(site.locator("canvas")).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await stats(page)).triangles, { timeout: 20_000 }).toBeGreaterThan(2_000); // real อาคาร 1 / 2 models
    await page.waitForTimeout(1500); // damping settles
    const s0 = await stats(page);
    expect(s0.mode).toBe("site");
    expect(s0.triangles).toBeLessThanOrEqual(20_000);
    expect(s0.calls).toBeLessThanOrEqual(60);
    await page.waitForTimeout(1500);
    expect((await stats(page)).frames).toBe(s0.frames); // render on demand: nothing is drawn while idle

    const counts: { geometries: number; textures: number }[] = [];
    for (let i = 0; i < 10; i++) {
      await site.getByRole("button", { name: i % 2 ? /^อาคาร 1 งานค้าง/ : /^อาคาร 2 งานค้าง/ }).click();
      const card = page.locator(`section[aria-label='${i % 2 ? "อาคาร 1" : "อาคาร 2"} แบบ 3 มิติ']`);
      await expect(card.getByRole("group", { name: "เลือกชั้น" })).toBeVisible();
      await expect(card.getByLabel("กำลังโหลดอาคาร")).toHaveCount(0, { timeout: 20_000 });
      await card.getByRole("button", { name: "ภาพรวมพื้นที่" }).click();
      await expect(site.getByRole("button", { name: /^อาคาร 1 งานค้าง/ })).toBeVisible();
      await page.waitForTimeout(400);
      const s = await stats(page);
      counts.push({ geometries: s.geometries, textures: s.textures });
    }
    console.log(`S29 budget: site ${s0.calls} draw calls, ${s0.triangles} triangles; after each cycle`, JSON.stringify(counts));
    // back on the site: the same site meshes every time (the hover outline may add one geometry) and never more
    // textures than at the start (the shared ones are re-uploaded only once they are drawn again)
    for (const c of counts) {
      expect(c.textures).toBeLessThanOrEqual(s0.textures);
      expect(Math.abs(c.geometries - counts[0].geometries)).toBeLessThanOrEqual(1);
    }

    // CR-031: the Riverside side with its nine light models keeps the same budget
    await site.getByRole("group", { name: "เลือกฝั่ง" }).getByRole("button", { name: "ฝั่ง Riverside" }).click();
    await expect(site.getByRole("button", { name: /^อาคาร CCTC งานค้าง/ })).toBeVisible();
    await expect.poll(async () => (await stats(page)).triangles, { timeout: 20_000 }).toBeGreaterThan(2_000);
    await page.waitForTimeout(1500);
    const s2 = await stats(page);
    console.log(`S29 budget side 2: ${s2.calls} draw calls, ${s2.triangles} triangles`);
    expect(s2.triangles).toBeLessThanOrEqual(20_000);
    expect(s2.calls).toBeLessThanOrEqual(60);
    await page.waitForTimeout(1500);
    expect((await stats(page)).frames).toBe(s2.frames);
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
