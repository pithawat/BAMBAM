import path from "node:path";
import { expect, request as playwrightRequest, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";

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
 * S03 as the signed-in user (CR-025: place first): step 1 สถานที่ on PLACE with this extra spot, ถัดไป, step 2 the
 * category + symptom; returns on step 2 once #22 has answered for this spot (a blocking answer stops ถัดไป there).
 * `path`: `/repair/new?mode=team` for leads.
 */
export async function fillPlace(page: Page, spot: string, path = "/repair/new") {
  await page.goto(path);
  const s = page.locator('[data-step="location"]');
  await expect(s.getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible();
  const restart = page.getByRole("button", { name: "เริ่มใหม่" });
  if (await restart.isVisible()) await restart.click();
  await pickBuilding(page, PLACE.building);
  await pickFloor(page, PLACE.floor);
  await pickRoom(page, PLACE.room);
  await s.getByLabel("บอกจุดเพิ่มเติม").fill(spot);
  await page.getByRole("button", { name: "ถัดไป" }).click();
  const p = page.locator('[data-step="problem"]');
  const checked = page.waitForResponse((r) => r.url().includes(`${API}/tickets/duplicates`)
    && new URL(r.url()).searchParams.get("locationDetail")?.trim() === spot.trim(), { timeout: 15_000 });
  await pickCategory(page, PLACE.category);
  await p.getByRole("group", { name: /อาการที่พบ/ }).getByText(PLACE.symptom, { exact: true }).click();
  await checked;
}

/** From step 2: next, attach the report photo (kept in the form, CR-026 A1). */
export async function attachPhoto(page: Page) {
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await attachVia(page, page.locator('[data-step="send"]').locator("input[type=file]").first());
}

/** Sets a file on the input and waits until its tile is ready (resized, kept in the form — no #3 call until submit). */
export async function attachVia(page: Page, input: ReturnType<Page["locator"]>) {
  const ready = page.locator('[data-photo-status="ready"]');
  const before = await ready.count();
  await input.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(ready).toHaveCount(before + 1, { timeout: 15_000 });
}

/** Counts #3 uploads on this page (CR-026 A1: none before the form is sent). */
export function countUploads(page: Page) {
  const seen = { n: 0 };
  page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith(`${API}/photos`)) seen.n++; });
  return seen;
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

/** The signed-in user's id (`GET /api/v1/me`). */
export async function myId(api: APIRequestContext): Promise<string> {
  return (await (await api.get("/api/v1/me")).json()).data.id;
}

/**
 * #9 as the technician: in house (CR-034: the technician is the assignee) unless a contractor is given; expected today
 * unless `on`.
 */
export async function assess(technician: APIRequestContext, id: string, opts: { contractorId?: string; on?: string; reason?: string } = {}) {
  const by = opts.contractorId ? { workBy: "contractor", contractorId: opts.contractorId } : { workBy: "in_house", assigneeId: await myId(technician) };
  return act(technician, id, "assess", { expectedDoneOn: opts.on ?? bangkokToday(), ...by, reason: opts.reason });
}

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

// ---- S03 pickers (CR-040) ----
// อาคาร is a searchable dropdown on every size. Phones / tablets (below `lg`) also pick ชั้น, the room list and
// หมวดงาน from searchable dropdowns (a bottom sheet); desktop keeps the floor chips, room cards and category tiles.

/** The S03 layout follows the viewport (`lg` = 1024px), not `isMobile`. */
export const phoneLayout = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
const reportStep = (page: Page, key: string) => page.locator(`[data-step="${key}"]`);
const floorLabelOf = (name: string) => (/^\p{Script=Thai}/u.test(name) ? name : `ชั้น ${name}`);

async function pickOption(page: Page, trigger: Locator, name: string) {
  await trigger.click();
  await page.getByRole("option", { name, exact: true }).click();
}

export const pickBuilding = (page: Page, name: string) => pickOption(page, page.locator("#buildingId"), name);

/** `floor` = the floor name as on the desktop chips ("4"); the dropdown reads "ชั้น 4". No floor → the first one. */
export async function pickFloor(page: Page, floor?: string | null) {
  if (phoneLayout(page)) {
    await page.locator("#floorId").click();
    await (floor ? page.getByRole("option", { name: floorLabelOf(floor), exact: true }) : page.getByRole("option").first()).click();
    return;
  }
  const chips = reportStep(page, "location").getByRole("radiogroup", { name: "เลือกชั้น" });
  await (floor ? chips.getByText(floor, { exact: true }) : chips.locator("label").first()).click();
}

/** A room from the name list (CR-038: behind "เลือกจากรายชื่อ" when the floor has a plan). */
export async function pickRoom(page: Page, room: string) {
  const s = reportStep(page, "location");
  const toList = s.getByRole("button", { name: "เลือกจากรายชื่อ" });
  const list = phoneLayout(page) ? page.locator("#roomId") : s.getByRole("radiogroup", { name: /ห้องหรือจุดที่เกิด/ });
  await expect(toList.or(list).first()).toBeVisible();
  if (await toList.isVisible()) await toList.click();
  if (phoneLayout(page)) await pickOption(page, list, room);
  else await list.getByText(room, { exact: true }).click();
}

export async function pickCategory(page: Page, name: string) {
  if (phoneLayout(page)) await pickOption(page, page.locator("#categoryId"), name);
  else await reportStep(page, "problem").getByRole("radiogroup", { name: "เลือกหมวดที่ตรงกับปัญหา" }).getByText(name, { exact: true }).click();
}

export async function expectCategory(page: Page, name: string) {
  if (phoneLayout(page)) await expect(page.locator("#categoryId")).toContainText(name);
  else await expect(reportStep(page, "problem").getByRole("radio", { name })).toBeChecked();
}

/** The category names in display order (phones: read from the dropdown, closed again). */
export async function categoryNames(page: Page): Promise<string[]> {
  if (phoneLayout(page)) {
    await page.locator("#categoryId").click();
    const options = page.getByRole("listbox").getByRole("option");
    await expect(options.first()).toBeVisible();
    const names = await options.allInnerTexts();
    await page.keyboard.press("Escape");
    return names.map((n) => n.trim());
  }
  const tiles = reportStep(page, "problem").getByRole("radiogroup", { name: "เลือกหมวดที่ตรงกับปัญหา" }).locator("label");
  await expect(tiles.first()).toBeVisible();
  return (await tiles.allInnerTexts()).map((n) => n.trim());
}
