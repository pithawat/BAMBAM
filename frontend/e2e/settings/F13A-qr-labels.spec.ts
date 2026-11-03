import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { psql } from "./people";
import { auth, SETTINGS_API } from "./sessions";

// F13-A (repair CR-036 / settings CR-007, repair Stage 5B): Admin prints QR labels in S30 — two rooms ticked → A4
// preview (12 per page) → print (window.print stubbed) → "พิมพ์ป้ายเรียบร้อยไหม" → #57 on yes only. Then S20 shows the
// label status (moved / changed), the code is locked on #48 and repair #32, and a technician gets Forbidden.
// Real API; the assets this spec creates live in two rooms that had none, and are deleted afterwards.

type Room = { id: string; name: string; updatedAt: string; activeAssetCount: number };
type Floor = { id: string; name: string; level: number; rooms: Room[] };
type Building = { id: string; name: string; floors: Floor[] };
type Asset = { id: string; code: string; name: string; roomId: string; updatedAt: string; labelStatus: string };
type LabelRow = { id: string; code: string; labelStatus: string; room: { id: string } };

const tag = () => Date.now().toString(36).slice(-5).toUpperCase();

/** A floor with two rooms that have no active assets (so ticking them only picks this spec's assets). */
async function emptyRooms(api: APIRequestContext) {
  const tree: Building[] = (await (await api.get(`${SETTINGS_API}/buildings`)).json()).data;
  for (const b of tree) for (const f of b.floors) {
    const empty = f.rooms.filter((r) => r.activeAssetCount === 0);
    if (empty.length >= 2) return { building: b, floor: f, a: empty[0], b: empty[1] };
  }
  throw new Error("no floor with two empty rooms in the test database");
}

async function assetType(api: APIRequestContext): Promise<string> {
  return (await (await api.get(`${SETTINGS_API}/asset-types`)).json()).data[0].id;
}

async function labelRows(api: APIRequestContext, buildingId: string): Promise<LabelRow[]> {
  return (await (await api.get(`${SETTINGS_API}/assets/labels?buildingId=${buildingId}`)).json()).data;
}

async function roomAssets(api: APIRequestContext, roomId: string): Promise<Asset[]> {
  return (await (await api.get(`${SETTINGS_API}/rooms/${roomId}/assets`)).json()).data;
}

const short = (building: string) => (building.startsWith("อาคาร ") ? `อ.${building.slice(6)}` : building);

async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => { (window as unknown as { __prints: number }).__prints++; };
  });
}

