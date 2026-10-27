import path from "node:path";
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import stack from "../test-stack.cjs";
import { addPersonToRole, removePerson } from "./people";

// F29 (settings Stage 2, S24): Superadmin ticks permissions in the matrix and the role's users gain / lose them on
// their next request; add / edit / delete Role; the fixed "ตั้งค่าระบบ" card; VERSION_CONFLICT; unsaved guard. Real API.
//
// Isolation: the matrix is shared by every spec, so the write tests run on a Role this file creates (its demo user is
// reached through the dev role switch) and remove it afterwards. Seeded roles are only read here.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";
const VIEW_ALL = "repair.ticket.view_all";
/** A save under full-suite load (4 workers on `next dev`) can take longer than the default 5 s. */
const SAVE = 20_000;

type Role = { id: string; key: string; name: string; userCount: number; updatedAt: string };
type Matrix = { version: number; roles: { id: string; permissions: string[] }[] };

const unique = (prefix: string) => `${prefix} ${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 100)}`;

async function adminApi(baseURL: string | undefined) {
  return playwrightRequest.newContext({ baseURL, storageState: auth("super_admin") });
}

async function createRole(api: APIRequestContext, name: string, copyFromRoleId: string | null = null): Promise<Role> {
  const res = await api.post(`${API}/roles`, { data: { name, description: "e2e", copyFromRoleId } });
  expect(res.status()).toBe(201);
  return (await res.json()).data;
}

async function deleteRoleByName(api: APIRequestContext, name: string) {
  const roles: Role[] = (await (await api.get(`${API}/roles`)).json()).data;
  const r = roles.find((x) => x.name === name);
  if (r) await api.delete(`${API}/roles/${r.id}`);
}

/** A fresh session switched to the demo user of `roleKey` (the switch replaces the session it runs on). */
async function sessionAs(baseURL: string | undefined, roleKey: string) {
  const token = stack.sessionToken("employee");
  const api = await playwrightRequest.newContext({
    baseURL,
    storageState: {
      cookies: [{ name: "bam_session", value: token, domain: "localhost", path: "/", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, secure: true, sameSite: "Lax" }],
      origins: [],
    },
  });
  const res = await api.post("/api/v1/dev/role-switch", { data: { role: roleKey } });
  expect(res.status()).toBe(200);
  return api;
}

async function openMatrix(page: Page) {
  await page.goto("/settings/roles");
  await expect(page.getByRole("heading", { name: "Role และสิทธิ์", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "งานแจ้งซ่อม" })).toBeVisible();
}

async function saveMatrix(page: Page) {
  await page.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
  const dialog = page.getByRole("alertdialog", { name: "บันทึกการเปลี่ยนสิทธิ์?" });
  await dialog.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
  await expect(page.getByText("บันทึกสิทธิ์แล้ว")).toBeVisible({ timeout: SAVE });
  await expect(dialog).toBeHidden();
}

