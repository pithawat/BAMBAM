import path from "node:path";
import { expect, test } from "@playwright/test";

// Stage 0 smoke: F01 login gate → app shell, profile, role switcher (F01-B).
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);

test.describe("signed out", () => {
  test("protected page redirects to S01 login, which does not start SSO by itself", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("ยินดีต้อนรับสู่ BAMBAM").filter({ visible: true }).first()).toBeVisible();
  });

  test("login button starts the PKCE flow at RMC SSO", async ({ request }) => {
    const res = await request.get("/api/auth/login?next=%2Fprofile", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const location = new URL(res.headers()["location"]);
    expect(location.origin + location.pathname).toBe("https://rmc-sso.cipcloud.net/api/auth/oauth2/authorize");
    expect(location.searchParams.get("client_id")).toBe("bam");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/rmc-sso");
  });

  test("/signed-out never starts login automatically", async ({ page }) => {
    await page.goto("/signed-out");
    await expect(page.getByText("ออกจากระบบแล้ว").filter({ visible: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signed-out$/);
  });

  test("API rejects requests without a session", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });
});

test.describe("employee session", () => {
  test.use({ storageState: auth("employee") });

  test("sees the top navbar with three equal services and their account (CR-010)", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "บริการหลัก" }).filter({ visible: true });
    for (const service of ["แจ้งซ่อม", "จองรถ", "จองห้องประชุม"]) await expect(nav.getByRole("link", { name: service })).toBeVisible();
    await expect(page.getByRole("heading", { name: "สวัสดี คุณวรรณา" }).filter({ visible: true }).first()).toBeVisible();
    const account = page.getByRole("button", { name: /เมนูบัญชี วรรณา สุขประเสริฐ/ });
    await account.click();
    await expect(page.getByRole("menuitem", { name: "โปรไฟล์" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
  });

  test("car booking opens the not-yet-open page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "บริการหลัก" }).filter({ visible: true }).getByRole("link", { name: "จองรถ" }).click();
    await expect(page).toHaveURL(/\/car-booking$/);
    await expect(page.getByText("บริการนี้กำลังเตรียมเปิดให้ใช้งาน")).toBeVisible();
  });

  test("logout from the account menu asks to confirm", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /เมนูบัญชี/ }).click();
    await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
    await expect(page.getByRole("alertdialog", { name: "ออกจากระบบ?" })).toBeVisible();
    await page.getByRole("button", { name: "ยกเลิก" }).click();
  });

  test("profile shows SSO data, role and the demo-user note", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("ข้อมูลจาก RMC SSO").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("พนักงานทั่วไป").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("คุณกำลังใช้ผู้ใช้ตัวอย่างในโหมดทดสอบ")).toBeVisible();
    await expect(page.getByText("หมวดงานที่รับผิดชอบ")).toHaveCount(0);
  });
});

test.describe("role switcher", () => {
  test.use({ storageState: async ({}, provide, testInfo) => provide(auth(`switch-${testInfo.project.name}`)) });

  test("switching to technician reloads Home as the technician demo user", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /กำลังดูในบทบาท: พนักงานทั่วไป/ }).click();
    await page.getByRole("radio", { name: /ช่างเทคนิค/ }).click();
    await page.getByRole("button", { name: "สลับบทบาท" }).click();
    await expect(page.getByText("กำลังดูในบทบาท ช่างเทคนิค")).toBeVisible();
    await page.goto("/profile");
    await expect(page.getByText("ธนากร พึ่งบุญ").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("หมวดงานที่รับผิดชอบ")).toBeVisible();
  });
});

test.describe("admin session", () => {
  test.use({ storageState: auth("admin") });

  test("repair section nav shows the admin repair menu (CR-010)", async ({ page }) => {
    await page.goto("/repair/my");
    const nav = page.getByRole("navigation", { name: "เมนูงานซ่อม" });
    await expect(nav.getByRole("link", { name: "งานทั้งหมด" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "ภาพรวมอาคาร" })).toBeAttached();
  });
});
