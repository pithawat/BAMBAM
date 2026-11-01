import { expect, test, type Page } from "@playwright/test";
import { API, as, auth, confirm, resolve, resolvedTicket, sendBack, tag, attachVia } from "./helpers";

// F07 (Stage 2 / 2R / 2N, CR-005 / CR-008 / CR-009 / CR-012): only the reporter rates a resolved ticket —
// 1–5 stars required, never preselected — or sends it back with a reason; a send back moves the ticket on to
// ส่งกลับให้แก้ with the same technician. Auto-close after 72 h runs in the API worker (not driven here). Real API.

const nextAction = (page: Page) => page.getByRole("region", { name: "สิ่งที่เกิดขึ้นตอนนี้" });
const progress = (page: Page) => page.getByRole("region", { name: "ความคืบหน้าของงาน" });

test.describe("reporter", () => {
  test.use({ storageState: auth("employee") });

  test("AC4 + AC8: the star tapped opens S08 with that score; no score = no submit; 4 stars closes as ประเมินตรวจงานแล้ว", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await resolvedTicket(baseURL, tag(info));

    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(page.getByRole("tab", { name: "ผลการซ่อม" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง").first()).toBeVisible();
    await expect(progress(page).locator('[aria-current="step"]')).toContainText("รอคุณประเมินตรวจงาน");

    // ประเมินพร้อมความคิดเห็น opens with no score; the button waits for a star (BR-F07-2 / BR-F07-7)
    await page.getByRole("button", { name: /ประเมินพร้อมความคิดเห็น/ }).click();
    let dialog = page.getByRole("dialog", { name: "ประเมินงานซ่อม" });
    await expect(dialog.getByText("ยังไม่ได้เลือกคะแนน")).toBeVisible();
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "ยืนยันผลประเมิน" })).toBeDisabled();
    await page.keyboard.press("Escape");

    // A star on the band opens S08 with that score; 1–2 stars suggest ส่งกลับให้แก้แทน
    await page.getByRole("group", { name: "เลือกคะแนนเพื่อเปิดแบบประเมิน" }).getByRole("button", { name: /^ประเมิน 2 ดาว/ }).click();
    dialog = page.getByRole("dialog", { name: "ประเมินงานซ่อม" });
    await expect(dialog.getByRole("radio", { name: /^2 ดาว/ })).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByRole("button", { name: "ส่งกลับให้แก้แทน" })).toBeVisible();
    await dialog.getByRole("radio", { name: /^4 ดาว/ }).click();
    await expect(dialog.getByText("4 / 5 · ดีมาก")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ส่งกลับให้แก้แทน" })).toHaveCount(0);
    await dialog.getByLabel(/มีอะไรอยากบอกเราเพิ่มเติม/).fill("ช่างมาไว อธิบายสิ่งที่ทำ");
    await dialog.getByRole("button", { name: "ยืนยันผลประเมิน" }).click();
    await expect(page.getByText("ขอบคุณที่ประเมินตรวจงาน งานนี้ปิดแล้ว")).toBeVisible();
    await expect(progress(page)).toContainText("คุณให้ 4 ดาว · ดีมาก");
    await expect(page.getByRole("group", { name: "เลือกคะแนนเพื่อเปิดแบบประเมิน" })).toHaveCount(0);

    const d = (await (await (await as("employee", baseURL)).get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(d).toMatchObject({ status: "closed", closedReason: "confirmed", rating: 4, ratingComment: "ช่างมาไว อธิบายสิ่งที่ทำ", allowedActions: [] });
    expect(d.timeline[0]).toMatchObject({ type: "confirmed", data: { rating: 4 } });

    // S06 shows how it closed
    await page.goto(`/repair/my?q=${ticket.ticketNo}`);
    await expect(page.getByText("ประเมินตรวจงานแล้ว · 4/5").filter({ visible: true })).toBeVisible();
  });

  test("AC5: ส่งกลับให้แก้ needs a reason → ส่งกลับให้แก้ step with the same technician", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await resolvedTicket(baseURL, tag(info));

    await page.goto(`/repair/tickets/${ticket.id}`);
    await page.getByRole("button", { name: /ส่งกลับให้แก้/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "ส่งกลับให้ช่างแก้ไข" });
    await dialog.getByRole("button", { name: "ส่งกลับให้แก้" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("กรุณาบอกสิ่งที่ยังไม่เรียบร้อย");
    await dialog.getByLabel(/ยังพบปัญหาอะไร/).fill("ยังมีน้ำหยดเมื่อเปิดแอร์เกิน 1 ชั่วโมง");
    await attachVia(page, dialog.locator("input[type=file]").first());
    await dialog.getByRole("button", { name: "ส่งกลับให้แก้" }).click();
    await expect(page.getByText("ส่งกลับให้ช่างแล้ว")).toBeVisible();
    await expect(nextAction(page)).toContainText("ส่งกลับให้แก้แล้ว");
    await expect(progress(page).locator('[aria-current="step"]')).toContainText("ส่งกลับให้แก้");
    await expect(progress(page)).toContainText("ยังมีน้ำหยดเมื่อเปิดแอร์เกิน 1 ชั่วโมง");

    const d = (await (await (await as("employee", baseURL)).get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(d).toMatchObject({ status: "in_progress", step: "reworking", sendBackCount: 1, allowedActions: [] });
    expect(d.timeline[0]).toMatchObject({ type: "sent_back", note: "ยังมีน้ำหยดเมื่อเปิดแอร์เกิน 1 ชั่วโมง" });
    expect(d.timeline[0].photos).toHaveLength(1);
    const queue = (await (await (await as("technician", baseURL)).get(`${API}/tickets?scope=all&step=reworking&q=${ticket.ticketNo}`)).json()).data;
    expect(queue.map((t: { ticketNo: string }) => t.ticketNo)).toEqual([ticket.ticketNo]);
    await resolve(await as("technician", baseURL), ticket.id);
    await confirm(await as("employee", baseURL), ticket.id);
  });
});

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("AC5: after a send back the technician sees the reason, records the fix again; the reporter closes it", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const ticket = await resolvedTicket(baseURL, tag(info));
    await sendBack(await as("employee", baseURL), ticket.id, "ยังมีเสียงดังตอนเปิดแอร์");

    await page.goto(`/repair/tickets/${ticket.id}`);
    await expect(nextAction(page)).toContainText("ผู้แจ้งส่งกลับให้แก้");
    await expect(nextAction(page)).toContainText("ยังมีเสียงดังตอนเปิดแอร์");
    await nextAction(page).getByRole("button", { name: "บันทึกผลอีกครั้ง" }).click();
    const sheet = page.getByRole("dialog", { name: "บันทึกผลการแก้ไข" });
    await attachVia(page, sheet.locator("input[type=file]"));
    await sheet.getByLabel("รายละเอียดการซ่อม").fill("ขันน็อตยึดคอยล์ร้อน เสียงหายแล้ว");
    await sheet.getByRole("button", { name: "ส่งผลการซ่อม" }).click();
    await expect(page.getByText("ส่งผลแล้ว รอผู้แจ้งตรวจรับ")).toBeVisible();

    const employee = await as("employee", baseURL);
    const d = (await (await employee.get(`${API}/tickets/${ticket.id}`)).json()).data;
    expect(d).toMatchObject({ status: "resolved", step: "awaiting_rating", sendBackCount: 1, allowedActions: ["confirm", "send_back"] });
    expect(d.result.note).toBe("ขันน็อตยึดคอยล์ร้อน เสียงหายแล้ว");
    expect(d.timeline.map((e: { type: string }) => e.type).slice(0, 3)).toEqual(["resolved", "sent_back", "resolved"]);
    await confirm(employee, ticket.id, 5);
    await page.reload();
    await expect(progress(page)).toContainText("ส่งกลับ 1 ครั้ง · ช่างแก้ไขแล้ว");
  });
});

test("API: only the reporter rates or sends back; stars 1–5 required; a reason required; a closed ticket refuses", async ({ baseURL }, info) => {
  const employee = await as("employee", baseURL);
  const ticket = await resolvedTicket(baseURL, tag(info));
  const post = async (role: string, action: string, data: object) => {
    const res = await (role === "employee" ? employee : await as(role, baseURL)).post(`${API}/tickets/${ticket.id}/${action}`, { data });
    return [res.status(), (await res.json()).error] as const;
  };

  for (const role of ["technician", "admin", "security_lead"]) {
    expect((await post(role, "confirm", { rating: 5 }))[1].code, role).toBe("NOT_REPORTER");
    expect((await post(role, "send-back", { reason: "ยังไม่ดี", photoIds: [] }))[1].code, role).toBe("NOT_REPORTER");
  }
  let [status, error] = await post("employee", "confirm", {});
  expect([status, error.fields]).toEqual([400, { rating: "REQUIRED" }]);
  [status, error] = await post("employee", "confirm", { rating: 6 });
  expect([status, error.fields]).toEqual([400, { rating: "INVALID" }]);
  [status, error] = await post("employee", "send-back", { reason: " ", photoIds: [] });
  expect([status, error.fields]).toEqual([400, { reason: "REQUIRED" }]);
  await confirm(employee, ticket.id, 4);
  [status, error] = await post("employee", "confirm", { rating: 4 });
  expect([status, error.code]).toEqual([409, "TICKET_CLOSED"]);
  [status, error] = await post("employee", "send-back", { reason: "ยังไม่ดี", photoIds: [] });
  expect([status, error.code]).toEqual([409, "TICKET_CLOSED"]);
});
