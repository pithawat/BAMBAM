import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// F02 report form (CR-014, Stage 2M; CR-022): 3 steps, each at its own height, the real category master, required room.
// Runs against the real API with the dev/UAT sample rooms (backend seed.go).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.use({ storageState: auth("employee") });

async function open(page: Page) {
  await page.goto("/repair/new");
  await expect(page.getByText("เลือกหมวดที่ตรงกับปัญหา").filter({ visible: true }).first()).toBeVisible();
  // A draft from an earlier run would be restored; start clean.
  const restart = page.getByRole("button", { name: "เริ่มใหม่" });
  if (await restart.isVisible()) await restart.click();
}

const step = (page: Page, key: string) => page.locator(`[data-step="${key}"]`);
const next = (page: Page) => page.getByRole("button", { name: "ถัดไป" }).click();

async function pickPlace(page: Page, room: string, spot?: string) {
  const s = step(page, "location");
  await s.getByText("อาคาร 1", { exact: true }).click();
  // room cards on every floor (CR-022)
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("4", { exact: true }).click();
  await s.getByText(room, { exact: true }).click();
  if (spot) await s.getByLabel("บอกจุดเพิ่มเติม").fill(spot);
}

/** A unique extra spot: reports of other runs / projects in the same room stay "similar", not duplicates (CR-020). */
const uniqueSpot = (info: TestInfo, base: string) => `${base} ${info.project.name}-${Date.now()}`;

