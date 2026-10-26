import { expect, test } from "@playwright/test";
import { API, as, auth, confirm, newContractor, report, resolvedTicket, tag } from "./helpers";

// F24 (Stage 2 / 3, CR-005): the technician adds and edits contractors on S18 (never deleted — deactivated,
// history kept); admin and executive read the list, scores and job history; everyone else is refused
// (BR-F24-1 / 2 / 4 / 5). Picking a contractor while assessing is covered by F21. Real API.

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC7: S18 add (name + type required, existing type reused) → search → edit → deactivate; history stays", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const technician = await as("technician", baseURL);
    const name = tag(info, "ร้านไฟฟ้ารุ่งเรือง");

    // BR-F24-2: a type name that exists (any case, spaces collapsed) returns that type
    const first = (await (await technician.post(`${API}/contractor-types`, { data: { name: "HVAC" } })).json()).data;
    const again = (await (await technician.post(`${API}/contractor-types`, { data: { name: "  hvac " } })).json()).data;
    expect(again.id).toBe(first.id);

    await page.goto("/repair/contractors");
    await page.getByRole("button", { name: "เพิ่มช่างภายนอก" }).click();
    const form = page.getByRole("dialog", { name: "เพิ่มช่างภายนอก" });
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(form.getByText("กรุณากรอกชื่อร้าน / บริษัท")).toBeVisible();
    await expect(form.getByText("เลือกประเภทอย่างน้อย 1 ประเภท")).toBeVisible();
    await form.getByLabel("ชื่อร้าน / บริษัท").fill(name);
    await form.getByLabel("เพิ่มประเภทใหม่").fill("hvac");
    await form.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(form.getByRole("button", { name: "HVAC", exact: true })).toHaveAttribute("aria-pressed", "true");
    await form.getByLabel("เบอร์โทร").fill("02-555-0101");
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("เพิ่มช่างภายนอกแล้ว")).toBeVisible();

    await page.getByLabel("ค้นหาชื่อร้าน หรือผู้ติดต่อ").fill(name);
    const row = page.getByRole("link").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("ยังไม่มีคะแนน");
    await expect(row).toContainText("0 งาน");
    await row.click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("ยังไม่มีงานที่ช่างเจ้านี้ทำ")).toBeVisible();

    await page.getByRole("button", { name: "แก้ไข" }).click();
    const edit = page.getByRole("dialog", { name: "แก้ไขช่างภายนอก" });
    await edit.getByLabel("ผู้ติดต่อ").fill("คุณรุ่งเรือง");
    await edit.getByLabel(/ใช้งานอยู่/).uncheck();
    await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
    await expect(page.getByRole("heading", { name })).toContainText("ปิดใช้งาน");
    await expect(page.getByText("คุณรุ่งเรือง")).toBeVisible();

    // Deactivated: hidden from the list unless แสดงที่ปิดใช้งาน; never deleted (BR-F24-1)
    await page.goto("/repair/contractors");
    await page.getByLabel("ค้นหาชื่อร้าน หรือผู้ติดต่อ").fill(name);
    await expect(page.getByText(`ไม่พบช่างภายนอกที่ตรงกับ "${name}"`)).toBeVisible();
    await page.getByLabel("แสดงที่ปิดใช้งาน").check();
    await expect(page.getByRole("link").filter({ hasText: name })).toContainText("ปิดใช้งาน");
  });
});

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC8 (CR-023): a name that exists is refused — ดูร้านนี้ on S18, เลือกร้านนี้ from เริ่มดำเนินการ; a deactivated one says re-activate", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const technician = await as("technician", baseURL);
    const active = await newContractor(technician, tag(info, "ร้านซ้ำ"));
    const inactive = await newContractor(technician, tag(info, "ร้านเลิกจ้าง"));
    const off = await technician.put(`${API}/contractors/${inactive.id}`, { data: { name: inactive.name, typeIds: inactive.types.map((t) => t.id), isActive: false } });
    expect(off.status()).toBe(200);

    // API: case and repeated spaces do not make a new name; the 409 names the contractor that has it
    const res = await technician.post(`${API}/contractors`, { data: { name: ` ${active.name.replace(" ", "   ")} `, typeIds: active.types.map((t) => t.id) } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "CONTRACTOR_NAME_TAKEN", details: { contractorId: active.id, isActive: true } });

    // S18: ดูร้านนี้ opens the shop that has the name
    const add = async (name: string) => {
      await page.getByRole("button", { name: "เพิ่มช่างภายนอก" }).click();
      const form = page.getByRole("dialog", { name: "เพิ่มช่างภายนอก" });
      await form.getByLabel("ชื่อร้าน / บริษัท").fill(name);
      await form.getByRole("button", { name: "แอร์", exact: true }).click();
      await form.getByRole("button", { name: "บันทึก", exact: true }).click();
      return form;
    };
    await page.goto("/repair/contractors");
    let form = await add(inactive.name);
    await expect(form.getByRole("alert")).toHaveText("มีร้านชื่อนี้แต่ปิดใช้งานอยู่ — เปิดใช้งานร้านเดิมแทนการเพิ่มใหม่");
    await expect(form.getByRole("link", { name: "ไปหน้าร้านนี้" })).toHaveAttribute("href", `/repair/contractors/${inactive.id}`);
    await form.getByRole("button", { name: "ยกเลิก" }).click();
    form = await add(active.name);
    await expect(form.getByRole("alert")).toHaveText("มีช่างภายนอกชื่อนี้แล้ว");
    await form.getByRole("link", { name: "ดูร้านนี้" }).click();
    await expect(page).toHaveURL(new RegExp(`/repair/contractors/${active.id}$`));
    await expect(page.getByRole("heading", { name: active.name })).toBeVisible();

    // S17 เพิ่มช่างภายนอกใหม่: เลือกร้านนี้ picks the existing contractor instead
    const ticket = await report(await as("employee", baseURL), tag(info));
    await page.goto(`/repair/tickets/${ticket.id}`);
    await page.getByRole("region", { name: "สิ่งที่เกิดขึ้นตอนนี้" }).getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    const dialog = page.getByRole("dialog", { name: "เริ่มดำเนินการ" });
    await dialog.getByRole("radio", { name: "ช่างภายนอก" }).click();
    await dialog.getByRole("button", { name: "เพิ่มช่างภายนอกใหม่" }).click();
    form = page.getByRole("dialog", { name: "เพิ่มช่างภายนอก" });
    await form.getByLabel("ชื่อร้าน / บริษัท").fill(active.name);
    await form.getByRole("button", { name: "แอร์", exact: true }).click();
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await form.getByRole("button", { name: "เลือกร้านนี้" }).click();
    await expect(page.getByText(`เลือก ${active.name} แล้ว`)).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /ช่างภายนอก/ })).toContainText(active.name);
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    expect((await (await as("admin", baseURL)).post(`${API}/tickets/${ticket.id}/close`, { data: { reason: "ล้างข้อมูลทดสอบ" } })).status()).toBe(200);
  });
});

