import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// F02 report form (CR-014, Stage 2M): 3 equal steps, the real category master, required room.
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

async function pickPlace(page: Page, room: string) {
  const s = step(page, "location");
  await s.getByText("อาคารฝั่ง Office", { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("5", { exact: true }).click();
  await s.getByText(room, { exact: true }).click();
}

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

test("AC3 + AC5 + demo 1: room required, matching rooms first, review, ticket shows the room", async ({ page }) => {
  await open(page);
  const p = step(page, "problem");
  await p.getByText("ห้องประชุมและโสตทัศนูปกรณ์", { exact: true }).click();
  await p.getByText("จอไม่แสดงผล/ไม่ติด").click();
  await next(page);

  const s = step(page, "location");
  await s.getByText("อาคารฝั่ง Office", { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText("5", { exact: true }).click();
  await next(page);
  await expect(s.getByText("เลือกห้องหรือจุดที่เกิด", { exact: true })).toBeVisible();
  await expect(s.getByText("ห้องที่ตรงกับปัญหา (ห้องประชุมและโสตทัศนูปกรณ์)")).toBeVisible();
  await s.getByText("ห้องประชุม 5B", { exact: true }).click();
  await s.getByLabel("บอกจุดเพิ่มเติม").fill("ฝั่งหน้าต่าง");
  await next(page);

  const review = step(page, "send").locator("dl");
  await expect(review).toContainText("ห้องประชุม 5B · ฝั่งหน้าต่าง");
  await review.getByRole("button", { name: "แก้ไขสถานที่" }).click();
  await expect(page.getByRole("button", { name: "2. สถานที่" })).toHaveAttribute("aria-current", "step");
  await next(page);

  await attachAndSend(page);
  await expect(page.getByText("อาคารฝั่ง Office ชั้น 5 · ห้องประชุม 5B · ฝั่งหน้าต่าง").first()).toBeVisible();
});

test("AC2: อื่น ๆ + ใช้งานไม่ได้ + typed ลิฟต์ → category อื่น ๆ · ลิฟต์, priority ปกติ", async ({ page }) => {
  await open(page);
  const p = step(page, "problem");
  await p.getByText("อื่น ๆ", { exact: true }).click();
  await p.getByText("ใช้งานไม่ได้").click();
  await p.getByLabel("ระบุหมวดงาน").fill("ลิฟต์");
  await expect(p.getByText("ปกติ")).toBeVisible();
  await next(page);
  await pickPlace(page, "พื้นที่ส่วนกลางชั้น 5");
  await next(page);
  await attachAndSend(page);
  await expect(page.getByText("ใช้งานไม่ได้ · อื่น ๆ · ลิฟต์").first()).toBeVisible();
});

test("AC4: the frame keeps its size on every step (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop frame only");
  await open(page);
  const frame = page.getByTestId("report-frame");
  const sizes: string[] = [];
  const size = async () => { const b = await frame.boundingBox(); sizes.push(`${Math.round(b!.width)}x${Math.round(b!.height)}`); };
  await size();
  await step(page, "problem").getByText("ระบบปรับอากาศ", { exact: true }).click();
  await step(page, "problem").getByText("แอร์ไม่เย็น").click();
  await next(page);
  await size();
  await pickPlace(page, "ห้องประชุม 5B");
  await next(page);
  await size();
  expect(new Set(sizes).size).toBe(1);
  expect(sizes[0]).toMatch(/^880x/);
});