test.describe("admin", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  let place: Awaited<ReturnType<typeof emptyRooms>>;
  const assets: Asset[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: auth("admin"), baseURL: test.info().project.use.baseURL });
    const api = ctx.request;
    place = await emptyRooms(api);
    const typeId = await assetType(api);
    const t = tag();
    // 2 in room A, 11 in room B = 13 labels → 2 A4 pages
    const plan = [["A", place.a.id, 2], ["B", place.b.id, 11]] as const;
    for (const [key, roomId, n] of plan) {
      for (let i = 1; i <= n; i++) {
        const res = await api.post(`${SETTINGS_API}/assets`, {
          data: { roomId, assetTypeId: typeId, code: `QL${key}-${t}-${String(i).padStart(2, "0")}`, name: `ป้ายทดสอบ ${key}${i} เครื่องปรับอากาศตัวที่อยู่ติดหน้าต่างด้านทิศเหนือ` },
        });
        expect(res.status()).toBe(201);
        assets.push((await res.json()).data);
      }
    }
    await ctx.close();
  });

  test.afterAll(() => {
    if (assets.length) psql(`DELETE FROM platform.assets WHERE id IN (${assets.map((a) => `'${a.id}'`).join(",")})`);
  });

  test("AC1 / AC2 / AC5: two rooms → preview 13 labels on 2 A4 pages → 'ยังไม่' saves nothing → 'ใช่' marks them current", async ({ page, baseURL }) => {
    test.slow();
    await stubPrint(page);
    await page.goto(`/settings/buildings/labels?building=${place.building.id}`);
    await expect(page.getByRole("heading", { name: "พิมพ์ป้าย QR", level: 1 })).toBeVisible();
    const tree = page.getByRole("navigation", { name: "เลือกอุปกรณ์ตามสถานที่" });
    const primary = page.getByRole("button", { name: /^ดูตัวอย่างและพิมพ์/ }).first();
    await expect(primary).toBeDisabled();
    await expect(page.getByText("เลือกอุปกรณ์อย่างน้อย 1 ชิ้น").first()).toBeVisible();

    await tree.getByRole("button", { name: `แสดงห้องในชั้น ${place.floor.name}` }).click();
    await tree.getByRole("checkbox", { name: `${place.a.name} (2)` }).click();
    await tree.getByRole("checkbox", { name: `${place.b.name} (11)` }).click();
    await expect(tree.getByRole("checkbox", { name: new RegExp(`^ชั้น ${place.floor.name} \\(`) })).toHaveAttribute("data-state", /checked|indeterminate/);
    await expect(page.getByText(/เลือกแล้ว 13 ชิ้น · 2 หน้า A4/).first()).toBeVisible();

    await primary.click();
    const preview = page.getByRole("dialog", { name: "ตัวอย่างป้าย QR" });
    await expect(preview.getByTestId("qr-page")).toHaveCount(2);
    await expect(preview.getByTestId("qr-page").nth(0).getByTestId("qr-label")).toHaveCount(12);
    await expect(preview.getByTestId("qr-page").nth(1).getByTestId("qr-label")).toHaveCount(1);
    // label text (BR-F13A-1) and the QR target `{origin}/q/{code}`
    const first = assets[0];
    const cell = preview.getByTestId("qr-label").filter({ hasText: first.code });
    await expect(cell).toContainText(first.name);
    await expect(cell).toContainText(`${short(place.building.name)} · ชั้น ${place.floor.name} · ${place.a.name}`);
    await expect(cell).toContainText("สแกนแจ้งปัญหา"); // CR-037 v7 label
    await expect(cell.locator("svg[data-qr]")).toHaveAttribute("data-qr", `${baseURL}/q/${encodeURIComponent(first.code)}`);
    // the print sheet holds the same labels and nothing else prints (only .qr-print-root under @media print)
    await expect(page.locator(".qr-print-root [data-testid=qr-label]")).toHaveCount(13);

    // AC5: "ยังไม่" records nothing
    await preview.getByRole("button", { name: "พิมพ์", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: "พิมพ์ป้ายเรียบร้อยไหม" });
    await expect(confirm).toContainText("ระบบจะจำข้อมูลบนป้าย 13 ชิ้นนี้ไว้");
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
    await confirm.getByRole("button", { name: "ยังไม่" }).click();
    await expect(confirm).toBeHidden();
    const mine = (rows: LabelRow[]) => rows.filter((r) => assets.some((a) => a.id === r.id));
    expect(mine(await labelRows(page.request, place.building.id)).every((r) => r.labelStatus === "never")).toBe(true);

    // yes → #57 → statuses current, badges gone
    await preview.getByRole("button", { name: "พิมพ์", exact: true }).click();
    await confirm.getByRole("button", { name: "ใช่ พิมพ์แล้ว" }).click();
    await expect(page.getByText("บันทึกการพิมพ์ป้าย 13 ชิ้นแล้ว")).toBeVisible();
    await expect(preview).toBeHidden();
    const rows = mine(await labelRows(page.request, place.building.id));
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.labelStatus === "current")).toBe(true);
    await expect(page.locator(`#label-row-${first.id}`).getByTestId("label-badge")).toHaveCount(0);
  });

  test("AC1: S20 row menu and room heading open S30 with the asset / the room preselected", async ({ page }) => {
    const a = assets[0];
    await page.goto(`/settings/buildings?building=${place.building.id}&floor=${place.floor.id}&room=${place.a.id}`);
    await expect(page.getByRole("heading", { name: place.a.name, level: 2 })).toBeVisible();
    await page.getByRole("button", { name: `ตัวเลือก ${a.name}` }).click();
    await page.getByRole("menuitem", { name: "พิมพ์ป้าย QR" }).click();
    await expect(page).toHaveURL(new RegExp(`/settings/buildings/labels\\?.*assets=${a.id}`));
    await expect(page.getByText(/เลือกแล้ว 1 ชิ้น · 1 หน้า A4/).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: new RegExp(`^เลือก ${a.code} `) })).toHaveAttribute("data-state", "checked");

    await page.goto(`/settings/buildings?building=${place.building.id}&floor=${place.floor.id}&room=${place.b.id}`);
    await page.getByRole("link", { name: "พิมพ์ป้ายทั้งห้อง" }).click();
    await expect(page).toHaveURL(new RegExp(`room=${place.b.id}`));
    await expect(page.getByText(/เลือกแล้ว 11 ชิ้น · 1 หน้า A4/).first()).toBeVisible();
  });

  test("AC3: move → ย้ายแล้ว ควรพิมพ์ป้ายใหม่; room rename → ข้อมูลบนป้ายเปลี่ยน ควรพิมพ์ใหม่; reprint clears", async ({ page }) => {
    test.slow();
    const moving = assets[1]; // room A → room B
    const staying = assets[2]; // room B, room renamed
    const fresh = (await roomAssets(page.request, place.a.id)).find((x) => x.id === moving.id)!;
    expect((await page.request.patch(`${SETTINGS_API}/assets/${moving.id}`, { data: { roomId: place.b.id, updatedAt: fresh.updatedAt } })).status()).toBe(200);

    const tree: Building[] = (await (await page.request.get(`${SETTINGS_API}/buildings`)).json()).data;
    const roomB = tree.flatMap((b) => b.floors.flatMap((f) => f.rooms)).find((r) => r.id === place.b.id)!;
    const renamed = `${roomB.name} ${tag()}`;
    const rename = await page.request.patch(`${SETTINGS_API}/rooms/${place.b.id}`, { data: { name: renamed, updatedAt: roomB.updatedAt } });
    expect(rename.status()).toBe(200);
    try {
      await page.goto(`/settings/buildings?building=${place.building.id}&floor=${place.floor.id}&room=${place.b.id}`);
      const row = (name: string) => page.getByRole("row").filter({ hasText: name });
      await expect(row(moving.name).getByTestId("label-badge")).toHaveText("ย้ายแล้ว ควรพิมพ์ป้ายใหม่");
      await expect(row(staying.name).getByTestId("label-badge")).toHaveText("ข้อมูลบนป้ายเปลี่ยน ควรพิมพ์ใหม่");

      // S30 filter ควรพิมพ์ใหม่ lists them; reprint the moved one through #57 → current
      await page.goto(`/settings/buildings/labels?building=${place.building.id}`);
      await page.getByRole("radio", { name: "ควรพิมพ์ใหม่" }).click();
      await expect(page.locator(`#label-row-${moving.id}`)).toBeVisible();
      const res = await page.request.post(`${SETTINGS_API}/assets/labels/printed`, { data: { assetIds: [moving.id] } });
      expect(res.status()).toBe(200);
      expect((await res.json()).data[0].labelStatus).toBe("current");
    } finally {
      const now: Building[] = (await (await page.request.get(`${SETTINGS_API}/buildings`)).json()).data;
      const r = now.flatMap((b) => b.floors.flatMap((f) => f.rooms)).find((x) => x.id === place.b.id)!;
      await page.request.patch(`${SETTINGS_API}/rooms/${place.b.id}`, { data: { name: roomB.name, updatedAt: r.updatedAt } });
    }
    const back = (await labelRows(page.request, place.building.id)).find((r) => r.id === staying.id)!;
    expect(back.labelStatus).toBe("current"); // same text as printed again once the name is back
  });

  test("AC4: a printed code is read-only in S20 and refused by #48 and repair #32", async ({ page }) => {
    const a = assets[0];
    await page.goto(`/settings/buildings?building=${place.building.id}&floor=${place.floor.id}&room=${place.a.id}`);
    await page.getByRole("button", { name: `ตัวเลือก ${a.name}` }).click();
    await page.getByRole("menuitem", { name: "แก้ไข / ย้ายห้อง" }).click();
    const dialog = page.getByRole("dialog", { name: "แก้ไขอุปกรณ์" });
    await expect(dialog.getByLabel("รหัสอุปกรณ์")).toHaveAttribute("readonly", "");
    await expect(dialog.getByText("พิมพ์ป้าย QR แล้ว จึงเปลี่ยนรหัสไม่ได้")).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();

    const fresh = (await roomAssets(page.request, place.a.id)).find((x) => x.id === a.id)!;
    const settings = await page.request.patch(`${SETTINGS_API}/assets/${a.id}`, { data: { code: `${a.code}X`, updatedAt: fresh.updatedAt } });
    expect(settings.status()).toBe(422);
    expect((await settings.json()).error.code).toBe("ASSET_CODE_LOCKED");
    const repair = await page.request.put(`/api/v1/repair/assets/${a.id}`, { data: { code: `${a.code}X`, name: a.name, roomId: place.a.id } });
    expect(repair.status()).toBe(422);
    expect((await repair.json()).error.code).toBe("ASSET_CODE_LOCKED");
    // the name still changes (same code)
    const ok = await page.request.patch(`${SETTINGS_API}/assets/${a.id}`, { data: { code: a.code, name: `${a.name} (ใหม่)`, updatedAt: fresh.updatedAt } });
    expect(ok.status()).toBe(200);
  });

  test("edge: an asset deactivated before 'ใช่' → toast, the list reloads, nothing saved", async ({ page }) => {
    await stubPrint(page);
    const gone = assets[3];
    const kept = assets[4];
    await page.goto(`/settings/buildings/labels?building=${place.building.id}&assets=${gone.id},${kept.id}`);
    await expect(page.getByText(/เลือกแล้ว 2 ชิ้น/).first()).toBeVisible();
    await page.getByRole("button", { name: /^ดูตัวอย่างและพิมพ์/ }).first().click();
    await page.getByRole("dialog", { name: "ตัวอย่างป้าย QR" }).getByRole("button", { name: "พิมพ์", exact: true }).click();

    const fresh = (await roomAssets(page.request, place.b.id)).find((x) => x.id === gone.id)!;
    expect((await page.request.patch(`${SETTINGS_API}/assets/${gone.id}`, { data: { isActive: false, updatedAt: fresh.updatedAt } })).status()).toBe(200);
    const before = (await labelRows(page.request, place.building.id)).find((r) => r.id === kept.id)!;

    await page.getByRole("alertdialog", { name: "พิมพ์ป้ายเรียบร้อยไหม" }).getByRole("button", { name: "ใช่ พิมพ์แล้ว" }).click();
    await expect(page.getByText("มีอุปกรณ์ที่ถูกปิดใช้งานระหว่างนี้ โหลดข้อมูลล่าสุดให้แล้ว")).toBeVisible();
    await expect(page.locator(`#label-row-${gone.id}`)).toHaveCount(0);
    await expect(page.getByText(/เลือกแล้ว 1 ชิ้น/).first()).toBeVisible();
    const after = (await labelRows(page.request, place.building.id)).find((r) => r.id === kept.id)!;
    expect(after.labelStatus).toBe(before.labelStatus);
  });
});

