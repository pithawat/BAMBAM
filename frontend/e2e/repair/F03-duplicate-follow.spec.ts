import { expect, test } from "@playwright/test";
import { API, as, attachPhoto, auth, bangkokToday, fillPlace, placeIds, postTicket, report, tag, uploadPhoto } from "./helpers";

// F03 (Stage 4, CR-009 / CR-020 / CR-021): duplicate = same category + floor + room with no extra spot or the
// same spot → follow the old case; another spot is only similar and can be sent. A duplicate found while filling
// stops ถัดไป at the สถานที่ step (CR-021); the S04 dialog on send covers a case reported meanwhile. Real API.

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("AC6 (CR-021): same spot → card between room and spot, ถัดไป blocked until another spot", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const spot = tag(info, "ฝั่งหน้าต่าง");
    const old = await report(await as("security_lead", baseURL), spot);

    await fillPlace(page, `  ${spot} `);
    const location = page.locator('[data-step="location"]');
    const card = location.getByRole("region", { name: "มีคนแจ้งเรื่องนี้ไว้แล้ว" });
    await expect(card).toContainText(old.ticketNo);
    await expect(card).toContainText("จึงแจ้งซ้ำไม่ได้");
    await expect(card).toContainText(/พบ \d+ งาน/);
    await expect(card).toContainText('ถ้าเป็นคนละจุดในห้องนี้ ให้ระบุที่ "บอกจุดเพิ่มเติม"');
    await expect(location.getByText("จำเป็นเมื่อพบงานที่ตรงกัน")).toBeVisible();

    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(location.getByText("กรุณาระบุจุดที่ต่างจากงานเดิม ก่อนดำเนินการต่อ")).toBeVisible();
    await expect(location.getByLabel("บอกจุดเพิ่มเติม")).toBeFocused();
    await expect(page.locator('[data-step="send"]')).toBeHidden();

    await location.getByLabel("บอกจุดเพิ่มเติม").fill(tag(info, "แอร์ตัวหน้าห้อง"));
    await expect(location.getByRole("region", { name: "มีงานคล้ายกันในห้องนี้" })).toContainText(old.ticketNo);
    await expect(location.getByText("กรุณาระบุจุดที่ต่างจากงานเดิม ก่อนดำเนินการต่อ")).toHaveCount(0);
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(page.locator('[data-step="send"]').getByRole("heading", { level: 2 })).toBeVisible();
  });

  test("AC1: a case reported meanwhile → S04 on send → follow → S07 timeline and S06", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const spot = tag(info, "ฝั่งหน้าต่าง");
    await fillPlace(page, spot);
    await attachPhoto(page);
    const old = await report(await as("security_lead", baseURL), spot);

    await page.locator('[data-step="send"]').getByLabel("เล่ารายละเอียดเพิ่ม").fill("ห้องนี้แอร์ไม่เย็นเหมือนกัน");
    await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
    const dialog = page.getByRole("dialog", { name: "มีคนแจ้งเรื่องนี้ไว้แล้ว" });
    await expect(dialog).toContainText(old.ticketNo);
    await expect(dialog.getByRole("button", { name: "ยกเลิกการแจ้ง" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /ไม่ใช่เรื่องเดียวกัน/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "ติดตามเคสนี้" }).click();

    // The toast shows while S07 loads (it can outlive a cold compile only briefly), so check it first.
    await expect(page.getByText(`คุณติดตามเคส ${old.ticketNo} แล้ว`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/repair/tickets/${old.id}$`), { timeout: 30_000 });
    await expect(page.getByText("ห้องนี้แอร์ไม่เย็นเหมือนกัน").first()).toBeVisible();

    const me = await as("employee", baseURL);
    const detail = (await (await me.get(`${API}/tickets/${old.id}`)).json()).data;
    expect(detail.viewerRelation).toBe("subscriber");
    expect(detail.timeline[0]).toMatchObject({ type: "subscribed", note: "ห้องนี้แอร์ไม่เย็นเหมือนกัน" });
    expect(detail.timeline[0].photos).toHaveLength(1);
    expect(detail.allowedActions).not.toContain("confirm");

    await page.goto(`/repair/my?scope=following&q=${old.ticketNo}`);
    await expect(page.getByText("คุณติดตามเคสนี้").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("AC2 (CR-020): another spot → similar card → a new ticket is created", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const old = await report(await as("security_lead", baseURL), tag(info, "แอร์ตัวริมหน้าต่าง"));
    await fillPlace(page, tag(info, "แอร์ตัวหน้าห้อง"));
    const card = page.getByRole("region", { name: "มีงานคล้ายกันในห้องนี้" }).filter({ visible: true }).first();
    await expect(card).toContainText(old.ticketNo);
    await attachPhoto(page);
    await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
    await expect(page).toHaveURL(/\/repair\/new\/done\?id=/, { timeout: 15_000 });
  });

  test("same spot found while filling: the card blocks the step, leaving asks to discard", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const spot = tag(info);
    await report(await as("security_lead", baseURL), spot);
    await page.goto("/repair/my");
    await fillPlace(page, spot);
    await page.getByRole("button", { name: "ถัดไป" }).click(); // the inline card blocks here (CR-021) …
    await page.locator('[data-step="location"]').getByRole("region", { name: "มีคนแจ้งเรื่องนี้ไว้แล้ว" })
      .getByRole("button", { name: "ติดตามเคสนี้" }).waitFor();
    await expect(page.locator('[data-step="send"]')).toBeHidden();
    await page.getByRole("navigation", { name: "เส้นทางหน้า" }).getByRole("link", { name: "แจ้งซ่อม", exact: true }).click(); // … leaving asks first
    await page.getByRole("alertdialog").getByRole("button", { name: "ทิ้งข้อมูล" }).click();
    await expect(page).not.toHaveURL(/\/repair\/new/);
  });

  test("ยกเลิกการแจ้ง on the S04 dialog leaves the form after the discard confirm", async ({ page, baseURL }, info) => {
    test.slow(); // first visits compile on `next dev`
    const spot = tag(info);
    await page.goto("/repair/my");
    await fillPlace(page, spot);
    await attachPhoto(page);
    await report(await as("security_lead", baseURL), spot);
    await page.getByRole("button", { name: "ยืนยันส่งแจ้งซ่อม" }).click();
    await page.getByRole("dialog", { name: "มีคนแจ้งเรื่องนี้ไว้แล้ว" }).getByRole("button", { name: "ยกเลิกการแจ้ง" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ทิ้งข้อมูล" }).click();
    await expect(page).not.toHaveURL(/\/repair\/new/);
  });
});

test("API: no spot is a duplicate of every open case in the room; 409 lists blocking matches only", async ({ baseURL }, info) => {
  const lead = await as("security_lead", baseURL);
  const spot = tag(info);
  const old = await report(await as("employee", baseURL), spot);

  const ids = await placeIds(lead);
  const similar = (await (await lead.get(`${API}/tickets/duplicates?categoryId=${ids.categoryId}&floorId=${ids.floorId}&roomId=${ids.roomId}&locationDetail=${encodeURIComponent("อีกจุด " + spot)}`)).json()).data;
  expect(similar.find((t: { id: string }) => t.id === old.id)).toMatchObject({ blocksReport: false, subscriberCount: 0 });

  const refused = await postTicket(lead, null);
  expect(refused.status()).toBe(409);
  const body = (await refused.json()).error;
  expect(body.code).toBe("DUPLICATE_FOUND");
  expect(body.details.tickets.some((t: { id: string }) => t.id === old.id)).toBeTruthy();
  expect(body.details.tickets.every((t: { blocksReport: boolean }) => t.blocksReport)).toBeTruthy();

  const same = await postTicket(lead, spot.toUpperCase());
  expect((await same.json()).error.code).toBe("DUPLICATE_FOUND");
});

test("API: own ticket awaiting ประเมินตรวจงาน → OWN_TICKET_AWAITING_RATING (BR-F03-4)", async ({ baseURL }, info) => {
  const employee = await as("employee", baseURL);
  const technician = await as("technician", baseURL);
  const spot = tag(info);
  const old = await report(employee, spot);
  expect((await technician.post(`${API}/tickets/${old.id}/assess`, { data: { expectedDoneOn: bangkokToday(), workBy: "in_house" } })).ok()).toBeTruthy();
  const resolved = await technician.post(`${API}/tickets/${old.id}/resolve`, { data: { note: "ล้างแผงคอยล์แล้ว", photoIds: [await uploadPhoto(technician)] } });
  expect(resolved.ok(), await resolved.text()).toBeTruthy();

  const again = await postTicket(employee, spot);
  expect(again.status()).toBe(409);
  expect((await again.json()).error).toMatchObject({ code: "OWN_TICKET_AWAITING_RATING", details: { ticketId: old.id } });
});

test("API: follow rules — already following, the reporter, closed meanwhile; D-098 photo visibility", async ({ baseURL }, info) => {
  const employee = await as("employee", baseURL);
  const follower = await as("housekeeper_lead", baseURL);
  const admin = await as("admin", baseURL);
  const old = await report(employee, tag(info));

  // D-098: the report photo of an open case is visible to someone who does not follow it yet.
  expect((await follower.get(old.thumbUrl)).status()).toBe(200);

  expect((await follower.post(`${API}/tickets/${old.id}/follow`, { data: { photoIds: [] } })).status()).toBe(200);
  const twice = await follower.post(`${API}/tickets/${old.id}/follow`, { data: { photoIds: [] } });
  expect([twice.status(), (await twice.json()).error.code]).toEqual([409, "ALREADY_FOLLOWING"]);
  const own = await employee.post(`${API}/tickets/${old.id}/follow`, { data: { photoIds: [] } });
  expect((await own.json()).error.code).toBe("ALREADY_FOLLOWING");

  expect((await admin.post(`${API}/tickets/${old.id}/close`, { data: { reason: "ทดสอบ" } })).ok()).toBeTruthy();
  const late = await (await as("security_lead", baseURL)).post(`${API}/tickets/${old.id}/follow`, { data: { photoIds: [] } });
  expect([late.status(), (await late.json()).error.code]).toEqual([409, "TICKET_CLOSED"]);
  expect((await (await as("security_lead", baseURL)).get(old.thumbUrl)).status()).toBe(403);
});
