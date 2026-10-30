import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { API, as, attachVia, auth, countUploads, uploadPhoto } from "./helpers";

// F02 report form (CR-014, Stage 2M; CR-022; CR-025 place first + categories by building type, Stage 4P;
// CR-026 photos kept in the form until submit). Runs against the real API; อาคาร 1, the car park and the mock
// warehouse come from the migrations.

test.use({ storageState: auth("employee") });

const WAREHOUSE = "โกดังเก็บของ 1 (ตัวอย่าง)";
const OUTDOOR = "พื้นที่ภายนอกอาคาร";

async function open(page: Page) {
  await page.goto("/repair/new");
  // 16+ buildings to load while the 3D specs keep the GPU / dev server busy
  await expect(step(page, "location").getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible({ timeout: 15_000 });
  // A draft from an earlier run would be restored; start clean.
  const restart = page.getByRole("button", { name: "เริ่มใหม่" });
  if (await restart.isVisible()) await restart.click();
}

const step = (page: Page, key: string) => page.locator(`[data-step="${key}"]`);
const next = (page: Page) => page.getByRole("button", { name: "ถัดไป" }).click();
const categoryNames = (page: Page) => step(page, "problem").getByRole("radiogroup", { name: "เลือกหมวดที่ตรงกับปัญหา" }).locator("label");

/** Step 1: building, floor (the only floor when there is one) and room, then the optional extra spot. */
async function pickPlace(page: Page, building: string, floor: string | null, room: string, spot?: string) {
  const s = step(page, "location");
  await s.getByText(building, { exact: true }).click();
  if (floor) await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText(floor, { exact: true }).click();
  else await s.getByRole("radiogroup", { name: "เลือกชั้น" }).locator("label").first().click();
  await s.getByRole("radiogroup", { name: /ห้องหรือจุดที่เกิด/ }).getByText(room, { exact: true }).click();
  if (spot) await s.getByLabel("บอกจุดเพิ่มเติม").fill(spot);
}

/** A unique extra spot: reports of other runs / projects in the same room stay "similar", not duplicates (CR-020). */
const uniqueSpot = (info: TestInfo, base: string) => `${base} ${info.project.name}-${Date.now()}`;

async function attachAndSend(page: Page) {
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
}

test("AC1 (CR-025): opens on สถานที่; a room is required; step 2 names the place", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("navigation", { name: "ขั้นตอนแจ้งซ่อม" }).getByRole("button", { name: /สถานที่/ })).toHaveAttribute("aria-current", "step");
  const s = step(page, "location");
  await s.getByText("อาคาร 1", { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("4", { exact: true }).click();
  await next(page);
  await expect(s.getByText("เลือกห้องหรือจุดที่เกิด", { exact: true })).toBeVisible();
  // CR-025: plain room list, no "rooms matching the problem" group
  await expect(s.getByText(/ห้องที่ตรงกับปัญหา/)).toHaveCount(0);
  await s.getByText("อ.1 ห้อง 401", { exact: true }).click();
  await next(page);
  await expect(step(page, "problem").getByTestId("place-line")).toContainText("สถานที่: อาคาร 1 · ชั้น 4 · อ.1 ห้อง 401");
  await step(page, "problem").getByRole("button", { name: "เปลี่ยนสถานที่" }).click();
  await expect(step(page, "location")).toBeVisible();
});

test("AC2 (CR-025): categories follow the building type; no อื่นๆ symptom rows; changing category clears symptoms", async ({ page }) => {
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401");
  await next(page);
  await expect(categoryNames(page)).toHaveText(["ไฟฟ้าและแสงสว่าง", "ระบบปรับอากาศ", "ประปาและสุขาภิบาล", "ห้องประชุมและโสตทัศนูปกรณ์", "อาคารและพื้นที่ส่วนกลาง", "อื่น ๆ"]);
  const p = step(page, "problem");
  await p.getByText("ระบบปรับอากาศ", { exact: true }).click();
  await expect(p.getByRole("group", { name: /อาการที่พบ/ }).locator("label")).toHaveText(["แอร์ไม่เย็น", "น้ำหยด/รั่วซึม", "มีเสียงดัง", "มีกลิ่น", "เปิดไม่ติด", "รีโมทเสีย", "อาการอื่นๆ"]);
  await p.getByRole("group", { name: /อาการที่พบ/ }).getByText("น้ำหยด/รั่วซึม", { exact: true }).click();
  await expect(p.getByText("ความเร่งด่วนของงานนี้:")).toBeVisible();
  await p.getByText("อื่น ๆ", { exact: true }).click();
  await expect(p.getByRole("checkbox", { checked: true })).toHaveCount(0);

  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await pickPlace(page, WAREHOUSE, null, "พื้นที่เก็บสินค้า");
  await next(page);
  await expect(categoryNames(page)).toHaveText(["ไฟฟ้าและแสงสว่าง", "ประปาและสุขาภิบาล", "อาคารและพื้นที่ส่วนกลาง", "อื่น ๆ"]);

  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await pickPlace(page, OUTDOOR, null, "ลานจอดรถ");
  await next(page);
  await expect(categoryNames(page)).toHaveText(["ไฟฟ้าและแสงสว่าง", "ประปาและสุขาภิบาล", "ลานจอด / ไม้กั้น", "อื่น ๆ"]);
});

test("AC3 (CR-025): another building type clears the category with a note; the API refuses ระบบปรับอากาศ in the warehouse", async ({ page, baseURL }) => {
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401");
  await next(page);
  const p = step(page, "problem");
  await p.getByText("ระบบปรับอากาศ", { exact: true }).click();
  await p.getByRole("group", { name: /อาการที่พบ/ }).getByText("แอร์ไม่เย็น", { exact: true }).click();
  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  // same type: the category stays
  await step(page, "location").getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("5", { exact: true }).click();
  await step(page, "location").getByText("RMC Network 1", { exact: true }).click();
  await next(page);
  await expect(p.getByRole("radio", { name: /ระบบปรับอากาศ/ })).toBeChecked();
  await page.getByRole("button", { name: "ย้อนกลับ" }).click();
  await pickPlace(page, WAREHOUSE, null, "พื้นที่เก็บสินค้า");
  await next(page);
  await expect(p.getByText("หมวดงานที่เลือกไว้ไม่มีในอาคารประเภทนี้ เลือกใหม่อีกครั้ง")).toBeVisible();
  await expect(p.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(p.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await p.getByText("ไฟฟ้าและแสงสว่าง", { exact: true }).click();
  await expect(p.getByText("หมวดงานที่เลือกไว้ไม่มีในอาคารประเภทนี้")).toHaveCount(0);

  const api = await as("employee", baseURL);
  const categories: { id: string; name: string; symptoms: { id: string }[] }[] = (await (await api.get(`${API}/categories`)).json()).data;
  const buildings: { id: string; name: string; floors: { id: string; rooms: { id: string; name: string }[] }[] }[] = (await (await api.get(`${API}/buildings`)).json()).data;
  const aircon = categories.find((c) => c.name === "ระบบปรับอากาศ")!;
  const wh = buildings.find((b) => b.name === WAREHOUSE)!;
  const res = await api.post(`${API}/tickets`, { data: {
    categoryId: aircon.id, symptomIds: [aircon.symptoms[0].id], buildingId: wh.id, floorId: wh.floors[0].id, roomId: wh.floors[0].rooms[0].id,
    photoIds: [await uploadPhoto(api)], teamHandled: null,
  } });
  expect(res.status()).toBe(422);
  expect((await res.json()).error.code).toBe("CATEGORY_NOT_FOR_BUILDING");
});

test("AC5 + demo 1: review in step order, ticket shows the room", async ({ page }, info) => {
  const spot = uniqueSpot(info, "ฝั่งหน้าต่าง");
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401", spot);
  await next(page);
  const p = step(page, "problem");
  await p.getByText("ห้องประชุมและโสตทัศนูปกรณ์", { exact: true }).click();
  await p.getByRole("group", { name: /อาการที่พบ/ }).getByText("จอไม่แสดงผล/ไม่ติด", { exact: true }).click();
  await next(page);

  const review = step(page, "send").locator("dl");
  await expect(review).toContainText(`อ.1 ห้อง 401 · ${spot}`);
  // CR-019: the review list shows on phones; desktop edits from the สรุปการแจ้งซ่อม column.
  await page.getByRole("button", { name: "แก้ไขสถานที่" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("navigation", { name: "ขั้นตอนแจ้งซ่อม" }).getByRole("button", { name: /สถานที่/ })).toHaveAttribute("aria-current", "step");
  await next(page);
  await next(page);

  await attachAndSend(page);
  await expect(page.getByText(`อาคาร 1 ชั้น 4 · อ.1 ห้อง 401 · ${spot}`).first()).toBeVisible();
});

test("AC2 (CR-014): อื่น ๆ + ใช้งานไม่ได้ + typed ลิฟต์ → category อื่น ๆ · ลิฟต์, priority ปกติ", async ({ page }, info) => {
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "พื้นที่ส่วนกลางชั้น 4", uniqueSpot(info, "หน้าลิฟต์"));
  await next(page);
  const p = step(page, "problem");
  await p.getByText("อื่น ๆ", { exact: true }).click();
  await p.getByRole("group", { name: /อาการที่พบ/ }).getByText("ใช้งานไม่ได้", { exact: true }).click();
  await p.getByLabel("ระบุหมวดงาน").fill("ลิฟต์");
  await expect(p.getByText("ปกติ", { exact: true })).toBeVisible();
  await next(page);
  await attachAndSend(page);
  await expect(page.getByText("ใช้งานไม่ได้ · อื่น ๆ · ลิฟต์").first()).toBeVisible();
});

test("AC7 (CR-026 A1): picking sends nothing; a failed upload keeps form + photos; the retry sends", async ({ page }, info) => {
  const uploads = countUploads(page);
  const spot = uniqueSpot(info, "ส่งรูปตอนกดส่ง");
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401", spot);
  await next(page);
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText("แอร์ไม่เย็น", { exact: true }).click();
  await next(page);
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  expect(uploads.n).toBe(0);

  let fail = true;
  await page.route(`**${API}/photos`, (route) => (fail ? (fail = false, route.abort()) : route.continue()));
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  await expect(page.getByText("ส่งไม่สำเร็จ", { exact: true })).toBeVisible();
  await expect(step(page, "send").locator('[data-photo-status="failed"]')).toHaveCount(1);
  await expect(step(page, "send").locator("dl")).toContainText(`อ.1 ห้อง 401 · ${spot}`);
  await expect(page).toHaveURL(/\/repair\/new$/);

  const created = page.waitForResponse((r) => r.url().endsWith(`${API}/tickets`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  expect((await created).status()).toBe(201);
  await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
  expect(uploads.n).toBe(3); // the aborted one + both photos; nothing re-sent twice
});

test("AC6 (CR-026): a 4000×3000 photo goes up as a 1920px JPEG at quality 0.25", async ({ page }, info) => {
  test.slow(); // drawing + encoding a 4000×3000 image in the page takes a while
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401", uniqueSpot(info, "รูปใหญ่"));
  await next(page);
  await step(page, "problem").getByText("ไฟฟ้าและแสงสว่าง", { exact: true }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText("ไฟไม่ติด/ไฟกะพริบ", { exact: true }).click();
  await next(page);
  // A detailed 4000×3000 photo, and what 0.85 (the old quality) would have sent at 1920px.
  const { big, at85 } = await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 4000; c.height = 3000;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 6000; i++) { g.fillStyle = `hsl(${i * 37 % 360} 70% ${30 + i % 50}%)`; g.fillRect((i * 97) % 4000, (i * 53) % 3000, 40 + i % 90, 30 + i % 70); }
    const blob = (q: number, w: number, h: number) => { const o = document.createElement("canvas"); o.width = w; o.height = h; o.getContext("2d")!.drawImage(c, 0, 0, w, h); return new Promise<Blob>((r) => o.toBlob((b) => r(b!), "image/jpeg", q)); };
    const src = await blob(0.95, 4000, 3000);
    return { big: Array.from(new Uint8Array(await src.arrayBuffer())), at85: (await blob(0.85, 1920, 1440)).size };
  });
  await step(page, "send").locator("input[type=file]").first().setInputFiles({ name: "IMG_4000.jpg", mimeType: "image/jpeg", buffer: Buffer.from(big) });
  await expect(step(page, "send").locator('[data-photo-status="ready"]')).toHaveCount(1, { timeout: 15_000 });
  const uploaded = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`${API}/photos`));
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  const photo = (await (await uploaded).json()).data as { url: string };
  await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 45_000 });
  // the stored original = what the browser sent (the server keeps it as is)
  const stored = await page.evaluate(async (url) => {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    return { size: blob.size, width: bmp.width, type: blob.type };
  }, photo.url);
  expect(stored.width).toBe(1920);
  expect(stored.size).toBeLessThan(at85 * 0.6);
});

