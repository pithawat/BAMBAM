import { expect, test } from "@playwright/test";
import { API, as, auth, report, tag } from "./helpers";

// F05 (Stage 4): the lead who recorded a team-handled ticket, or admin, hands it over to the
// technician — the same ticket goes back to รับเรื่อง (BR-F05-1/2/3). Real API.

async function teamTicket(baseURL: string | undefined, spot: string) {
  return report(await as("housekeeper_lead", baseURL), spot, { note: "เช็ดพื้นแล้ว" });
}

async function inTechnicianQueue(baseURL: string | undefined, ticketNo: string) {
  const technician = await as("technician", baseURL);
  const list = (await (await technician.get(`${API}/tickets?scope=all&step=awaiting_assessment&q=${ticketNo}`)).json()).data;
  return list.map((t: { ticketNo: string }) => t.ticketNo);
}

test.describe("recording lead", () => {
  test.use({ storageState: auth("housekeeper_lead") });

  test("AC5: S07 ส่งต่อให้ช่าง with a reason → same number under รอประเมิน", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const team = await teamTicket(baseURL, tag(info));
    await page.goto(`/repair/tickets/${team.id}`);
    await page.getByRole("button", { name: "ส่งต่อให้ช่าง" }).first().click();
    const dialog = page.getByRole("dialog", { name: "ส่งต่องานนี้ให้ช่าง?" });
    await expect(dialog).toContainText("งานเดิม เลขเดิม จะส่งกลับไปที่ช่าง รอช่างกำหนดวันเสร็จ");
    await dialog.getByRole("button", { name: "ส่งต่อให้ช่าง" }).click();
    await expect(dialog.getByText("กรุณาใส่เหตุผล")).toBeVisible();
    await dialog.getByLabel(/เหตุผลที่ส่งต่อ/).fill("ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า");
    await dialog.getByRole("button", { name: "ส่งต่อให้ช่าง" }).click();
    await expect(page.getByText("ส่งต่อให้ช่างแล้ว").first()).toBeVisible();

    const d = (await (await (await as("housekeeper_lead", baseURL)).get(`${API}/tickets/${team.id}`)).json()).data;
    expect(d).toMatchObject({ ticketNo: team.ticketNo, status: "in_progress", step: "awaiting_assessment", closedReason: null });
    expect(d.timeline[0]).toMatchObject({ type: "handed_over", note: "ทีมเช็ดแล้วแต่ยังมีน้ำซึมจากฝ้า" });
    expect(await inTechnicianQueue(baseURL, team.ticketNo)).toEqual([team.ticketNo]);

    const again = await (await as("housekeeper_lead", baseURL)).post(`${API}/tickets/${team.id}/handover`, { data: { reason: "อีกครั้ง" } });
    expect([again.status(), (await again.json()).error.code]).toEqual([422, "NOT_TEAM_HANDLED"]);
  });
});

test("AC5: another lead, the employee and the technician get 403", async ({ baseURL }, info) => {
  const team = await teamTicket(baseURL, tag(info));
  for (const role of ["security_lead", "employee", "technician"]) {
    const res = await (await as(role, baseURL)).post(`${API}/tickets/${team.id}/handover`, { data: { reason: "ขอส่งต่อ" } });
    expect(res.status(), role).toBe(403);
  }
  const d = (await (await (await as("admin", baseURL)).get(`${API}/tickets/${team.id}`)).json()).data;
  expect(d.status).toBe("closed");
});

test.describe("admin", () => {
  test.use({ storageState: auth("admin") });

  test("S11 closed tab: เฉพาะงานทีมทำเอง + ส่งต่อให้ช่าง on the row", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const team = await teamTicket(baseURL, tag(info));
    await page.goto(`/repair/admin/queue?tab=closed&q=${team.ticketNo}`);
    await page.getByRole("button", { name: "เฉพาะงานทีมทำเอง" }).click();
    await expect(page.getByRole("button", { name: "เฉพาะงานทีมทำเอง" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(team.ticketNo).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "ส่งต่อให้ช่าง" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "ส่งต่องานนี้ให้ช่าง?" });
    await dialog.getByLabel(/เหตุผลที่ส่งต่อ/).fill("ต้องให้ช่างตรวจท่อ");
    await dialog.getByRole("button", { name: "ส่งต่อให้ช่าง" }).click();
    await expect(page.getByText("ส่งต่อให้ช่างแล้ว").first()).toBeVisible();
    await expect(page.getByText(team.ticketNo).filter({ visible: true })).toHaveCount(0);
    expect(await inTechnicianQueue(baseURL, team.ticketNo)).toEqual([team.ticketNo]);
  });
});

