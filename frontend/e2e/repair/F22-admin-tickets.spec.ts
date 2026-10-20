import path from "node:path";
import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";

// F22 / F08-B (Stage 3, CR-015): S11 งานทั้งหมด for admin and executive, admin close with a reason.
// Runs against the real API; each test reports its own ticket as the demo employee through the API.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const API = "/api/v1/repair";

type Ref = { id: string; name: string };
type Category = Ref & { symptoms: Ref[] };
type Building = Ref & { floors: (Ref & { rooms: Ref[] })[] };

async function as(role: string, baseURL: string | undefined): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, storageState: auth(role) });
}

/** Reports one ticket as the employee and returns { id, ticketNo }. */
async function reportTicket(api: APIRequestContext): Promise<{ id: string; ticketNo: string }> {
  const categories: Category[] = (await (await api.get(`${API}/categories`)).json()).data;
  const buildings: Building[] = (await (await api.get(`${API}/buildings`)).json()).data;
  const category = categories.find((c) => c.symptoms.length > 0)!;
  const building = buildings.find((b) => b.floors.some((f) => f.rooms.length > 0))!;
  const floor = building.floors.find((f) => f.rooms.length > 0)!;
  const photo = await api.post(`${API}/photos`, { multipart: { file: { name: "problem.png", mimeType: "image/png", buffer: PNG } } });
  expect(photo.ok()).toBeTruthy();
  const res = await api.post(`${API}/tickets`, {
    data: {
      categoryId: category.id, symptomIds: [category.symptoms[0].id], buildingId: building.id, floorId: floor.id, roomId: floor.rooms[0].id,
      photoIds: [(await photo.json()).data.id], teamHandled: null,
    },
  });
  expect(res.status()).toBe(201);
  const t = (await res.json()).data;
  return { id: t.id, ticketNo: t.ticketNo };
}

test.describe("admin", () => {
  test.use({ storageState: auth("admin") });

  test("AC1 + AC2: oldest first, priority shown but not editable, close with a reason", async ({ page, baseURL }) => {
    const ticket = await reportTicket(await as("employee", baseURL));
    await page.goto(`/repair/admin/queue?q=${ticket.ticketNo}`);
    const row = page.getByRole("row").filter({ hasText: ticket.ticketNo });
    await expect(row).toBeVisible();
    await expect(row.getByRole("combobox")).toHaveCount(0); // CR-015: no priority select

    await row.getByRole("button", { name: `ปิดงาน ${ticket.ticketNo}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "ปิดงาน", exact: true }).click();
    await expect(dialog.getByText("กรุณาใส่เหตุผล")).toBeVisible();
    await dialog.getByLabel(/เหตุผลที่ปิดงาน/).fill("ส่งเรื่องเปลี่ยนเครื่องใหม่ผ่านฝ่ายจัดซื้อแล้ว");
    await dialog.getByRole("button", { name: "ปิดงาน", exact: true }).click();
    await expect(page.getByText("ปิดงานแล้ว").first()).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: ticket.ticketNo })).toHaveCount(0);

    await page.goto(`/repair/admin/queue?tab=closed&reason=admin_closed&q=${ticket.ticketNo}`);
    await expect(page.getByRole("row").filter({ hasText: ticket.ticketNo })).toContainText("Admin ปิดงาน");

    // The reporter sees who closed it and why.
    const reporter = await (await as("employee", baseURL)).get(`${API}/tickets/${ticket.id}`);
    const detail = (await reporter.json()).data;
    expect(detail.closedReason).toBe("admin_closed");
    expect(detail.timeline[0]).toMatchObject({ type: "admin_closed", note: "ส่งเรื่องเปลี่ยนเครื่องใหม่ผ่านฝ่ายจัดซื้อแล้ว" });
  });

  test("open tabs list the oldest report first (BR-F22-1)", async ({ request }) => {
    const res = await request.get(`${API}/tickets?scope=all&step=awaiting_assessment&sort=createdAt:asc&pageSize=100`);
    const created: string[] = (await res.json()).data.map((t: { createdAt: string }) => t.createdAt);
    expect(created).toEqual([...created].sort());
    expect((await request.get(`${API}/tickets?scope=all&sort=priority:asc`)).status()).toBe(400); // CR-015
  });

  test("S07: admin closes from the ticket page", async ({ page, baseURL }) => {
    const ticket = await reportTicket(await as("employee", baseURL));
    await page.goto(`/repair/tickets/${ticket.id}`);
    await page.getByRole("button", { name: "ปิดงาน" }).click();
    await page.getByRole("dialog").getByLabel(/เหตุผลที่ปิดงาน/).fill("ซ้ำกับงานอื่น");
    await page.getByRole("dialog").getByRole("button", { name: "ปิดงาน", exact: true }).click();
    await expect(page.getByText("Admin ปิดงานนี้").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "ปิดงาน" })).toHaveCount(0);
  });
});

test.describe("executive", () => {
  test.use({ storageState: auth("executive") });

  test("AC3: read-only page, direct writes return 403", async ({ page, request, baseURL }) => {
    const ticket = await reportTicket(await as("employee", baseURL));
    await page.goto(`/repair/admin/queue?q=${ticket.ticketNo}`);
    await expect(page.getByText("โหมดดูอย่างเดียว")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: ticket.ticketNo })).toBeVisible();
    await expect(page.getByRole("button", { name: /ปิดงาน/ })).toHaveCount(0);
    expect((await request.post(`${API}/tickets/${ticket.id}/close`, { data: { reason: "x" } })).status()).toBe(403);
    expect((await request.post(`${API}/tickets/${ticket.id}/assess`, { data: { expectedDoneOn: "2030-01-01", workBy: "in_house" } })).status()).toBe(403);
  });
});

for (const role of ["employee", "technician"]) {
  test.describe(role, () => {
    test.use({ storageState: auth(role) });
    test(`${role} gets the forbidden state`, async ({ page }) => {
      await page.goto("/repair/admin/queue");
      await expect(page.getByText("หน้านี้สำหรับ Admin และผู้บริหาร")).toBeVisible();
    });
  });
}
