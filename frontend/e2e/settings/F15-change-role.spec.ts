import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { person, seedPeople, upsertPerson } from "./people";

// F15 (settings Stage 3, S25): Superadmin finds a person and changes their role; env-defined Superadmins are locked;
// the detail shows the role history. Real API, sample people from ./people.ts in bambam_e2e.
// The writes run once (desktop); the phone layout is checked read-only.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

test.use({ storageState: auth("super_admin") });
test.beforeAll(() => seedPeople());

async function openUsers(page: Page, query = "") {
  await page.goto(`/settings/users${query}`);
  await expect(page.getByRole("heading", { name: "ผู้ใช้", level: 1 })).toBeVisible();
  await expect(page.getByText(/^พบ \d+ คน$/)).toBeVisible();
}

const rowOf = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

test.describe("desktop", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC1: search by code and Thai name; the Admin filter lists the 2 admins; filters live in the URL", async ({ page }) => {
    test.slow();
    await openUsers(page);
    const searchBox = page.getByRole("searchbox", { name: "ค้นหาชื่อ รหัสพนักงาน หรืออีเมล" });
    await searchBox.fill("EMP0231");
    await expect(page).toHaveURL(/q=EMP0231/);
    await expect(rowOf(page, "ธนากร พึ่งบุญ")).toBeVisible();
    await expect(page.getByText("พบ 1 คน")).toBeVisible();

    await searchBox.fill("ธนากร");
    await expect(page).toHaveURL(/q=%E0%B8%98/);
    await expect(rowOf(page, "EMP0231")).toBeVisible();
    // demo users are never listed
    await expect(page.getByText("DEMO-TECHNICIAN")).toHaveCount(0);

    await searchBox.fill("");
    await page.getByRole("combobox", { name: "กรองตาม Role" }).click();
    await page.getByRole("option", { name: /^Admin · \d+ คน$/ }).click();
    await expect(page).toHaveURL(/role=/);
    await expect(page.getByText("พบ 2 คน")).toBeVisible();
    await expect(rowOf(page, "ปวีณา ศรีสุข")).toBeVisible();
    await expect(rowOf(page, "ชไมพร รัตนพันธ์")).toBeVisible();

    // back keeps the filter in the URL
    await page.reload();
    await expect(page.getByText("พบ 2 คน")).toBeVisible();
  });

  test("AC2 / AC4: change วรรณา to หัวหน้าแม่บ้าน — Superadmin warning, toast, row + detail history, next request", async ({ page }) => {
    test.slow();
    upsertPerson(person("EMP0412")); // back to พนักงานทั่วไป
    await openUsers(page, "?q=EMP0412");
    const row = rowOf(page, "วรรณา สุขประเสริฐ");
    await row.getByRole("button", { name: /เปลี่ยน Role ของ วรรณา สุขประเสริฐ/ }).click();

    const dialog = page.getByRole("dialog", { name: "เปลี่ยน Role" });
    const confirm = dialog.getByRole("button", { name: "ยืนยันเปลี่ยน Role" });
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByText("ปัจจุบัน")).toBeVisible();

    // AC4: the warning only for Superadmin
    await dialog.getByRole("radio", { name: "Superadmin" }).click();
    await expect(dialog.getByText("ผู้ใช้นี้จะตั้งค่าระบบและเปลี่ยนสิทธิ์ของทุกคนได้")).toBeVisible();
    await dialog.getByRole("radio", { name: "หัวหน้าแม่บ้าน" }).click();
    await expect(dialog.getByText("ผู้ใช้นี้จะตั้งค่าระบบและเปลี่ยนสิทธิ์ของทุกคนได้")).toBeHidden();
    await expect(dialog.getByText(/จาก\s*พนักงานทั่วไป/)).toBeVisible();
    await confirm.click();

    await expect(page.getByText("เปลี่ยน Role ของ วรรณา สุขประเสริฐ เป็น หัวหน้าแม่บ้าน แล้ว")).toBeVisible();
    await expect(row.getByRole("button", { name: /ตอนนี้ หัวหน้าแม่บ้าน/ })).toBeVisible();

    // her role on the next request carries the team-handled permission (permissions load per request)
    const found = (await (await page.request.get(`${API}/users?q=EMP0412`)).json()).data[0];
    expect(found.role.key).toBe("housekeeper_lead");
    const matrix = (await (await page.request.get(`${API}/permissions`)).json()).data;
    expect(matrix.roles.find((r: { key: string }) => r.key === "housekeeper_lead").permissions).toContain("repair.ticket.team_handle");

    // detail: history newest first with my name, then the first login
    await row.getByRole("button", { name: "ดูข้อมูล วรรณา สุขประเสริฐ" }).click();
    await expect(page).toHaveURL(/user=/);
    const detail = page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" });
    const history = detail.getByRole("listitem");
    await expect(history.first()).toContainText("พนักงานทั่วไป → หัวหน้าแม่บ้าน");
    await expect(history.first()).toContainText("โดย");
    await expect(history.last()).toContainText("เข้าใช้ครั้งแรก");
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/user=/);
  });

  test("AC3: the env-defined Superadmin is locked on screen and on the API", async ({ page }) => {
    await openUsers(page, "?q=EMP0105");
    const row = rowOf(page, "ณัฐพล อินทรวงศ์");
    await expect(row.getByText("กำหนดโดยระบบ")).toBeVisible();
    await expect(row.getByRole("button", { name: /เปลี่ยน Role ของ/ })).toHaveCount(0);

    await row.getByRole("button", { name: "ดูข้อมูล ณัฐพล อินทรวงศ์" }).click();
    const detail = page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" });
    await expect(detail.getByRole("button", { name: "เปลี่ยน Role" })).toBeDisabled();
    await expect(detail.getByText("Role นี้กำหนดโดยระบบ (ตั้งค่าใน server)")).toBeVisible();

    const user = (await (await page.request.get(`${API}/users?q=EMP0105`)).json()).data[0];
    const employee = (await (await page.request.get(`${API}/roles`)).json()).data.find((r: { key: string }) => r.key === "employee");
    const res = await page.request.put(`${API}/users/${user.id}/role`, { data: { roleId: employee.id } });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe("ROLE_LOCKED");
  });

  test("Stage 6: a Role deleted while the dialog is open → ROLE_NOT_FOUND copy, the list refreshes", async ({ page }) => {
    test.slow();
    upsertPerson(person("EMP0413"));
    const name = `E2E ลบระหว่างเลือก ${Date.now().toString(36).slice(-5)}`;
    const role = (await (await page.request.post(`${API}/roles`, { data: { name, description: "", copyFromRoleId: null } })).json()).data;
    await openUsers(page, "?q=EMP0413");
    await rowOf(page, "กิตติพัฒน์ แสงทอง").getByRole("button", { name: /เปลี่ยน Role ของ/ }).click();
    const dialog = page.getByRole("dialog", { name: "เปลี่ยน Role" });
    await dialog.getByRole("radio", { name }).click();
    expect((await page.request.delete(`${API}/roles/${role.id}`)).status()).toBe(204);
    await dialog.getByRole("button", { name: "ยืนยันเปลี่ยน Role" }).click();
    await expect(dialog.getByText("Role นี้ถูกลบไปแล้ว เลือกใหม่")).toBeVisible();
    await expect(dialog.getByRole("radio", { name })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "ยืนยันเปลี่ยน Role" })).toBeDisabled();
  });

  test("a stale ?user= shows ไม่พบผู้ใช้นี้", async ({ page }) => {
    await page.goto("/settings/users?user=00000000-0000-4000-8000-000000000000");
    const detail = page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" });
    await expect(detail.getByText("ไม่พบผู้ใช้นี้")).toBeVisible();
    await detail.getByRole("button", { name: "ปิด" }).first().click();
    await expect(page).not.toHaveURL(/user=/);
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("cards with the role control, detail as a bottom sheet", async ({ page }) => {
    test.slow();
    await openUsers(page, "?q=EMP0231");
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.getByRole("button", { name: /เปลี่ยน Role ของ ธนากร พึ่งบุญ/ })).toBeVisible();
    await page.getByRole("button", { name: "ดูข้อมูล ธนากร พึ่งบุญ" }).click();
    await expect(page.getByRole("dialog", { name: "ข้อมูลผู้ใช้" }).getByText("EMP0231").first()).toBeVisible();
  });
});

test("Admin gets Forbidden on S25 and 403 from #8", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ storageState: auth("admin"), baseURL });
  const page = await ctx.newPage();
  await page.goto("/settings/users");
  await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
  expect((await page.request.get(`${API}/users`)).status()).toBe(403);
  await ctx.close();
});
