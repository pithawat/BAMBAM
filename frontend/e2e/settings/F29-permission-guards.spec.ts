import { expect, test, type Page } from "@playwright/test";
import { apiAs, auth, browserAs, createRole, matrix, savePermissions, saveMatrix, SETTINGS_API, unique } from "./sessions";

// Settings Stage R1 (CR-006, F29 + repair report / S29): reporting and 3D are keys; Admin edits other roles' keys but
// never their own role, Superadmin, or a key they lack (G1–G3, 403 PERMISSION_GUARD). AC5 (S29 without 3D) is in
// F29-s29-without-3d.spec.ts (it needs the WebGL browser). Real API.
// Writes go to Roles this file creates (the seeded matrix is shared with every other spec) and are removed after.

const REPORT = "repair.ticket.report";
const VIEW_ALL = "repair.ticket.view_all";
const WORK = "repair.ticket.work";
const AUDIT = "settings.audit.view";

const navbar = (page: Page) => page.getByRole("navigation", { name: "บริการหลัก" }).filter({ visible: true });
const cell = (page: Page, perm: string, role: string) => page.getByRole("checkbox", { name: `${perm} — ${role}` });

async function openMatrix(page: Page) {
  await page.goto("/settings/roles");
  await expect(page.getByRole("heading", { name: "Role และสิทธิ์", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "ระบบแจ้งซ่อม" })).toBeVisible();
}

