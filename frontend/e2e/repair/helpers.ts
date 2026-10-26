import path from "node:path";
import { expect, request as playwrightRequest, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

// Shared by the repair specs (F03–F07, F21, F24): demo-role API contexts and tickets reported and worked on
// through the real API. Every report gets its own extra spot (`tag`) so runs and projects never duplicate each
// other (CR-020: another spot in the same room is allowed).
export const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
export const API = "/api/v1/repair";
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** The place every Stage 4 spec reports on (อาคาร 1 is in the migrations, so it exists in the test database). */
export const PLACE = { category: "ระบบปรับอากาศ", symptom: "แอร์ไม่เย็น", building: "อาคาร 1", floor: "4", room: "อ.1 ห้อง 401" } as const;

type Ref = { id: string; name: string };
type Category = Ref & { symptoms: Ref[] };
type Building = Ref & { floors: (Ref & { rooms: Ref[] })[] };
export type Ids = { categoryId: string; symptomId: string; buildingId: string; floorId: string; roomId: string };

export async function as(role: string, baseURL: string | undefined): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, storageState: auth(role) });
}

/** A spot no other test or run uses. */
export const tag = (info: TestInfo, what = "e2e") => `${what} ${info.project.name} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

export async function placeIds(api: APIRequestContext): Promise<Ids> {
  const categories: Category[] = (await (await api.get(`${API}/categories`)).json()).data;
  const buildings: Building[] = (await (await api.get(`${API}/buildings`)).json()).data;
  const category = categories.find((c) => c.name === PLACE.category)!;
  const building = buildings.find((b) => b.name === PLACE.building)!;
  const floor = building.floors.find((f) => f.name === PLACE.floor)!;
  const room = floor.rooms.find((r) => r.name === PLACE.room)!;
  return {
    categoryId: category.id, symptomId: category.symptoms.find((s) => s.name === PLACE.symptom)!.id,
    buildingId: building.id, floorId: floor.id, roomId: room.id,
  };
}

export async function uploadPhoto(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API}/photos`, { multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG } } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.id;
}

/** POST #5 on PLACE; returns the raw response so callers can check 201 or the 409s. */
export async function postTicket(api: APIRequestContext, spot: string | null, team: { note: string } | null = null) {
  const ids = await placeIds(api);
  return api.post(`${API}/tickets`, {
    data: {
      categoryId: ids.categoryId, symptomIds: [ids.symptomId], buildingId: ids.buildingId, floorId: ids.floorId, roomId: ids.roomId,
      ...(spot ? { locationDetail: spot } : {}), photoIds: [await uploadPhoto(api)],
      teamHandled: team ? { note: team.note, photoIds: [await uploadPhoto(api)] } : null,
    },
  });
}

/** Reports a ticket on PLACE with this spot and returns its detail. */
export async function report(api: APIRequestContext, spot: string, team: { note: string } | null = null) {
  const res = await postTicket(api, spot, team);
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string; ticketNo: string; status: string; closedReason: string | null; thumbUrl: string };
}

/**
 * S03 as the signed-in user up to the สถานที่ step on PLACE with this extra spot; returns once #22 has answered
 * for this spot (CR-021: a blocking answer stops ถัดไป at this step). `path`: `/repair/new?mode=team` for leads.
 */
