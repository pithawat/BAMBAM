import { expect, test, type Page } from "@playwright/test";
import { API, as, assess, auth, bangkokDay, bangkokToday, confirm, myId, newContractor, report, resolve, sendBack, tag, uploadPhoto, attachVia } from "./helpers";

// F21 (Stage 2, CR-005 / CR-006 / CR-008 / CR-009): the one in-house technician sees every open ticket oldest
// first; เริ่มดำเนินการ sets the expected date and who does the work (ช่างของบริษัท, or a ช่างภายนอก picked or
// added in the dialog); บันทึกผลซ่อม needs after photos and, for a contractor job, the contractor stars. The
// reporter never gets the contractor's name or score (BR-F24-4). Every ticket ends closed. Real API.

const nextAction = (page: Page) => page.getByRole("region", { name: "สิ่งที่เกิดขึ้นตอนนี้" });

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC1 + AC2: S09 รับเรื่อง oldest first; บันทึกผลซ่อม waits for เริ่มดำเนินการ; in-house job resolved with an after photo", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const employee = await as("employee", baseURL);
    const technician = await as("technician", baseURL);
    const ticket = await report(employee, tag(info));

    // S09: every open ticket, รับเรื่อง = waiting for the date, oldest report first (BR-F21-1, CR-015)
    const queue = (await (await technician.get(`${API}/tickets?scope=all&step=awaiting_assessment&sort=createdAt:asc`)).json()).data as { ticketNo: string; createdAt: string }[];
    expect(queue.map((t) => t.createdAt)).toEqual(queue.map((t) => t.createdAt).sort());
    const mine = (await (await technician.get(`${API}/tickets?scope=all&step=awaiting_assessment&q=${ticket.ticketNo}`)).json()).data;
    expect(mine.map((t: { ticketNo: string }) => t.ticketNo)).toEqual([ticket.ticketNo]);
    await page.goto("/repair/work");
    await expect(page.getByRole("heading", { name: "งานซ่อม", level: 1 })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^รับเรื่อง \d+$/ })).toBeChecked();
    await expect(page.getByRole("link", { name: /.+/ }).filter({ hasText: queue[0].ticketNo }).first()).toBeVisible();
    await expect(page.getByText(/แสดง \d+ จาก \d+ งาน/)).toBeVisible();

    // Not assessed yet: no บันทึกผลซ่อม, the S10 link is blocked, the API refuses (BR-F21-4)
    const early = await technician.post(`${API}/tickets/${ticket.id}/resolve`, { data: { note: "ซ่อมแล้ว", photoIds: [await uploadPhoto(technician)] } });
    expect([early.status(), (await early.json()).error.code]).toEqual([422, "ASSESSMENT_REQUIRED"]);
    await page.goto(`/repair/tickets/${ticket.id}/resolve`);
    await expect(page.getByText("บันทึกผลงานนี้ไม่ได้ตอนนี้")).toBeVisible();
    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(nextAction(page).getByRole("button", { name: "เริ่มดำเนินการ" })).toBeVisible();
    await expect(page.getByRole("button", { name: "บันทึกผลซ่อม" })).toHaveCount(0);

    // S17 เริ่มดำเนินการ: the date is required; ช่างของบริษัท is the default
    await nextAction(page).getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    const dialog = page.getByRole("dialog", { name: "เริ่มดำเนินการ" });
    await expect(dialog.getByRole("radio", { name: "ช่างของบริษัท" })).toBeChecked();
    await dialog.getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("เลือกวันที่คาดว่าจะเสร็จ");
    await dialog.getByRole("radio", { name: /^พรุ่งนี้/ }).click();
    await dialog.getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    await expect(page.getByText("เริ่มดำเนินการแล้ว ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จในหน้างาน")).toBeVisible();
    await expect(nextAction(page)).toContainText("คุณกำลังซ่อมงานนี้ · คาดว่าจะเสร็จ");
    await expect(nextAction(page).getByRole("button", { name: "เลื่อนวันเสร็จ" })).toBeVisible();

    // The reporter now sees the date (AC2)
    const seen = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(seen).toMatchObject({ step: "in_repair", expectedDoneOn: bangkokDay(1), workBy: "in_house", contractor: null });
    expect(seen.timeline[0]).toMatchObject({ type: "assessed", data: { workBy: "in_house", expectedDoneOn: bangkokDay(1) } });

    // S10 บันทึกผลซ่อม: after photo + what was done are required; no contractor stars for an in-house job
    await nextAction(page).getByRole("button", { name: "บันทึกผลซ่อม" }).click();
    const sheet = page.getByRole("dialog", { name: "บันทึกผลซ่อม" });
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(sheet.getByRole("alert").filter({ hasText: "ถ่ายหรือแนบรูปหลังซ่อมอย่างน้อย 1 รูป" })).toBeVisible();
    await expect(sheet.getByRole("alert").filter({ hasText: "กรุณาใส่รายละเอียดการซ่อม" })).toBeVisible();
    await expect(sheet.getByText("คะแนนช่างภายนอก")).toHaveCount(0);
    await attachVia(page, sheet.locator("input[type=file]"));
    await sheet.getByLabel("รายละเอียดการซ่อม").fill("ล้างแผงคอยล์เย็น เติมน้ำยา ทดสอบ 30 นาที");
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(page.getByText("ส่งผลแล้ว รอผู้แจ้งตรวจรับ")).toBeVisible();

    const done = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(done).toMatchObject({ status: "resolved", step: "awaiting_rating", allowedActions: ["confirm", "send_back"] });
    expect(done.result.note).toBe("ล้างแผงคอยล์เย็น เติมน้ำยา ทดสอบ 30 นาที");
    expect(done.result.photos).toHaveLength(1);
    // BR-F07-4: closes by itself 72 h after resolved
    expect(Math.abs(Date.parse(done.autoCloseAt) - Date.parse(done.resolvedAt) - 72 * 3600_000)).toBeLessThan(1000);
    await confirm(employee, ticket.id);
  });

  test("AC3 + F24: ช่างภายนอก needs a contractor — เพิ่มช่างภายนอกใหม่ in the dialog; resolve needs its stars; the reporter never sees the name or score", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const employee = await as("employee", baseURL);
    const technician = await as("technician", baseURL);
    const ticket = await report(employee, tag(info));
    const name = tag(info, "ร้านแอร์เย็นฉ่ำ");

    await page.goto(`/repair/tickets/${ticket.id}`);
    await nextAction(page).getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    const dialog = page.getByRole("dialog", { name: "เริ่มดำเนินการ" });
    await dialog.getByRole("radio", { name: /^อีก 3 วัน/ }).click();
    await dialog.getByRole("radio", { name: "ช่างภายนอก" }).click();
    await dialog.getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("เลือกช่างภายนอก");

    // S18 form inside the dialog: name + at least one type; an existing type name gives that type (BR-F24-1/2)
    await dialog.getByRole("button", { name: "เพิ่มช่างภายนอกใหม่" }).click();
    const form = page.getByRole("dialog", { name: "เพิ่มช่างภายนอก" });
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(form.getByText("กรุณากรอกชื่อร้าน / บริษัท")).toBeVisible();
    await expect(form.getByText("เลือกประเภทอย่างน้อย 1 ประเภท")).toBeVisible();
    await form.getByLabel("ชื่อร้าน / บริษัท").fill(name);
    await form.getByLabel("เพิ่มประเภทใหม่").fill("แอร์");
    await form.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(form.getByRole("button", { name: "แอร์", exact: true })).toHaveAttribute("aria-pressed", "true");
    await form.getByLabel("ผู้ติดต่อ").fill("คุณสมชาย");
    await form.getByLabel("เบอร์โทร").fill("081-234-5678");
    await form.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("เพิ่มช่างภายนอกแล้ว")).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /ช่างภายนอก/ })).toContainText(name);
    await dialog.getByRole("button", { name: "เริ่มดำเนินการ" }).click();
    await expect(page.getByText("เริ่มดำเนินการแล้ว ผู้แจ้งจะเห็นวันที่คาดว่าจะเสร็จในหน้างาน")).toBeVisible();
    await expect(page.getByText(`ช่างภายนอก · ${name} · แอร์`)).toBeVisible();

    // The reporter gets the type only (BR-F24-4)
    const seen = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(seen).toMatchObject({ workBy: "contractor", contractor: null, expectedDoneOn: bangkokDay(3) });
    expect(seen.contractorTypes).toContain("แอร์");
    expect(JSON.stringify(seen)).not.toContain(name);

    // S10: the contractor stars are required for a contractor job (BR-F24-3)
    await nextAction(page).getByRole("button", { name: "บันทึกผลซ่อม" }).click();
    const sheet = page.getByRole("dialog", { name: "บันทึกผลซ่อม" });
    await attachVia(page, sheet.locator("input[type=file]"));
    await sheet.getByLabel("รายละเอียดการซ่อม").fill("ช่างภายนอกเปลี่ยนคอมเพรสเซอร์");
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(sheet.getByRole("alert").filter({ hasText: "ให้คะแนนช่างภายนอก" })).toBeVisible();
    await sheet.getByRole("radiogroup", { name: "คะแนน 1 ถึง 5 ดาว" }).getByRole("radio", { name: /^4 ดาว/ }).click();
    await sheet.getByLabel("ความเห็นต่อช่างภายนอก").fill("มาตรงเวลา งานเรียบร้อย");
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(page.getByText("ส่งผลแล้ว รอผู้แจ้งตรวจรับ")).toBeVisible();

    const staff = (await (await technician.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(staff.result).toMatchObject({ contractorRating: 4, contractorRatingComment: "มาตรงเวลา งานเรียบร้อย" });
    const reporter = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(reporter.result).toMatchObject({ contractorRating: null, contractorRatingComment: null });
    expect(JSON.stringify(reporter)).not.toContain(name);

    // S18: the job and both scores land in the contractor's history (BR-F24-5)
    await confirm(employee, ticket.id, 5);
    await page.goto(`/repair/contractors/${staff.contractor.id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ประวัติงาน (1)" })).toBeVisible();
    await expect(page.getByText(ticket.ticketNo)).toBeVisible();
    await expect(page.getByText("มาตรงเวลา งานเรียบร้อย")).toBeVisible();
    await expect(page.getByText("ผู้แจ้งให้ 5 ดาว")).toBeVisible();
  });

  test("AC3b: เลื่อนวันเสร็จ switches ช่างภายนอก → ช่างของบริษัท with a reason; the timeline keeps the change", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const employee = await as("employee", baseURL);
    const technician = await as("technician", baseURL);
    const contractor = await newContractor(technician, tag(info, "ร้านช่างนอก"));
    const ticket = await report(employee, tag(info));
    await assess(technician, ticket.id, { contractorId: contractor.id });

    await page.goto(`/repair/tickets/${ticket.id}`);
    await nextAction(page).getByRole("button", { name: "เลื่อนวันเสร็จ" }).click();
    const dialog = page.getByRole("dialog", { name: "เลื่อนวันที่คาดว่าจะเสร็จ" });
    await expect(dialog.getByRole("radio", { name: "ช่างภายนอก" })).toBeChecked();
    await dialog.getByRole("radio", { name: /^พรุ่งนี้/ }).click();
    await dialog.getByRole("radio", { name: "ช่างของบริษัท" }).click();
    await dialog.getByLabel(/เหตุผลที่เลื่อน/).fill("ช่างนอกไม่มา ช่างบริษัททำเอง");
    await dialog.getByRole("button", { name: "บันทึกวันใหม่" }).click();
    await expect(page.getByText("บันทึกวันใหม่แล้ว ผู้แจ้งจะเห็นวันใหม่ในหน้างาน")).toBeVisible();
    await expect(page.getByRole("region", { name: "ความคืบหน้าของงาน" })).toContainText("ช่างนอกไม่มา ช่างบริษัททำเอง");

    const d = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(d).toMatchObject({ workBy: "in_house", contractorTypes: [], expectedDoneOn: bangkokDay(1) });
    expect(d.timeline[0]).toMatchObject({ type: "assessment_changed", data: { workBy: "in_house", reason: "ช่างนอกไม่มา ช่างบริษัททำเอง" } });
    expect(d.timeline[1]).toMatchObject({ type: "assessed", data: { workBy: "contractor" } });
    await resolve(technician, ticket.id);
    await confirm(employee, ticket.id);
  });
});

test("API: technician only; date today or later; an active contractor; its stars kept for the same contractor, asked again for another", async ({ baseURL }, info) => {
  const employee = await as("employee", baseURL);
  const technician = await as("technician", baseURL);
  const ticket = await report(employee, tag(info));
  const post = (api: typeof technician, action: string, data: object) => api.post(`${API}/tickets/${ticket.id}/${action}`, { data });
  const err = async (res: Awaited<ReturnType<typeof post>>) => [res.status(), (await res.json()).error] as const;
  const assigneeId = await myId(technician); // CR-034: in-house needs the responsible technician

  for (const role of ["employee", "admin", "housekeeper_lead"]) {
    const [status, error] = await err(await post(await as(role, baseURL), "assess", { expectedDoneOn: bangkokToday(), workBy: "in_house" }));
    expect([status, error.code], role).toEqual([403, "NOT_TECHNICIAN"]);
  }
  let [status, error] = await err(await post(technician, "assess", { expectedDoneOn: bangkokDay(-1), workBy: "in_house", assigneeId }));
  expect([status, error.fields]).toEqual([400, { expectedDoneOn: "PAST" }]);
  [status, error] = await err(await post(technician, "assess", { expectedDoneOn: bangkokToday(), workBy: "contractor" }));
  expect([status, error.fields]).toEqual([400, { contractorId: "REQUIRED" }]);

  // A deactivated contractor cannot be picked (BR-F24-1, F21 edge case)
  const off = await newContractor(technician, tag(info, "ร้านเลิกจ้าง"));
  const put = await technician.put(`${API}/contractors/${off.id}`, { data: { name: off.name, typeIds: off.types.map((t) => t.id), isActive: false } });
  expect(put.status()).toBe(200);
  [status, error] = await err(await post(technician, "assess", { expectedDoneOn: bangkokToday(), workBy: "contractor", contractorId: off.id }));
  expect([status, error.code]).toEqual([422, "CONTRACTOR_NOT_FOUND"]);

  // Contractor job: stars required; a send back keeps them for the same contractor; another contractor clears them
  const a = await newContractor(technician, tag(info, "ร้านเอ"));
  const b = await newContractor(technician, tag(info, "ร้านบี"));
  await assess(technician, ticket.id, { contractorId: a.id });
  [status, error] = await err(await post(technician, "resolve", { note: "ซ่อมแล้ว", photoIds: [await uploadPhoto(technician)] }));
  expect([status, error.fields]).toEqual([400, { contractorRating: "REQUIRED" }]);
  await resolve(technician, ticket.id, 3);
  await sendBack(employee, ticket.id);
  expect((await resolve(technician, ticket.id)).result).toMatchObject({ contractorRating: 3 });
  await sendBack(employee, ticket.id);
  await assess(technician, ticket.id, { contractorId: b.id });
  [status, error] = await err(await post(technician, "resolve", { note: "ร้านบีซ่อม", photoIds: [await uploadPhoto(technician)] }));
  expect([status, error.fields]).toEqual([400, { contractorRating: "REQUIRED" }]);
  await resolve(technician, ticket.id, 5);
  await confirm(employee, ticket.id);
  [status, error] = await err(await post(technician, "assess", { expectedDoneOn: bangkokToday(), workBy: "in_house", assigneeId }));
  expect([status, error.code]).toEqual([409, "TICKET_CLOSED"]);
});

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("S09 is the technician's page: the employee gets the forbidden state", async ({ page }) => {
    test.slow(); // first visits compile on `next dev`
    await page.goto("/repair/work");
    await expect(page.getByText("หน้านี้สำหรับช่างเท่านั้น")).toBeVisible();
  });
});
