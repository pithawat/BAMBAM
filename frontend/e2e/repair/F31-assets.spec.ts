import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// F31 (Stage 3D, CR-016): admin places equipment on the อาคาร 1 floor plans — add by form, drag-add from
// the palette, drop outside a room refused, move with undo, duplicate code, deactivate (code stays taken).
// Desktop only (editing is desktop only). Codes get a random suffix so runs never collide.
// CR-027: S29 opens on the site view; a building opens from its marker (อาคาร 2 has its own case).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/repair";
const CARD = "section[aria-label='อาคาร 1 แบบ 3 มิติ']";
const SITE = "section[aria-label='ภาพรวมพื้นที่ แบบ 3 มิติ']";
const FLOOR = (level: number, building = 1) => `${building === 2 ? "c027f200" : "c016f100"}-0000-4000-8000-00000000000${level}`;

// The 3D card needs WebGL: Chrome's new headless keeps it on the GPU (D-103). Only the 3D specs use it.
test.use({ channel: "chromium" });

test.use({ storageState: auth("admin") });
test.skip(({ isMobile }) => isMobile, "equipment editing is desktop only");

async function openFloor(page: Page, level: number, building = "อาคาร 1") {
  const card = page.locator(`section[aria-label='${building} แบบ 3 มิติ']`);
  await page.goto("/");
  await page.getByRole("button", { name: "จัดวางอุปกรณ์" }).click();
  await expect(page.locator(SITE).locator("canvas")).toBeVisible({ timeout: 60_000 }); // lazy three.js chunk
  await page.locator(SITE).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.locator(SITE).getByRole("button", { name: new RegExp(`^${building} งานค้าง`) }).click();
  await card.getByRole("group", { name: "เลือกชั้น" }).getByRole("button", { name: new RegExp(`^ชั้น ${level} `) }).click();
  await expect(card.getByText(new RegExp(`ชั้น ${level} · งานค้าง`))).toBeVisible();
  await expect(page.getByRole("button", { name: "เพิ่มอุปกรณ์" })).toBeVisible({ timeout: 15_000 }); // #30 + model build under load
}

/** Screen centre of a room label on the plan (labels are aria-hidden, so read the DOM). */
async function roomPoint(page: Page, name: string, card = CARD) {
  return page.evaluate(([sel, room]) => {
    const el = [...document.querySelectorAll(`${sel} div`)].find((d) => d.firstChild?.nodeValue === room)!;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height + 14 };
  }, [card, name] as const);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

async function assetOnFloor(page: Page, level: number, code: string, building = 1) {
  const plan = (await (await page.request.get(`${API}/floors/${FLOOR(level, building)}/plan`)).json()).data;
  return plan.assets.find((a: { code: string }) => a.code === code) as { id: string; room: { name: string }; x: number | null } | undefined;
}

async function pick(page: Page, dialog: ReturnType<Page["getByRole"]>, label: string, option: string) {
  await dialog.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("AC3 + AC4: add by form, duplicate code refused, deactivate keeps the code taken", async ({ page }) => {
  test.slow(); // WebGL + model build compete with the other workers
  const code = `E2E-${Date.now().toString(36).toUpperCase()}`;
  await openFloor(page, 2);
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "เลือกประเภท" })).toBeVisible();
  await pick(page, dialog, "ประเภท", "เครื่องปรับอากาศ");
  await expect(dialog.getByLabel(/รหัสอุปกรณ์/)).toHaveValue(/^AC-2-\d{3}$/); // #34 suggestion
  await dialog.getByLabel(/รหัสอุปกรณ์/).fill("AC 2");
  await dialog.getByLabel(/ชื่ออุปกรณ์/).fill("แอร์ Call center ทดสอบ");
  await pick(page, dialog, "ห้อง", "Call center 1");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(dialog.getByText("ใช้ได้เฉพาะตัวอักษร ตัวเลข - และ _")).toBeVisible();
  await dialog.getByLabel(/รหัสอุปกรณ์/).fill(code);
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText(`เพิ่ม ${code} แล้ว`)).toBeVisible();
  const added = await assetOnFloor(page, 2, code);
  expect(added?.room.name).toBe("Call center 1");
  await expect(page.locator(CARD).getByRole("button", { name: new RegExp(code) })).toBeVisible();

  // duplicate (any case)
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์" }).click();
  await pick(page, dialog, "ประเภท", "จอทีวี");
  await dialog.getByLabel(/รหัสอุปกรณ์/).fill(code.toLowerCase());
  await dialog.getByLabel(/ชื่ออุปกรณ์/).fill("ซ้ำ");
  await pick(page, dialog, "ห้อง", "Call center 2");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(dialog.getByText("รหัสนี้มีอุปกรณ์อื่นใช้แล้ว")).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();

  // deactivate
  await page.locator(CARD).getByRole("button", { name: new RegExp(code) }).click();
  await page.getByRole("button", { name: "ปิดใช้งาน" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(`ปิดใช้งาน ${code}?`);
  await confirm.getByRole("button", { name: "ปิดใช้งาน" }).click();
  await expect(page.getByText(`ปิดใช้งาน ${code} แล้ว`)).toBeVisible();
  await expect(page.locator(CARD).getByRole("button", { name: new RegExp(code) })).toHaveCount(0);
  expect(await assetOnFloor(page, 2, code)).toBeUndefined();
  const types = (await (await page.request.get(`${API}/asset-types`)).json()).data;
  const reuse = await page.request.post(`${API}/assets`, { data: { assetTypeId: types[0].id, code, name: "x", roomId: "c016e002-0000-4000-8000-000000000001" } });
  expect(reuse.status()).toBe(409);
});