export async function fillPlace(page: Page, spot: string, path = "/repair/new") {
  await page.goto(path);
  await expect(page.getByText("เลือกหมวดที่ตรงกับปัญหา").filter({ visible: true }).first()).toBeVisible();
  const restart = page.getByRole("button", { name: "เริ่มใหม่" });
  if (await restart.isVisible()) await restart.click();
  const p = page.locator('[data-step="problem"]');
  await p.getByText(PLACE.category, { exact: true }).click();
  await p.getByText(PLACE.symptom, { exact: true }).click();
  await page.getByRole("button", { name: "ถัดไป" }).click();
  const s = page.locator('[data-step="location"]');
  await s.getByText(PLACE.building, { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText(PLACE.floor, { exact: true }).click();
  await s.getByText(PLACE.room, { exact: true }).click();
  const checked = page.waitForResponse((r) => r.url().includes(`${API}/tickets/duplicates`)
    && new URL(r.url()).searchParams.get("locationDetail")?.trim() === spot.trim(), { timeout: 15_000 });
  await s.getByLabel("บอกจุดเพิ่มเติม").fill(spot);
  await checked;
}

/** From the สถานที่ step: next, attach the report photo, wait until it is uploaded. */
export async function attachPhoto(page: Page) {
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await uploadVia(page, page.locator('[data-step="send"]').locator("input[type=file]").first());
}

/** Sets a file on the input and waits for the #3 upload to finish. */
export async function uploadVia(page: Page, input: ReturnType<Page["locator"]>) {
  const uploaded = page.waitForResponse((r) => r.url().endsWith(`${API}/photos`) && r.request().method() === "POST", { timeout: 15_000 });
  await input.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  expect((await uploaded).status()).toBe(201);
}

/** Today in Asia/Bangkok as YYYY-MM-DD (expected-date field of #9). */
export const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
/** Today + n days in Asia/Bangkok as YYYY-MM-DD. */
export const bangkokDay = (n: number) => new Date(Date.now() + 7 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);

type Detail = Record<string, unknown> & { id: string; ticketNo: string; status: string; step: string; timeline: { type: string; note: string | null; data: Record<string, unknown> }[] };

/** POST an action of #9–#12 and expect 200; returns the ticket detail. */
async function act(api: APIRequestContext, id: string, action: string, data: object): Promise<Detail> {
  const res = await api.post(`${API}/tickets/${id}/${action}`, { data });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data;
}

/** #9 as the technician: in house unless a contractor is given; expected today unless `on`. */
export const assess = (technician: APIRequestContext, id: string, opts: { contractorId?: string; on?: string; reason?: string } = {}) =>
  act(technician, id, "assess", { expectedDoneOn: opts.on ?? bangkokToday(), workBy: opts.contractorId ? "contractor" : "in_house", contractorId: opts.contractorId, reason: opts.reason });

/** #10 as the technician with one after photo; `rating` = the contractor stars of a contractor job. */
export async function resolve(technician: APIRequestContext, id: string, rating?: number) {
  return act(technician, id, "resolve", { note: "ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง", photoIds: [await uploadPhoto(technician)], ...(rating ? { contractorRating: rating } : {}) });
}

/** #11 as the reporter: the stars close the ticket. */
export const confirm = (reporter: APIRequestContext, id: string, rating = 5) => act(reporter, id, "confirm", { rating });

/** #12 as the reporter. */
export const sendBack = (reporter: APIRequestContext, id: string, reason = "ยังมีน้ำหยดตอนเปิดแอร์นาน") => act(reporter, id, "send-back", { reason, photoIds: [] });

/** #14 + #16 as the technician: a contractor of type แอร์ (the type is reused when it exists, BR-F24-2). */
export async function newContractor(technician: APIRequestContext, name: string) {
  const type = (await (await technician.post(`${API}/contractor-types`, { data: { name: "แอร์" } })).json()).data as { id: string };
  const res = await technician.post(`${API}/contractors`, { data: { name, typeIds: [type.id], contactName: "คุณสมชาย", phone: "081-234-5678", note: "" } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data as { id: string; name: string; types: Ref[] };
}

/** A ticket reported by the employee and resolved by the technician (in house, or by this contractor with 4 stars). */
export async function resolvedTicket(baseURL: string | undefined, spot: string, contractorId?: string) {
  const technician = await as("technician", baseURL);
  const ticket = await report(await as("employee", baseURL), spot);
  await assess(technician, ticket.id, { contractorId });
  await resolve(technician, ticket.id, contractorId ? 4 : undefined);
  return ticket;
}