test.describe("desktop", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("super_admin") });
  test.skip(({ isMobile }) => isMobile, "matrix writes run once (desktop); the mobile layout is checked below");

  test("AC1 / AC1b: default ticks, Superadmin row locked, the fixed ตั้งค่าระบบ card", async ({ page }) => {
    test.slow(); // first visit compiles on `next dev`
    await openMatrix(page);
    await expect(page.getByText("ทุก Role แจ้งซ่อมและติดตามงานตัวเองได้เสมอ")).toBeVisible();
    for (const card of ["งานแจ้งซ่อม", "งานทีมและช่างภายนอก", "ตั้งค่าระบบ"]) await expect(page.getByRole("region", { name: card })).toBeVisible();

    const cell = (perm: string, role: string) => page.getByRole("checkbox", { name: `${perm} — ${role}` });
    // 01-users.md defaults
    await expect(cell("ดูทุกงาน", "ช่างเทคนิค")).toBeChecked();
    await expect(cell("จัดการช่างภายนอก", "ช่างเทคนิค")).toBeChecked();
    await expect(cell("ดูทุกงาน", "พนักงานทั่วไป")).not.toBeChecked();
    await expect(cell("บันทึกงานทีมทำเอง", "หัวหน้าแม่บ้าน")).toBeChecked();
    await expect(cell("ปิดงานใดก็ได้", "Admin")).toBeChecked();
    // Superadmin: ticked and disabled
    await expect(cell("ปิดงานใดก็ได้", "Superadmin")).toBeChecked();
    await expect(cell("ปิดงานใดก็ได้", "Superadmin")).toBeDisabled();
    // ตั้งค่าระบบ: Admin = อาคารและห้อง · อุปกรณ์และประเภทอุปกรณ์ · หมวดงานและอาการ only; every cell disabled
    const fixed = page.getByRole("region", { name: "ตั้งค่าระบบ" });
    await expect(fixed.getByText("กำหนดโดยระบบ")).toBeVisible();
    for (const p of ["อาคารและห้อง", "อุปกรณ์และประเภทอุปกรณ์", "หมวดงานและอาการ"]) {
      await expect(cell(p, "Admin")).toBeChecked();
      await expect(cell(p, "Admin")).toBeDisabled();
    }
    for (const p of ["ประเภทผู้รับเหมา", "ผู้ใช้", "Role และสิทธิ์", "ประวัติการเปลี่ยนแปลง"]) {
      await expect(cell(p, "Admin")).not.toBeChecked();
      await expect(cell(p, "Superadmin")).toBeChecked();
    }
    await expect(cell("ผู้ใช้", "ช่างเทคนิค")).not.toBeChecked();
    await expect(cell("ผู้ใช้", "ช่างเทคนิค")).toBeDisabled();
  });

  test("AC2: grant → the role's user gets it on the next request; revoke → refused again", async ({ page, baseURL }) => {
    test.slow();
    const api = await adminApi(baseURL);
    const name = unique("E2E สิทธิ์");
    const role = await createRole(api, name);
    try {
      const user = await sessionAs(baseURL, role.key);
      expect((await user.get("/api/v1/repair/tickets?scope=all")).status()).toBe(403);

      await openMatrix(page);
      const cell = page.getByRole("checkbox", { name: `ดูทุกงาน — ${name}` });
      await cell.click();
      await expect(page.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();
      // toggling back removes the change; again → counted
      await cell.click();
      await expect(page.getByText(/เปลี่ยนสิทธิ์ \d+ รายการ/)).toBeHidden();
      await cell.click();

      await page.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      const dialog = page.getByRole("alertdialog", { name: "บันทึกการเปลี่ยนสิทธิ์?" });
      await expect(dialog.getByText(name)).toBeVisible();
      await expect(dialog.getByText("ผู้ใช้ 0 คน")).toBeVisible();
      await expect(dialog.getByText("เพิ่ม: ดูทุกงาน")).toBeVisible();
      await expect(dialog.getByText("มีผลในการใช้งานครั้งถัดไป โดยไม่ต้องออกจากระบบ")).toBeVisible();
      await dialog.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      await expect(page.getByText("บันทึกสิทธิ์แล้ว")).toBeVisible({ timeout: SAVE });
      await expect(cell).toBeChecked();

      // same session, next request
      expect((await user.get("/api/v1/repair/tickets?scope=all")).status()).toBe(200);
      const me = (await (await user.get("/api/v1/me")).json()).data;
      expect(me.permissions).toContain(VIEW_ALL);

      await cell.click();
      await expect(page.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();
      await page.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      await expect(page.getByRole("alertdialog").getByText("ถอด: ดูทุกงาน")).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      // the toast text repeats from the grant save, so wait for what only a finished save does: the pending bar goes
      await expect(page.getByText(/เปลี่ยนสิทธิ์ \d+ รายการ/)).toBeHidden();
      await expect(cell).not.toBeChecked();
      expect((await user.get("/api/v1/repair/tickets?scope=all")).status()).toBe(403);
    } finally {
      await api.delete(`${API}/roles/${role.id}`);
    }
  });

  test("AC3 / AC4: add Role copied from ช่างเทคนิค (same ticks, highlighted, in the switcher), edit, delete", async ({ page, baseURL }) => {
    test.slow();
    const name = unique("หัวหน้าช่าง");
    const renamed = `${name} ก`;
    const api = await adminApi(baseURL);
    const busyName = unique("E2E มีผู้ใช้");
    const busy = await createRole(api, busyName);
    const busyCode = `E2E${Date.now().toString().slice(-7)}`;
    addPersonToRole(busyCode, busy.key);
    try {
      await openMatrix(page);
      await page.getByRole("button", { name: "เพิ่ม Role" }).click();
      const form = page.getByRole("dialog", { name: "เพิ่ม Role" });
      // client validation
      await form.getByRole("button", { name: "เพิ่ม Role" }).click();
      await expect(form.getByText("กรุณากรอกชื่อ Role")).toBeVisible();
      // duplicate (case-insensitive)
      await form.getByLabel("ชื่อ Role").fill("admin");
      await form.getByRole("button", { name: "เพิ่ม Role" }).click();
      await expect(form.getByText("ชื่อนี้มีอยู่แล้ว")).toBeVisible();

      await form.getByLabel("ชื่อ Role").fill(name);
      await form.getByRole("combobox").click();
      await page.getByRole("option", { name: "คัดลอกจาก ช่างเทคนิค" }).click();
      await expect(form.getByText("คัดลอกเฉพาะสิทธิ์งานซ่อม สิทธิ์ตั้งค่าระบบสงวนตามบทบาทผู้ดูแล")).toBeVisible();
      await form.getByRole("button", { name: "เพิ่ม Role" }).click();
      await expect(page.getByText(`เพิ่ม Role "${name}" แล้ว`)).toBeVisible();

      const row = page.getByRole("region", { name: "งานแจ้งซ่อม" }).getByRole("row").filter({ hasText: name });
      await expect(row).toHaveClass(/bg-secondary/);
      for (const p of ["ดูทุกงาน", "ดำเนินการและบันทึกผลซ่อม", "จัดการช่างภายนอก"]) {
        await expect(page.getByRole("checkbox", { name: `${p} — ${name}` })).toBeChecked();
      }
      await expect(page.getByRole("checkbox", { name: `ปิดงานใดก็ได้ — ${name}` })).not.toBeChecked();
      // fixed settings keys are never copied
      await expect(page.getByRole("checkbox", { name: `อาคารและห้อง — ${name}` })).not.toBeChecked();

      // the role switcher (dev/UAT) lists it
      const demo: { roleName: string }[] = (await (await api.get("/api/v1/dev/demo-users")).json()).data;
      expect(demo.map((d) => d.roleName)).toContain(name);

      // tab รายการ Role: edit
      await page.getByRole("tab", { name: /รายการ Role/ }).click();
      await expect(page).toHaveURL(/tab=roles/);
      await page.getByRole("button", { name: `ตัวเลือกของ ${name}` }).click();
      await page.getByRole("menuitem", { name: "แก้ไข Role" }).click();
      const edit = page.getByRole("dialog", { name: "แก้ไข Role" });
      await edit.getByLabel("ชื่อ Role").fill(renamed);
      await edit.getByRole("button", { name: "บันทึก" }).click();
      await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
      await expect(page.getByRole("rowheader", { name: renamed })).toBeVisible();

      // system roles: Superadmin has no menu; พนักงานทั่วไป has no ลบ
      await expect(page.getByRole("button", { name: "ตัวเลือกของ Superadmin" })).toHaveCount(0);
      await page.getByRole("button", { name: "ตัวเลือกของ พนักงานทั่วไป" }).click();
      await expect(page.getByRole("menuitem", { name: "แก้ไข Role" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "ลบ Role" })).toHaveCount(0);
      await page.keyboard.press("Escape");

      // AC4: a Role with a real user → blocked, links to S25 filtered by the role
      await page.getByRole("button", { name: `ตัวเลือกของ ${busyName}` }).click();
      await page.getByRole("menuitem", { name: "ลบ Role" }).click();
      const blocked = page.getByRole("alertdialog", { name: "ลบ Role นี้ไม่ได้" });
      await expect(blocked.getByText(`มีผู้ใช้ 1 คนใน Role "${busyName}" ย้ายไป Role อื่นก่อน`)).toBeVisible();
      await expect(blocked.getByRole("link", { name: "ดูผู้ใช้" })).toHaveAttribute("href", `/settings/users?role=${busy.id}`);
      await blocked.getByRole("button", { name: "ปิด" }).click();
      expect((await api.delete(`${API}/roles/${busy.id}`)).status()).toBe(409);

      // 0 users → confirm → gone
      await page.getByRole("button", { name: `ตัวเลือกของ ${renamed}` }).click();
      await page.getByRole("menuitem", { name: "ลบ Role" }).click();
      const confirm = page.getByRole("alertdialog", { name: `ลบ Role "${renamed}"?` });
      await confirm.getByRole("button", { name: "ลบ Role" }).click();
      await expect(page.getByText(`ลบ Role "${renamed}" แล้ว`)).toBeVisible();
      await expect(page.getByRole("rowheader", { name: renamed })).toHaveCount(0);
    } finally {
      await deleteRoleByName(api, name);
      await deleteRoleByName(api, renamed);
      removePerson(busyCode);
      await api.delete(`${API}/roles/${busy.id}`);
    }
  });

  test("AC5: two tabs — the second save gets the conflict and keeps its changes after โหลดข้อมูลล่าสุด", async ({ browser, baseURL }) => {
    test.slow();
    const api = await adminApi(baseURL);
    const name = unique("E2E ชนกัน");
    const role = await createRole(api, name);
    const ctx = await browser.newContext({ storageState: auth("super_admin"), baseURL });
    try {
      const a = await ctx.newPage();
      const b = await ctx.newPage();
      await openMatrix(a);
      await openMatrix(b);

      await a.getByRole("checkbox", { name: `ดูทุกงาน — ${name}` }).click();
      await saveMatrix(a);

      await b.getByRole("checkbox", { name: `ปิดงานใดก็ได้ — ${name}` }).click();
      await b.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      const dialog = b.getByRole("alertdialog", { name: "บันทึกการเปลี่ยนสิทธิ์?" });
      await dialog.getByRole("button", { name: "บันทึกสิทธิ์" }).click();
      await expect(dialog.getByText(/สิทธิ์ถูกแก้โดย .+ เมื่อ/)).toBeVisible();
      await dialog.getByRole("button", { name: "โหลดข้อมูลล่าสุด" }).click();
      await expect(b.getByText("โหลดข้อมูลล่าสุดแล้ว ตรวจการเปลี่ยนแปลงอีกครั้งก่อนบันทึก")).toBeVisible();
      // A's change is in, B's pending change is kept
      await expect(b.getByRole("checkbox", { name: `ดูทุกงาน — ${name}` })).toBeChecked();
      await expect(b.getByRole("checkbox", { name: `ปิดงานใดก็ได้ — ${name}` })).toBeChecked();
      await expect(b.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();
      await saveMatrix(b);

      const m: Matrix = (await (await api.get(`${API}/permissions`)).json()).data;
      expect(m.roles.find((r) => r.id === role.id)?.permissions).toEqual(expect.arrayContaining([VIEW_ALL, "repair.ticket.close_any"]));
    } finally {
      await ctx.close();
      await api.delete(`${API}/roles/${role.id}`);
    }
  });

  test("AC6: leaving with unsaved changes asks first; switching tabs keeps them", async ({ page }) => {
    await openMatrix(page);
    await page.getByRole("checkbox", { name: "ดูทุกงาน — พนักงานทั่วไป" }).click();
    await expect(page.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();

    await page.getByRole("tab", { name: /รายการ Role/ }).click();
    await page.getByRole("tab", { name: "ตารางสิทธิ์" }).click();
    await expect(page.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();

    await page.getByRole("complementary", { name: "เมนูหลัก" }).getByRole("link", { name: "อาคารและอุปกรณ์" }).click();
    const leave = page.getByRole("alertdialog", { name: "ออกโดยไม่บันทึก?" });
    await expect(leave.getByText("มีการเปลี่ยนแปลง 1 รายการที่ยังไม่บันทึก")).toBeVisible();
    await leave.getByRole("button", { name: "อยู่ต่อ" }).click();
    await expect(page).toHaveURL(/\/settings\/roles/);

    await page.getByRole("button", { name: "ยกเลิกการเปลี่ยนแปลง" }).click();
    await expect(page.getByText(/เปลี่ยนสิทธิ์ \d+ รายการ/)).toBeHidden();
    await page.getByRole("complementary", { name: "เมนูหลัก" }).getByRole("link", { name: "อาคารและอุปกรณ์" }).click();
    await expect(page).toHaveURL(/\/settings\/buildings/);
  });
});

test.describe("mobile", () => {
  test.use({ storageState: auth("super_admin") });
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("AC6: per-role switches with the save bar; changes of other roles are kept", async ({ page }) => {
    test.slow();
    await openMatrix(page);
    await page.getByRole("combobox").click();
    await page.getByRole("dialog", { name: "เลือก Role ที่ต้องการตั้งค่า" }).getByRole("option", { name: /^ช่างเทคนิค/ }).click();
    const sw = page.getByRole("switch", { name: "จัดการช่างภายนอก — ช่างเทคนิค" });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(page.getByText("เปลี่ยนสิทธิ์ 1 รายการ")).toBeVisible();
    await expect(page.getByRole("switch", { name: "อาคารและห้อง — ช่างเทคนิค" })).toBeDisabled();

    await page.getByRole("combobox").click();
    await page.getByRole("dialog", { name: "เลือก Role ที่ต้องการตั้งค่า" }).getByRole("option", { name: /^Admin/ }).click();
    await page.getByRole("switch", { name: "ดูภาพรวมอาคาร — Admin" }).click();
    await expect(page.getByText("เปลี่ยนสิทธิ์ 2 รายการ")).toBeVisible();
    await page.getByRole("button", { name: "ยกเลิกการเปลี่ยนแปลง" }).click();
    await expect(page.getByText(/เปลี่ยนสิทธิ์ \d+ รายการ/)).toBeHidden();
  });
});

test("Admin gets Forbidden on S24 and 403 from #6", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ storageState: auth("admin"), baseURL });
  const page = await ctx.newPage();
  await page.goto("/settings/roles");
  await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  expect((await page.request.get(`${API}/permissions`)).status()).toBe(403);
  await ctx.close();
});
