import { expect, test, type Page } from "@playwright/test";
import { psql, removePerson, upsertPerson, type Person } from "./people";
import { apiAs, auth, browserAs, createRole, roles, SETTINGS_API, setRoleKeys, unique } from "./sessions";

// Settings Stage R1 AC4 (CR-006, F15 / S25): Admin cannot change their own role, a Superadmin's role, or give a role
// with keys they lack (only พนักงานทั่วไป and Admin with the seed defaults); `users.view` alone is read-only.
// Real API, on one-off people this file writes into bambam_e2e (the shared sample people stay untouched).

const READ_ONLY = "บัญชีนี้ดูรายชื่อได้อย่างเดียว เปลี่ยน Role ไม่ได้";
const SUPER_ADMIN = "เปลี่ยน Role ของ Superadmin ได้เฉพาะ Superadmin";

const oneOff = (code: string): Person => ({ code, first: "ทดสอบ", last: code, firstEn: "Test", lastEn: code, department: "ฝ่ายทดสอบ", role: null });
// set per project in beforeAll: the desktop and mobile workers run this file at the same time
let EMPLOYEE = oneOff("EMP9R1A");
let SUPER = oneOff("EMP9R1S");
const nameOf = (p: Person) => `${p.first} ${p.last}`;
const userId = (p: Person) => psql(`SELECT id FROM platform.users WHERE employee_code = '${p.code}'`);

async function openUser(page: Page, p: Person) {
  await page.goto(`/settings/users?q=${p.code}`);
  await expect(page.getByRole("heading", { name: "ผู้ใช้", level: 1 })).toBeVisible();
  await expect(page.getByText("พบ 1 คน")).toBeVisible();
}

// one worker per project, so the people this file writes live until its last test
test.describe.configure({ mode: "serial" });

test.beforeAll(({}, info) => {
  const tag = info.project.name === "mobile" ? "M" : "D";
  EMPLOYEE = oneOff(`EMP9R1A${tag}`);
  SUPER = oneOff(`EMP9R1S${tag}`);
  upsertPerson(EMPLOYEE, null);
  upsertPerson(SUPER, "super_admin");
});
test.afterAll(() => {
  removePerson(EMPLOYEE.code);
  removePerson(SUPER.code);
});

test.describe("AC4: Admin", () => {
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "the role control is the same on phones (F15 mobile)");

  test("change dialog offers only roles within Admin's keys; a Superadmin row is locked", async ({ page }) => {
    test.slow(); // first visits compile on `next dev`
    await openUser(page, EMPLOYEE);
    await page.getByRole("button", { name: new RegExp(`^เปลี่ยน Role ของ ${nameOf(EMPLOYEE)}`) }).click();
    const dialog = page.getByRole("dialog", { name: "เปลี่ยน Role" });
    await expect(dialog.getByRole("radio")).not.toHaveCount(0);
    await expect(dialog.getByText("พนักงานทั่วไป", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Admin", { exact: true })).toBeVisible();
    for (const r of ["Superadmin", "ช่างเทคนิค", "หัวหน้าแม่บ้าน", "หัวหน้ารปภ."]) await expect(dialog.getByText(r, { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();

    await openUser(page, SUPER);
    await expect(page.getByRole("button", { name: new RegExp(`^เปลี่ยน Role ของ ${nameOf(SUPER)}`) })).toHaveCount(0);
    await expect(page.getByLabel(SUPER_ADMIN, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: `ดูข้อมูล ${nameOf(SUPER)}` }).click();
    const detail = page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" });
    await expect(detail.getByRole("button", { name: "เปลี่ยน Role" })).toBeDisabled();
    await expect(detail.getByText(SUPER_ADMIN)).toBeVisible();
  });

  test("the API refuses: own role, a Superadmin, assigning Superadmin or a role beyond Admin's keys", async ({ baseURL }) => {
    const admin = await apiAs(baseURL, "admin");
    const list = await roles(admin);
    const role = (key: string) => list.find((r) => r.key === key)!;
    expect(role("super_admin").assignable).toBe(false);
    expect(role("technician").assignable).toBe(false);
    expect(role("employee").assignable).toBe(true);
    expect(role("admin").assignable).toBe(true);

    const change = (id: string, roleKey: string) => admin.put(`${SETTINGS_API}/users/${id}/role`, { data: { roleId: role(roleKey).id } });
    const rule = async (res: Awaited<ReturnType<typeof change>>) => {
      expect(res.status(), await res.text()).toBe(403);
      return (await res.json()).error.details.rule;
    };
    expect(await rule(await change(userId(SUPER), "employee"))).toBe("SUPER_ADMIN");
    expect(await rule(await change(userId(EMPLOYEE), "super_admin"))).toBe("SUPER_ADMIN");
    expect(await rule(await change(userId(EMPLOYEE), "technician"))).toBe("ESCALATION");

    const me = (await (await admin.get("/api/v1/me")).json()).data;
    const self = await change(me.id, "employee");
    expect(self.status()).not.toBe(200);
    expect((await self.json()).error.code).toMatch(/CANNOT_CHANGE_SELF|USER_NOT_FOUND/);

    // a role within Admin's keys is allowed (a throwaway one: F15 counts the seeded roles' people)
    const superApi = await apiAs(baseURL, "super_admin");
    const plain = await createRole(superApi, unique("E2E ให้ได้"));
    try {
      const ok = await admin.put(`${SETTINGS_API}/users/${userId(EMPLOYEE)}/role`, { data: { roleId: plain.id } });
      expect(ok.status(), await ok.text()).toBe(200);
      expect((await change(userId(EMPLOYEE), "employee")).status()).toBe(200);
    } finally {
      await superApi.delete(`${SETTINGS_API}/roles/${plain.id}`);
    }
  });
});

test("users.view only: S25 is read-only and the API refuses a change", async ({ browser, baseURL, isMobile }) => {
  test.skip(isMobile, "runs once (desktop)");
  test.slow();
  const superApi = await apiAs(baseURL, "super_admin");
  const viewer = await createRole(superApi, unique("E2E ดูผู้ใช้"));
  try {
    await setRoleKeys(superApi, viewer.id, ["settings.users.view"]);
    const ctx = await browserAs(browser, baseURL, viewer.key);
    const page = await ctx.newPage();
    await openUser(page, EMPLOYEE);
    await expect(page.getByRole("button", { name: /^เปลี่ยน Role ของ/ })).toHaveCount(0);
    await page.getByRole("button", { name: `ดูข้อมูล ${nameOf(EMPLOYEE)}` }).click();
    const detail = page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" });
    await expect(detail.getByRole("button", { name: "เปลี่ยน Role" })).toBeDisabled();
    await expect(detail.getByText(READ_ONLY)).toBeVisible();

    const employee = (await roles(superApi)).find((r) => r.key === "employee")!;
    expect((await page.request.put(`${SETTINGS_API}/users/${userId(EMPLOYEE)}/role`, { data: { roleId: employee.id } })).status()).toBe(403);
    await ctx.close();
  } finally {
    await superApi.delete(`${SETTINGS_API}/roles/${viewer.id}`);
  }
});