test("2R AC2 + CR-026 A1: an unfinished report comes back after a reload with its photo (IndexedDB); เริ่มใหม่ clears it", async ({ page }, info) => {
  const uploads = countUploads(page);
  const spot = uniqueSpot(info, "ร่างค้าง");
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401", spot);
  await next(page);
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText("แอร์ไม่เย็น", { exact: true }).click();
  await next(page);
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  await expect(step(page, "send").getByText("ครบแล้ว")).toBeVisible();
  await page.waitForTimeout(300); // the IndexedDB write is async

  await page.reload();
  await expect(page.getByText(/กู้ข้อมูลที่กรอกค้างไว้เมื่อ .+ แล้ว/)).toBeVisible();
  await expect(step(page, "send").locator("dl")).toContainText(`อ.1 ห้อง 401 · ${spot}`);
  await expect(step(page, "send").locator('[data-photo-status="ready"]')).toHaveCount(1);
  await expect(step(page, "send").getByText("ครบแล้ว")).toBeVisible();
  expect(uploads.n).toBe(0);

  await page.getByRole("button", { name: "เริ่มใหม่" }).click();
  await expect(step(page, "location").getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible();
  await page.reload();
  await expect(step(page, "location").getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible();
  await expect(page.getByText(/กู้ข้อมูลที่กรอกค้างไว้/)).toHaveCount(0);
});

test("CR-026 A1: draft photos older than 24 h are gone; the banner asks to attach again", async ({ page }, info) => {
  await open(page);
  await pickPlace(page, "อาคาร 1", "4", "อ.1 ห้อง 401", uniqueSpot(info, "ร่างเก่า"));
  await next(page);
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText("แอร์ไม่เย็น", { exact: true }).click();
  await next(page);
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  await page.waitForTimeout(300);
  // Age the stored entry by 25 h.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("bambam.drafts", 1);
    req.onsuccess = () => {
      const tx = req.result.transaction("photos", "readwrite");
      const store = tx.objectStore("photos");
      store.openCursor().onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) { cursor.update({ ...cursor.value, savedAt: Date.now() - 25 * 3600_000 }); cursor.continue(); }
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await expect(page.getByText("รูปที่เลือกไว้กู้คืนไม่ได้ แนบรูปอีกครั้ง")).toBeVisible();
  await expect(step(page, "send").locator("[data-photo-status]")).toHaveCount(0);
  await page.getByRole("button", { name: "เริ่มใหม่" }).click();
});

test("AC4 (CR-022): the frame keeps its width; room cards leave no reserved gap (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop frame only");
  await open(page);
  const frame = page.getByTestId("report-frame");
  const widths: number[] = [];
  const width = async () => widths.push(Math.round((await frame.boundingBox())!.width));
  await width();
  await pickPlace(page, "อาคาร 1", "4", "WPS ห้องกาแฟ");
  // The wrapper is as tall as the cards (no reserved min-height under them).
  const gap = await step(page, "location").getByRole("radiogroup", { name: "ห้องหรือจุดที่เกิด" }).evaluate((el) => el.parentElement!.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom);
  expect(gap).toBeLessThan(30);
  await next(page);
  await width();
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText("แอร์ไม่เย็น", { exact: true }).click();
  await next(page);
  await width();
  expect(new Set(widths).size).toBe(1);
  // CR-019: the frame shares the row with the สรุปการแจ้งซ่อม column, so its width follows the shell.
});