test("AC3 + AC4: drag a type into a room, drop outside refused, drag to move with undo", async ({ page }) => {
  test.slow(); // many pointer moves, each re-renders the plan
  const code = `E2E-D${Date.now().toString(36).toUpperCase()}`;
  await openFloor(page, 3);
  const palette = await page.getByRole("button", { name: "เพิ่มลำโพง" }).boundingBox();
  const from = { x: palette!.x + palette!.width / 2, y: palette!.y + palette!.height / 2 };

  // outside every room
  const card = (await page.locator(CARD).boundingBox())!;
  await drag(page, from, { x: card.x + card.width - 40, y: card.y + 110 }); // top-right corner, off the plan
  await expect(page.getByText("วางในห้องเท่านั้น").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // into WPS ห้องพี่มีด
  await drag(page, from, await roomPoint(page, "WPS ห้องพี่มีด"));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("ลำโพง")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "ห้อง" })).toContainText("WPS ห้องพี่มีด");
  await expect(dialog.getByLabel(/รหัสอุปกรณ์/)).toHaveValue(/^SPK-3-\d{3}$/);
  await dialog.getByLabel(/รหัสอุปกรณ์/).fill(code);
  await dialog.getByLabel(/ชื่ออุปกรณ์/).fill("ลำโพงห้องพี่มีด");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText(`เพิ่ม ${code} แล้ว`)).toBeVisible();
  const placed = await assetOnFloor(page, 3, code);
  expect(placed?.room.name).toBe("WPS ห้องพี่มีด");
  expect(placed?.x).not.toBeNull();

  // move to another room, then undo
  const chip = (await page.locator(CARD).getByRole("button", { name: new RegExp(code) }).boundingBox())!;
  await drag(page, { x: chip.x + chip.width / 2, y: chip.y + chip.height / 2 }, await roomPoint(page, "RMC METRO - ท่าหลวง 1"));
  await expect(page.getByText(`ย้าย ${code} ไปRMC METRO - ท่าหลวง 1แล้ว`)).toBeVisible();
  await expect.poll(async () => (await assetOnFloor(page, 3, code))?.room.name).toBe("RMC METRO - ท่าหลวง 1");
  await page.locator("[data-sonner-toast] button", { hasText: "เลิกทำ" }).first().dispatchEvent("click"); // the toast may sit under others
  await expect.poll(async () => (await assetOnFloor(page, 3, code))?.room.name).toBe("WPS ห้องพี่มีด");
  // Deactivate it so runs do not stack chips in this room (the F31 tour drags its own chip from here).
  expect((await page.request.post(`${API}/assets/${(await assetOnFloor(page, 3, code))!.id}/deactivate`)).status()).toBe(204);
});

test("CR-027: อาคาร 2 — drag a type into a traced room of floor 2, the asset is stored in that room", async ({ page }) => {
  test.slow();
  const B2 = "section[aria-label='อาคาร 2 แบบ 3 มิติ']";
  const code = `E2E-B${Date.now().toString(36).toUpperCase()}`;
  await openFloor(page, 2, "อาคาร 2");
  await expect(page.locator(B2)).toContainText("ทีม Marketing and Branding", { timeout: 15_000 }); // model load + plan build
  const palette = (await page.getByRole("button", { name: "เพิ่มเครื่องปรับอากาศ" }).boundingBox())!;
  await drag(page, { x: palette.x + palette.width / 2, y: palette.y + palette.height / 2 }, await roomPoint(page, "พื้นที่ทำงาน ชั้น 2", B2));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "ห้อง" })).toContainText("พื้นที่ทำงาน ชั้น 2");
  await dialog.getByLabel(/รหัสอุปกรณ์/).fill(code);
  await dialog.getByLabel(/ชื่ออุปกรณ์/).fill("แอร์พื้นที่ทำงาน ชั้น 2");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText(`เพิ่ม ${code} แล้ว`)).toBeVisible();
  const placed = await assetOnFloor(page, 2, code, 2);
  expect(placed?.room.name).toBe("พื้นที่ทำงาน ชั้น 2");
  expect(placed?.x).not.toBeNull();
  await expect(page.locator(B2).getByRole("button", { name: new RegExp(code) })).toBeVisible();
  expect((await page.request.post(`${API}/assets/${placed!.id}/deactivate`)).status()).toBe(204);
});