test.describe("AC1: technician (seed defaults)", () => {
  test.use({ storageState: auth("technician") });

  test("sees only แจ้งซ่อม → work list, no report CTA, /repair/new Forbidden; the create-ticket API answers 403", async ({ page, isMobile }) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/");
    if (!isMobile) {
      const nav = navbar(page);
      await expect(nav.getByRole("link", { name: "แจ้งซ่อม", exact: true })).toHaveAttribute("href", "/repair/work");
      await expect(nav.getByRole("link", { name: "จองรถ" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "จองห้องประชุม" })).toHaveCount(0);
    }
    const home = page.getByRole("main");
    const shown = (name: string) => home.getByRole("link", { name, exact: true }).filter({ visible: true });
    await expect(home.getByRole("heading", { name: isMobile ? "งานซ่อมของคุณ" : /สวัสดี คุณ/ }).filter({ visible: true })).toBeVisible();
    await expect(home.locator('a[href="/repair/new"]').filter({ visible: true })).toHaveCount(0);
    await expect(shown("สแกน QR")).toHaveCount(0);
    await expect(shown("ไปที่งานซ่อม")).toHaveAttribute("href", "/repair/work");
    // services: แจ้งซ่อม (→ the work list) only
    await expect(home.getByRole("link", { name: /^แจ้งซ่อม/ }).filter({ visible: true })).toHaveAttribute("href", "/repair/work");
    await expect(home.getByText("จองรถ", { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(home.getByText("จองห้องประชุม", { exact: true }).filter({ visible: true })).toHaveCount(0);

    await page.goto("/repair/new");
    await expect(page.getByText(/ไม่มีสิทธิ์/).first()).toBeVisible();

    const res = await page.request.post("/api/v1/repair/tickets", { data: {} });
    expect(res.status()).toBe(403);
    expect((await page.request.get("/api/v1/me").then((r) => r.json())).data.permissions).not.toContain(REPORT);
  });
});

test.describe("Superadmin writes", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("super_admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC2: unticking แจ้งซ่อม hides the report CTA on the next request; ticking it back restores it", async ({ page, browser, baseURL }) => {
    test.slow();
    const api = await apiAs(baseURL, "super_admin");
    const employee = (await matrix(api)).roles.find((r) => r.key === "employee")!;
    // a copy of พนักงานทั่วไป (same defaults) so the shared employee role stays untouched for the other specs
    const role = await createRole(api, unique("E2E พนักงาน"), employee.id);
    try {
      const user = await browserAs(browser, baseURL, role.key);
      const userPage = await user.newPage();
      await userPage.goto("/");
      const hero = userPage.locator("div.hidden.lg\\:block");
      await expect(hero.getByRole("link", { name: "แจ้งซ่อม", exact: true })).toBeVisible();

      await openMatrix(page);
      await cell(page, "แจ้งซ่อม", role.name).click();
      await saveMatrix(page);
      await expect(cell(page, "แจ้งซ่อม", role.name)).not.toBeChecked();

      // พนักงานทั่วไป has no other repair key → greeting only, no repair service
      await userPage.reload();
      await expect(hero.getByRole("heading", { name: /สวัสดี คุณ/ })).toBeVisible();
      await expect(hero.getByRole("link", { name: "แจ้งซ่อม", exact: true })).toHaveCount(0);
      await expect(hero.getByRole("link", { name: "ไปที่งานซ่อม" })).toHaveCount(0);
      await expect(hero.getByText("แจ้งปัญหาในอาคาร")).toHaveCount(0);
      expect((await userPage.request.post("/api/v1/repair/tickets", { data: {} })).status()).toBe(403);

      await cell(page, "แจ้งซ่อม", role.name).click();
      await saveMatrix(page);

      await userPage.reload();
      await expect(hero.getByRole("link", { name: "แจ้งซ่อม", exact: true })).toBeVisible();
      await user.close();
    } finally {
      await api.delete(`${SETTINGS_API}/roles/${role.id}`);
    }
  });

  test("ดูโมเดล 3D อาคาร is disabled until ดูภาพรวมอาคาร is ticked; unticking it unticks 3D", async ({ page, baseURL }) => {
    const api = await apiAs(baseURL, "super_admin");
    const role = await createRole(api, unique("E2E 3D"));
    try {
      await openMatrix(page);
      const overview = cell(page, "ดูภาพรวมอาคาร", role.name);
      const model = cell(page, "ดูโมเดล 3D อาคาร", role.name);
      await expect(model).toBeDisabled();
      await expect(model).toHaveAccessibleDescription('ต้องติ๊ก "ดูภาพรวมอาคาร" ก่อน');
      await overview.click();
      await expect(model).toBeEnabled();
      await model.click();
      await expect(page.getByText("เปลี่ยนสิทธิ์ 2 รายการ")).toBeVisible();
      await overview.click();
      await expect(model).not.toBeChecked();
      await expect(model).toBeDisabled();
      await expect(page.getByText(/เปลี่ยนสิทธิ์ \d+ รายการ/)).toBeHidden();
    } finally {
      await api.delete(`${SETTINGS_API}/roles/${role.id}`);
    }
  });
});

test.describe("AC3: Admin in S24", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("own role and Superadmin locked, a key Admin lacks locked; ticking another role's settings key saves", async ({ page, baseURL }) => {
    test.slow();
    const superApi = await apiAs(baseURL, "super_admin");
    const role = await createRole(superApi, unique("E2E Admin แก้"));
    try {
      await openMatrix(page);
      // G1 own role, G2 Superadmin: the whole row
      await expect(cell(page, "ดูทุกงาน", "Admin")).toBeDisabled();
      await expect(cell(page, "ดูทุกงาน", "Admin")).toHaveAccessibleDescription("แก้สิทธิ์ของ role ตัวเองไม่ได้");
      await expect(page.getByLabel("แก้สิทธิ์ของ role ตัวเองไม่ได้", { exact: true }).first()).toBeVisible();
      await expect(cell(page, "ดูทุกงาน", "Superadmin")).toBeDisabled();
      // G3: Admin lacks ดำเนินการและบันทึกผลซ่อม → the column is locked in every row
      for (const r of ["พนักงานทั่วไป", "ช่างเทคนิค", role.name]) {
        await expect(cell(page, "ดำเนินการและบันทึกผลซ่อม", r)).toBeDisabled();
        await expect(cell(page, "ดำเนินการและบันทึกผลซ่อม", r)).toHaveAccessibleDescription("ให้ได้เฉพาะสิทธิ์ที่คุณมี");
      }
      // ตั้งค่าระบบ is tickable now: ประวัติการเปลี่ยนแปลง for the new role saves
      const audit = cell(page, "ประวัติการเปลี่ยนแปลง", role.name);
      await expect(audit).toBeEnabled();
      await audit.click();
      await saveMatrix(page);
      await expect(audit).toBeChecked();
      expect((await matrix(superApi)).roles.find((r) => r.id === role.id)!.permissions).toContain(AUDIT);

      // role list: own role has no menu
      await page.goto("/settings/roles?tab=roles");
      await expect(page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Admin/ }) }).getByText("Role ของคุณ")).toBeVisible();
      await expect(page.getByRole("button", { name: "ตัวเลือกของ Admin" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: `ตัวเลือกของ ${role.name}` })).toBeVisible();
    } finally {
      await superApi.delete(`${SETTINGS_API}/roles/${role.id}`);
    }
  });

  test("the API refuses with 403 PERMISSION_GUARD: own role, Superadmin, a key Admin lacks, copy / delete / edit", async ({ baseURL }) => {
    const admin = await apiAs(baseURL, "admin");
    const superApi = await apiAs(baseURL, "super_admin");
    const m = await matrix(admin);
    const own = m.roles.find((r) => r.key === "admin")!;
    const sa = m.roles.find((r) => r.key === "super_admin")!;
    const technician = m.roles.find((r) => r.key === "technician")!;
    expect(own.guard).toBe("OWN_ROLE");
    expect(m.grantable).not.toContain(WORK);
    const role = await createRole(superApi, unique("E2E guard"));
    const guard = async (res: Awaited<ReturnType<typeof admin.put>>, rule: string) => {
      expect(res.status(), await res.text()).toBe(403);
      const body = (await res.json()) as { error: { code: string; details: { rule: string } } };
      expect(body.error.code).toBe("PERMISSION_GUARD");
      expect(body.error.details.rule).toBe(rule);
    };
    try {
      await guard(await savePermissions(admin, own.id, { [VIEW_ALL]: false }), "OWN_ROLE");
      await guard(await savePermissions(admin, sa.id, { [VIEW_ALL]: false }), "SUPER_ADMIN");
      await guard(await savePermissions(admin, role.id, { [WORK]: true }), "ESCALATION");
      await guard(await admin.post(`${SETTINGS_API}/roles`, { data: { name: unique("E2E copy"), copyFromRoleId: technician.id } }), "ESCALATION");
      await guard(await admin.delete(`${SETTINGS_API}/roles/${own.id}`), "OWN_ROLE");
      await guard(await admin.patch(`${SETTINGS_API}/roles/${own.id}`, { data: { name: "Admin x", updatedAt: new Date().toISOString() } }), "OWN_ROLE");
      // nothing was saved
      expect((await matrix(superApi)).roles.find((r) => r.id === role.id)!.permissions).not.toContain(WORK);
      // a key Admin holds is fine
      expect((await savePermissions(admin, role.id, { [VIEW_ALL]: true })).status()).toBe(200);
    } finally {
      await superApi.delete(`${SETTINGS_API}/roles/${role.id}`);
    }
  });

  test("Add Role: a role with keys Admin lacks is a disabled copy option", async ({ page }) => {
    await page.goto("/settings/roles?tab=roles");
    await page.getByRole("button", { name: "เพิ่ม Role" }).click();
    const form = page.getByRole("dialog", { name: "เพิ่ม Role" });
    await form.getByRole("combobox").click();
    const option = page.getByRole("option", { name: /คัดลอกจาก ช่างเทคนิค/ });
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await expect(option).toContainText("มีสิทธิ์ที่คุณไม่มี");
    await expect(page.getByRole("option", { name: /คัดลอกจาก พนักงานทั่วไป/ })).not.toHaveAttribute("aria-disabled", "true");
  });
});