test.describe("technician", () => {
  test.use({ storageState: auth("technician") });

  test("no settings.assets.manage → Forbidden page and 403 from #56 / #57", async ({ page }) => {
    await page.goto("/settings/buildings/labels");
    await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
    await expect(page.getByRole("button", { name: /ดูตัวอย่างและพิมพ์/ })).toHaveCount(0);
    const tree = await page.request.get(`${SETTINGS_API}/assets/labels?buildingId=00000000-0000-4000-8000-000000000000`);
    expect(tree.status()).toBe(403);
    const mark = await page.request.post(`${SETTINGS_API}/assets/labels/printed`, { data: { assetIds: ["00000000-0000-4000-8000-000000000000"] } });
    expect(mark.status()).toBe(403);
  });
});

test.describe("layout", () => {
  test.use({ storageState: auth("admin") });

  test("S30 fits the screen: tree + list, primary action reachable, no horizontal scroll", async ({ page, isMobile }) => {
    await page.goto("/settings/buildings/labels");
    await expect(page.getByRole("heading", { name: "พิมพ์ป้าย QR", level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /^ทั้งอาคาร/ })).toBeVisible();
    const action = page.getByRole("button", { name: /^ดูตัวอย่างและพิมพ์/ }).filter({ visible: true });
    await expect(action).toHaveCount(1);
    if (isMobile) await expect(action).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