async function attachAndSend(page: Page) {
  await step(page, "send").locator("input[type=file]").first().setInputFiles({ name: "problem.png", mimeType: "image/png", buffer: PNG });
  await expect(step(page, "send").getByText("ครบแล้ว")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
}

test("AC1: the 7 master categories, no อื่นๆ symptom rows; changing category clears symptoms", async ({ page }) => {
  await open(page);
  const s = step(page, "problem");
  const names = ["ไฟฟ้าและแสงสว่าง", "ระบบปรับอากาศ", "ประปาและสุขาภิบาล", "ห้องประชุมและโสตทัศนูปกรณ์", "อาคารและพื้นที่ส่วนกลาง", "ลานจอด / ไม้กั้น", "อื่น ๆ"];
  await expect(s.getByRole("radiogroup", { name: "เลือกหมวดที่ตรงกับปัญหา" }).locator("label")).toHaveText(names);
  await s.getByText("ระบบปรับอากาศ", { exact: true }).click();
  await expect(s.getByRole("group", { name: /อาการที่พบ/ }).locator("label")).toHaveText(["แอร์ไม่เย็น", "น้ำหยด/รั่วซึม", "มีเสียงดัง", "มีกลิ่น", "เปิดไม่ติด", "รีโมทเสีย", "อาการอื่นๆ"]);
  await s.getByText("น้ำหยด/รั่วซึม").click();
  await expect(s.getByText("ความเร่งด่วนของงานนี้:")).toBeVisible();
  await s.getByText("อื่น ๆ", { exact: true }).click();
  await expect(s.getByRole("checkbox", { checked: true })).toHaveCount(0);
});

test("AC3 + AC5 + demo 1: room required, matching rooms first, review, ticket shows the room", async ({ page }, info) => {
  const spot = uniqueSpot(info, "ฝั่งหน้าต่าง");
  await open(page);
  const p = step(page, "problem");
  await p.getByText("ห้องประชุมและโสตทัศนูปกรณ์", { exact: true }).click();
  await p.getByText("จอไม่แสดงผล/ไม่ติด").click();
  await next(page);

  const s = step(page, "location");
  await s.getByText("อาคาร 1", { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("4", { exact: true }).click();
  await next(page);
  await expect(s.getByText("เลือกห้องหรือจุดที่เกิด", { exact: true })).toBeVisible();
  await expect(s.getByText("ห้องที่ตรงกับปัญหา (ห้องประชุมและโสตทัศนูปกรณ์)")).toBeVisible();
  await s.getByText("อ.1 ห้อง 401", { exact: true }).click();
  await s.getByLabel("บอกจุดเพิ่มเติม").fill(spot);
  await next(page);

  const review = step(page, "send").locator("dl");
  await expect(review).toContainText(`อ.1 ห้อง 401 · ${spot}`);
  // CR-019: the review list shows on phones; desktop edits from the สรุปการแจ้งซ่อม column.
  await page.getByRole("button", { name: "แก้ไขสถานที่" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("navigation", { name: "ขั้นตอนแจ้งซ่อม" }).getByRole("button", { name: /สถานที่/ })).toHaveAttribute("aria-current", "step");
  await next(page);

  await attachAndSend(page);
  await expect(page.getByText(`อาคาร 1 ชั้น 4 · อ.1 ห้อง 401 · ${spot}`).first()).toBeVisible();
});

test("AC2: อื่น ๆ + ใช้งานไม่ได้ + typed ลิฟต์ → category อื่น ๆ · ลิฟต์, priority ปกติ", async ({ page }, info) => {
  await open(page);
  const p = step(page, "problem");
  await p.getByText("อื่น ๆ", { exact: true }).click();
  await p.getByText("ใช้งานไม่ได้").click();
  await p.getByLabel("ระบุหมวดงาน").fill("ลิฟต์");
  await expect(p.getByText("ปกติ", { exact: true })).toBeVisible();
  await next(page);
  await pickPlace(page, "พื้นที่ส่วนกลางชั้น 4", uniqueSpot(info, "หน้าลิฟต์"));
  await next(page);
  await attachAndSend(page);
  await expect(page.getByText("ใช้งานไม่ได้ · อื่น ๆ · ลิฟต์").first()).toBeVisible();
});

test("2R AC2: an unfinished report comes back after a reload with its photo; เริ่มใหม่ clears the draft", async ({ page }, info) => {
  const spot = uniqueSpot(info, "ร่างค้าง");
  await open(page);
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByText("แอร์ไม่เย็น", { exact: true }).click();
  await next(page);
  await pickPlace(page, "อ.1 ห้อง 401", spot);
  await next(page);
  await step(page, "send").locator("input[type=file]").first().setInputFiles({ name: "problem.png", mimeType: "image/png", buffer: PNG });
  await expect(step(page, "send").getByText("ครบแล้ว")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText(/กู้ข้อมูลที่กรอกค้างไว้เมื่อ .+ แล้ว/)).toBeVisible();
  await expect(step(page, "send").locator("dl")).toContainText(`อ.1 ห้อง 401 · ${spot}`);
  await expect(step(page, "send").getByText("ครบแล้ว")).toBeVisible();

  await page.getByRole("button", { name: "เริ่มใหม่" }).click();
  await expect(page.getByText("เลือกหมวดที่ตรงกับปัญหา").filter({ visible: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("เลือกหมวดที่ตรงกับปัญหา").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/กู้ข้อมูลที่กรอกค้างไว้/)).toHaveCount(0);
});

test("AC4 (CR-022): the frame keeps its width; room cards leave no reserved gap (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop frame only");
  await open(page);
  const frame = page.getByTestId("report-frame");
  const widths: number[] = [];
  const width = async () => widths.push(Math.round((await frame.boundingBox())!.width));
  await width();
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByText("แอร์ไม่เย็น").click();
  await next(page);
  await width();
  await pickPlace(page, "WPS ห้องกาแฟ");
  // Room cards on every floor (no picker).
  const s = step(page, "location");
  // The wrapper is as tall as the cards (no reserved min-height under them).
  const gap = await s.getByRole("radiogroup", { name: "ห้องหรือจุดที่เกิด" }).evaluate((el) => el.parentElement!.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom);
  expect(gap).toBeLessThan(30);
  await next(page);
  await width();
  expect(new Set(widths).size).toBe(1);
  // CR-019: the frame shares the row with the สรุปการแจ้งซ่อม column, so its width follows the shell.
});
