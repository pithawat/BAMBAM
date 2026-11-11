import { expect, test, type Page } from "@playwright/test";
import { API, as, assess, attachVia, auth, bangkokDay, confirm, myId, report, resolve, sendBack, tag } from "./helpers";

// CR-034 (Stage 5P) on F21: S17 `ประเภทผู้ดำเนินการซ่อม` + required `ช่างผู้รับผิดชอบ` (#36, default = me), the
// reschedule reason is required except on the re-accept after a send back, S10 shows the responsible technician
// and `รายละเอียดการซ่อม`. Real API.

const nextAction = (page: Page) => page.getByRole("region", { name: "สิ่งที่เกิดขึ้นตอนนี้" });

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC4 + AC5 + AC6: picker defaults to me; reschedule needs a reason; S10 card + รายละเอียดการซ่อม", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const employee = await as("employee", baseURL);
    const technician = await as("technician", baseURL);
    const me = (await (await technician.get("/api/v1/me")).json()).data as { id: string; name: string };
    const ticket = await report(employee, tag(info));

    // #36 lists users whose role has repair.ticket.work — the technician, not the employee
    const techs = (await (await technician.get(`${API}/technicians`)).json()).data as { id: string; roleName: string }[];
    expect(techs.find((t) => t.id === me.id)).toMatchObject({ roleName: "ช่างเทคนิค" });
    expect(techs.map((t) => t.id)).not.toContain(await myId(employee));
    expect((await employee.get(`${API}/technicians`)).status()).toBe(403);

    await page.goto(`/repair/tickets/${ticket.id}`);
    await nextAction(page).getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    const dialog = page.getByRole("dialog", { name: "เริ่มดำเนินการ" });
    await expect(dialog.getByText("ประเภทผู้ดำเนินการซ่อม", { exact: false }).first()).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /ช่างผู้รับผิดชอบ/ })).toContainText(`${me.name} (ฉัน)`);
    await dialog.getByRole("radio", { name: /^พรุ่งนี้/ }).click();
    await dialog.getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    await expect(page.getByText("เริ่มดำเนินการแล้ว ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จในหน้างาน")).toBeVisible();
    const assessed = (await (await technician.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(assessed.assignee).toMatchObject({ id: me.id, name: me.name, roleName: "ช่างเทคนิค" });
    await expect(page.getByText("ช่างผู้รับผิดชอบ", { exact: true })).toBeVisible();

    // เลื่อนวันเสร็จ: a new date without a reason is blocked
    await nextAction(page).getByRole("button", { name: "เลื่อนวันเสร็จ" }).click();
    const move = page.getByRole("dialog", { name: "เลื่อนวันที่คาดว่าจะเสร็จ" });
    await expect(move.getByText("ไม่บังคับ · ผู้แจ้งเห็นข้อความนี้")).toHaveCount(0);
    await move.getByRole("radio", { name: /^อีก 3 วัน/ }).click();
    await move.getByRole("button", { name: "บันทึกวันใหม่" }).click();
    await expect(move.getByRole("alert").filter({ hasText: "กรุณาใส่เหตุผลที่เลื่อน" })).toBeVisible();
    await move.getByLabel(/เหตุผลที่เลื่อน/).fill("รออะไหล่จากร้าน");
    await move.getByRole("button", { name: "บันทึกวันใหม่" }).click();
    await expect(page.getByText("บันทึกวันใหม่แล้ว ผู้แจ้งจะเห็นวันใหม่ในหน้างาน")).toBeVisible();

    // S10: the responsible technician card and the new label
    await nextAction(page).getByRole("button", { name: "บันทึกผลซ่อม" }).click();
    const sheet = page.getByRole("dialog", { name: "บันทึกผลซ่อม" });
    await expect(sheet.getByRole("region", { name: "ช่างผู้รับผิดชอบ" })).toContainText(me.name);
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(sheet.getByRole("alert").filter({ hasText: "กรุณาใส่รายละเอียดการซ่อม" })).toBeVisible();
    await attachVia(page, sheet.locator("input[type=file]"));
    await sheet.getByLabel("รายละเอียดการซ่อม").fill("เปลี่ยนมอเตอร์พัดลมคอยล์เย็น");
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(page.getByText("ส่งผลแล้ว รอผู้แจ้งตรวจรับ")).toBeVisible();
    await confirm(employee, ticket.id);
  });

  test("AC4 + AC5 (API): assigneeId required / must work tickets; reason required on reschedule, not on re-accept", async ({ baseURL }, info) => {
    const employee = await as("employee", baseURL);
    const technician = await as("technician", baseURL);
    const admin = await as("admin", baseURL);
    const ticket = await report(employee, tag(info));
    const post = (data: object) => technician.post(`${API}/tickets/${ticket.id}/assess`, { data });

    const missing = await post({ expectedDoneOn: bangkokDay(1), workBy: "in_house" });
    expect([missing.status(), (await missing.json()).error.fields]).toEqual([400, { assigneeId: "REQUIRED" }]);
    const invalid = await post({ expectedDoneOn: bangkokDay(1), workBy: "in_house", assigneeId: await myId(admin) });
    expect([invalid.status(), (await invalid.json()).error.code]).toEqual([422, "ASSIGNEE_INVALID"]);

    await assess(technician, ticket.id, { on: bangkokDay(1) });
    const noReason = await post({ expectedDoneOn: bangkokDay(2), workBy: "in_house", assigneeId: await myId(technician) });
    expect([noReason.status(), (await noReason.json()).error.fields]).toEqual([400, { reason: "REQUIRED" }]);
    await assess(technician, ticket.id, { on: bangkokDay(2), reason: "รออะไหล่" });

    // Re-accept after a send back: a new date without a reason is fine
    await resolve(technician, ticket.id);
    await sendBack(employee, ticket.id);
    const reaccept = await assess(technician, ticket.id, { on: bangkokDay(4) });
    expect(reaccept).toMatchObject({ step: "reworking", expectedDoneOn: bangkokDay(4) });
    await resolve(technician, ticket.id);
    await confirm(employee, ticket.id);
  });
});