for (const role of ["admin", "executive"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });

    test(`AC7: ${role} reads the list, score and job history; no add or edit`, async ({ page, baseURL }, info) => {
      test.slow(); // first visits compile on `next dev`
      const contractor = await newContractor(await as("technician", baseURL), tag(info, "ร้านแอร์ดูอย่างเดียว"));
      const ticket = await resolvedTicket(baseURL, tag(info), contractor.id);
      await confirm(await as("employee", baseURL), ticket.id, 3);

      await page.goto("/repair/contractors");
      await expect(page.getByRole("heading", { name: "ช่างภายนอก" })).toBeVisible();
      await expect(page.getByRole("button", { name: "เพิ่มช่างภายนอก" })).toHaveCount(0);
      await page.getByLabel("ค้นหาชื่อร้าน หรือผู้ติดต่อ").fill(contractor.name);
      const row = page.getByRole("link").filter({ hasText: contractor.name });
      await expect(row).toContainText("4.0");
      await expect(row).toContainText("1 งาน");
      await row.click();
      await expect(page.getByRole("heading", { name: "ประวัติงาน (1)" })).toBeVisible();
      await expect(page.getByText(ticket.ticketNo)).toBeVisible();
      await expect(page.getByText("ผู้แจ้งให้ 3 ดาว")).toBeVisible();
      await expect(page.getByRole("button", { name: "แก้ไข" })).toHaveCount(0);

      const res = await (await as(role, baseURL)).post(`${API}/contractors`, { data: { name: "ร้านใหม่", typeIds: contractor.types.map((t) => t.id) } });
      expect([res.status(), (await res.json()).error.code]).toEqual([403, "NOT_TECHNICIAN"]);
    });
  });
}

for (const role of ["employee", "housekeeper_lead"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });

    test(`AC7: ${role} gets the forbidden state on S18; the API refuses`, async ({ page, baseURL }) => {
      test.slow(); // first visits compile on `next dev`
      await page.goto("/repair/contractors");
      await expect(page.getByText("คุณไม่มีสิทธิ์เข้าหน้านี้")).toBeVisible();
      await expect(page.getByLabel("ค้นหาชื่อร้าน หรือผู้ติดต่อ")).toHaveCount(0);
      const api = await as(role, baseURL);
      expect((await api.get(`${API}/contractors`)).status()).toBe(403);
      expect((await api.get(`${API}/contractor-types`)).status()).toBe(403);
    });
  });
}
