import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API, as, attachVia, auth, expectCategory, PLACE, placeIds } from "./helpers";

// F13-B (Stage 5, CR-036): a printed QR holds `{origin}/q/{code}` → S03 prefilled from #25. Logged out it goes
// through login first (real SSO cannot be automated: the redirect keeps `next`). The asset is created per run in
// PLACE (อาคาร 1 ชั้น 4) as a เครื่องปรับอากาศ (type → ระบบปรับอากาศ) and deactivated afterwards. In-app scan on
// phones (mobile project): the camera is Chrome's fake device and the decoder a stubbed BarcodeDetector.

// Chrome's fake camera (a test pattern) for the phone cases; launch options are per worker, so file-wide.
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

const AIRCON = "c016a700-0000-4000-8000-000000000001"; // platform.asset_types 'aircon' (migration CR-016)
const NAME = "แอร์ทดสอบ QR";
let code = "";
let assetId = "";

test.beforeAll(async ({ baseURL }, info) => {
  const admin = await as("admin", baseURL);
  const ids = await placeIds(admin);
  code = `E2E-QR${info.project.name[0].toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
  const res = await admin.post(`${API}/assets`, { data: { assetTypeId: AIRCON, code, name: NAME, roomId: ids.roomId } });
  expect(res.status(), await res.text()).toBe(201);
  assetId = (await res.json()).data.id;
  await admin.dispose();
});

test.afterAll(async ({ baseURL }) => {
  if (!assetId) return;
  const admin = await as("admin", baseURL);
  await admin.post(`${API}/assets/${assetId}/deactivate`);
  await admin.dispose();
});

const banner = (page: Page) => page.getByTestId("qr-banner");
const step = (page: Page, key: string) => page.locator(`[data-step="${key}"]`);

/** Prefilled S03: symptom, a spot of its own (no duplicate block), next, photo, send → the new ticket id. */
async function finishReport(page: Page, spot: string) {
  // an open AC case in this room from another spec can block: the extra spot makes this one different (CR-020)
  await step(page, "problem").getByRole("button", { name: "เปลี่ยน" }).click();
  await step(page, "location").getByLabel("บอกจุดเพิ่มเติม").fill(spot);
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await step(page, "problem").getByRole("group", { name: /อาการที่พบ/ }).getByText(PLACE.symptom, { exact: true }).click();
  await expect(page.getByRole("button", { name: "ถัดไป" })).not.toHaveAttribute("aria-disabled", "true", { timeout: 15_000 });
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await attachVia(page, step(page, "send").locator("input[type=file]").first());
  await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
  await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
  return new URL(page.url()).searchParams.get("id")!;
}

async function ticketAsset(api: APIRequestContext, id: string) {
  return (await (await api.get(`${API}/tickets/${id}`)).json()).data.asset as { code: string; name: string } | null;
}

test.describe("logged out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AC1: /q/{code} logged out → login keeps the label as next", async ({ page }) => {
    await page.goto(`/q/${code}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fq%2F${code}$`));
  });
});

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("AC1 + AC4: /q/{code} (any case) → prefilled on ปัญหาที่พบ; the ticket carries the asset, S07 shows it", async ({ page, baseURL }, info) => {
    await page.goto(`/q/${code.toLowerCase()}`);
    await expect(page).toHaveURL(new RegExp(`/repair/new\\?asset=${code.toLowerCase()}$`));
    await expect(banner(page)).toContainText("เติมข้อมูลจาก QR แล้ว");
    await expect(banner(page)).toContainText(`${NAME} · ${code}`);
    await expect(step(page, "problem").getByRole("heading", { name: "ปัญหาที่พบ" })).toBeVisible();
    await expect(step(page, "problem").getByText(new RegExp(`${PLACE.building} · ชั้น ${PLACE.floor} · ${PLACE.room}`))).toBeVisible();
    await expectCategory(page, PLACE.category);

    const id = await finishReport(page, `QR ${info.project.name} ${Date.now()}`);
    const api = await as("employee", baseURL);
    expect(await ticketAsset(api, id)).toMatchObject({ code, name: NAME });
    await api.dispose();
    await page.goto(`/repair/tickets/${id}`);
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 15_000 });
  });

  test("AC4: ไม่ใช่อุปกรณ์นี้ keeps the values, drops the asset from the URL and the ticket", async ({ page, baseURL }, info) => {
    await page.goto(`/repair/new?asset=${code}`);
    await expect(banner(page)).toContainText(code);
    await banner(page).getByRole("button", { name: "ไม่ใช่อุปกรณ์นี้" }).click();
    await expect(banner(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/repair\/new$/);
    await expectCategory(page, PLACE.category);
    const id = await finishReport(page, `QR no ${info.project.name} ${Date.now()}`);
    const api = await as("employee", baseURL);
    expect(await ticketAsset(api, id)).toBeNull();
    await api.dispose();
  });

  test("AC2: an unknown code → ไม่พบอุปกรณ์นี้ and an empty form on สถานที่", async ({ page }) => {
    await page.goto("/repair/new?asset=XX-NOPE-99");
    await expect(banner(page)).toContainText("ไม่พบอุปกรณ์นี้");
    await expect(banner(page)).toContainText("กรอกข้อมูลเองได้เลย");
    await expect(step(page, "location").getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible();
  });
});

test.describe("desktop", () => {
  test.use({ storageState: auth("employee") });
  test.skip(({ isMobile }) => isMobile, "desktop has no in-app camera");

  test("AC5: no สแกน QR on S06 / Home; /repair/scan is the manual card (empty / not found / found)", async ({ page }) => {
    await page.goto("/repair/my");
    await expect(page.getByRole("link", { name: "แจ้งซ่อมใหม่" })).toBeVisible();
    await expect(page.getByRole("link", { name: "สแกน QR" })).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "แจ้งซ่อมใหม่" })).toBeVisible();
    await expect(page.getByRole("link", { name: "สแกน QR" })).toHaveCount(0);

    await page.goto("/repair/scan");
    const card = page.getByTestId("qr-manual-card");
    await expect(card).toContainText("ใช้กล้องมือถือสแกน QR บนอุปกรณ์ได้เลย ไม่ต้องเปิดแอปก่อน");
    await card.getByRole("button", { name: "ค้นหา" }).click();
    await expect(card.getByText("กรุณากรอกรหัสอุปกรณ์")).toBeVisible();
    await card.getByRole("textbox", { name: "รหัสอุปกรณ์" }).fill("xx-nope-99");
    await card.getByRole("button", { name: "ค้นหา" }).click();
    await expect(card.getByText("ไม่พบอุปกรณ์รหัสนี้")).toBeVisible();
    await card.getByRole("textbox", { name: "รหัสอุปกรณ์" }).fill(` ${code.toLowerCase()} `);
    await card.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page).toHaveURL(new RegExp(`/repair/new\\?asset=${code}$`));
    await expect(banner(page)).toContainText("เติมข้อมูลจาก QR แล้ว");
  });
});

test.describe("phone camera", () => {
  test.use({
    storageState: auth("employee"),
    permissions: ["camera"],
  });
  test.skip(({ isMobile }) => !isMobile, "the in-app scan is for phones");

  test.beforeEach(async ({ page }) => {
    // The fake camera shows a test pattern; the stub decoder returns whatever the test puts in window.__qr.
    await page.addInitScript(() => {
      (window as unknown as { __qr: string }).__qr = "";
      (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
        static async getSupportedFormats() { return ["qr_code"]; }
        async detect() { const qr = (window as unknown as { __qr: string }).__qr; return qr ? [{ rawValue: qr }] : []; }
      };
    });
  });

  test("AC3 + AC5: tab bar สแกน QR (CR-040) → camera; a foreign QR toasts and keeps scanning; our /q/{code} opens the form and stops the camera", async ({ page }) => {
    await page.goto("/repair/my");
    await page.getByTestId("bottom-nav").getByRole("link", { name: "สแกน QR" }).click();
    await expect(page).toHaveURL(/\/repair\/scan$/);
    await expect(page.getByTestId("qr-scan-line")).toBeAttached({ timeout: 15_000 });

    await page.evaluate((c) => { (window as unknown as { __qr: string }).__qr = `${location.origin}/repair/new?asset=${c}`; }, code);
    await expect(page.getByText("QR นี้ไม่ใช่ของ BAMBAM")).toHaveCount(1);
    await page.waitForTimeout(1000);
    await expect(page.getByText("QR นี้ไม่ใช่ของ BAMBAM")).toHaveCount(1); // not repeated for the same QR
    await expect(page).toHaveURL(/\/repair\/scan$/);

    await page.evaluate((c) => { (window as unknown as { __qr: string }).__qr = `${location.origin}/q/${c}`; }, code);
    await expect(page).toHaveURL(new RegExp(`/repair/new\\?asset=${code}$`));
    await expect(banner(page)).toContainText(`${NAME} · ${code}`);
    expect(await page.evaluate(() => [...document.querySelectorAll("video")].some((v) => v.srcObject))).toBe(false);
  });

  test("AC3: a denied camera → เปิดกล้องไม่ได้ with manual entry in the sheet", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.goto("/repair/scan");
    await expect(page.getByRole("heading", { name: "เปิดกล้องไม่ได้" })).toBeVisible();
    await page.getByRole("button", { name: "กรอกรหัสอุปกรณ์เอง" }).click();
    const sheet = page.getByRole("dialog", { name: "กรอกรหัสอุปกรณ์" });
    await sheet.getByRole("textbox", { name: "รหัสอุปกรณ์" }).fill("XX-NOPE-99");
    await sheet.getByRole("button", { name: "ค้นหา" }).click();
    await expect(sheet.getByText("ไม่พบอุปกรณ์รหัสนี้")).toBeVisible();
    await sheet.getByRole("textbox", { name: "รหัสอุปกรณ์" }).fill(code);
    await sheet.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page).toHaveURL(new RegExp(`/repair/new\\?asset=${code}$`));
    await expect(banner(page)).toContainText("เติมข้อมูลจาก QR แล้ว");
  });
});
