import path from "node:path";
import { expect, test } from "@playwright/test";
import { person, seedPeople, upsertPerson } from "./people";

// F30 (settings Stage 3, S26): every settings write is listed with who, when and before → after; filters combine
// and live in the URL; read-only. The rows are made here through the API (a Role with a permission change and a
// role change of a sample person), so the spec does not depend on other specs. Real API.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

test.use({ storageState: auth("super_admin") });
test.beforeAll(() => seedPeople());

test("AC5: the matrix change and the role change are listed with before → after; filters combine in the URL", async ({ page, isMobile }) => {
  test.slow();
  test.skip(isMobile, "writes run once (desktop)");
  const api = page.request;
  const name = `E2E ประวัติ ${Date.now().toString(36).slice(-5)}`;
  const role = (await (await api.post(`${API}/roles`, { data: { name, description: "", copyFromRoleId: null } })).json()).data;
  try {
    const matrix = (await (await api.get(`${API}/permissions`)).json()).data;
    expect((await api.put(`${API}/permissions`, { data: { version: matrix.version, changes: [{ roleId: role.id, permission: "repair.ticket.view_all", granted: true }] } })).status()).toBe(200);

    upsertPerson(person("EMP0413")); // กิตติพัฒน์ back to พนักงานทั่วไป
    const kittipat = (await (await api.get(`${API}/users?q=EMP0413`)).json()).data[0];
    expect((await api.put(`${API}/users/${kittipat.id}/role`, { data: { roleId: role.id } })).status()).toBe(200);

    await page.goto("/settings/audit");
    await expect(page.getByRole("heading", { name: "ประวัติการเปลี่ยนแปลง", level: 1 })).toBeVisible();

    // search → both rows of this Role name show up; the role change row reads before → after
    await page.getByRole("searchbox", { name: "ค้นหาชื่อรายการ" }).fill(name);
    await expect(page).toHaveURL(/q=E2E/);
    const permRow = page.getByRole("row").filter({ hasText: "เปลี่ยนสิทธิ์" }).filter({ hasText: name });
    await expect(permRow).toContainText("เพิ่ม: ดูทุกงาน");
    await expect(page.getByRole("row").filter({ hasText: "เพิ่ม" }).filter({ hasText: `เพิ่ม "${name}"` })).toBeVisible();

    // type สิทธิ์ + search combine; then ผู้ใช้ with the person's name
    await page.getByRole("radio", { name: "สิทธิ์" }).click();
    await expect(page).toHaveURL(/type=permissions/);
    await expect(permRow).toBeVisible();

    await page.getByRole("radio", { name: "ผู้ใช้" }).click();
    await page.getByRole("searchbox", { name: "ค้นหาชื่อรายการ" }).fill("กิตติพัฒน์ แสงทอง");
    await expect(page).toHaveURL(/type=users/);
    const roleRow = page.getByRole("row").filter({ hasText: "เปลี่ยน Role" }).filter({ hasText: "กิตติพัฒน์ แสงทอง" }).first();
    await expect(roleRow).toContainText(`พนักงานทั่วไป → ${name}`);
    await expect(roleRow.getByRole("link", { name: "กิตติพัฒน์ แสงทอง" })).toHaveAttribute("href", `/settings/users?user=${kittipat.id}`);

    // the filters survive a reload (URL), Master excludes these rows, ล้างตัวกรอง resets
    await page.reload();
    await expect(roleRow).toBeVisible();
    await page.getByRole("radio", { name: "Master" }).click();
    await expect(page.getByText("ไม่พบรายการตามตัวกรอง")).toBeVisible();
    await page.getByRole("button", { name: "ล้างตัวกรอง" }).first().click();
    await expect(page).toHaveURL(/\/settings\/audit$/);
    await expect(page.getByRole("combobox", { name: "ช่วงวันที่" })).toContainText("30 วัน");
  } finally {
    upsertPerson(person("EMP0413"));
    await api.delete(`${API}/roles/${role.id}`);
  }
});

test("phone: grouped by day, read-only", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/settings/audit?range=all");
  await expect(page.getByRole("heading", { name: "ประวัติการเปลี่ยนแปลง", level: 1 })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("region").filter({ has: page.getByRole("heading", { level: 3 }) }).first()).toBeVisible();
});

test("Admin gets Forbidden on S26 and 403 from #11 / #12", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ storageState: auth("admin"), baseURL });
  const page = await ctx.newPage();
  await page.goto("/settings/audit");
  await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
  expect((await page.request.get(`${API}/audit`)).status()).toBe(403);
  expect((await page.request.get(`${API}/audit/actors`)).status()).toBe(403);
  await ctx.close();
});
