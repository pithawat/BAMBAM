import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { psql } from "./people";

// F26 (settings Stage 4, S20, CR-001 / CR-002): Admin picks a room from the building plan, renames it (same id, the
// repair form shows the new name), adds / moves / deactivates assets, adds an asset type inline. Structure (buildings,
// floors, rooms) is never created, deleted or reordered here. Real API; rows this spec creates are removed afterwards.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";

type Room = { id: string; name: string; updatedAt: string; activeAssetCount: number };
type Floor = { id: string; name: string; level: number; rooms: Room[] };
type Building = { id: string; name: string; updatedAt: string; floors: Floor[] };

const tag = () => Date.now().toString(36).slice(-5).toUpperCase();

async function tree(api: APIRequestContext): Promise<Building[]> {
  return (await (await api.get(`${API}/buildings`)).json()).data;
}

/** The first building whose bottom floor has two rooms (อาคาร 1 in the seed). */
async function plan(api: APIRequestContext) {
  const b = (await tree(api)).find((x) => x.floors[0]?.rooms.length > 1)!;
  return { building: b, floor: b.floors[0], room: b.floors[0].rooms[0], other: b.floors[0].rooms[1] };
}

async function openRoom(page: Page, b: Building, f: Floor, r: Room) {
  await page.goto(`/settings/buildings?building=${b.id}&floor=${f.id}&room=${r.id}`);
  await expect(page.getByRole("heading", { name: "อาคารและอุปกรณ์", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: r.name, level: 2 })).toBeVisible();
}

test.describe("admin", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC1: pick a room from the plan; no control creates, deletes or reorders buildings, floors or rooms", async ({ page }) => {
    test.slow();
    const p = await plan(page.request);
    await page.goto("/settings/buildings");
    await expect(page.getByRole("navigation", { name: "เลือกห้องจากผัง" })).toBeVisible();
    await page.getByRole("button", { name: `ชั้น ${p.floor.name}`, exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^${p.other.name}`) }).click();
    await expect(page.getByRole("heading", { name: p.other.name, level: 2 })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`room=${p.other.id}`));
    await expect(page.getByText("ชั้นและห้องอ้างอิงจากผังอาคาร")).toBeVisible();
    for (const name of [/เพิ่มอาคาร/, /เพิ่มชั้น/, /เพิ่มห้อง/, /^ลบ/, /เลื่อนขึ้น/]) await expect(page.getByRole("button", { name })).toHaveCount(0);
  });

  test("AC2: rename a room — same id, the repair form lists the new name; duplicate names refused", async ({ page }) => {
    test.slow();
    const p = await plan(page.request);
    const renamed = `${p.room.name} ${tag()}`;
    try {
      await openRoom(page, p.building, p.floor, p.room);
      await page.getByRole("button", { name: "แก้ไขชื่อห้อง" }).click();
      const dialog = page.getByRole("dialog", { name: "แก้ไขชื่อห้อง / พื้นที่" });
      await dialog.getByLabel("ชื่อห้อง / พื้นที่").fill(p.other.name);
      await dialog.getByRole("button", { name: "บันทึกชื่อ" }).click();
      await expect(dialog.getByText("ชื่อนี้มีอยู่แล้ว")).toBeVisible();
      await dialog.getByLabel("ชื่อห้อง / พื้นที่").fill(renamed);
      await dialog.getByRole("button", { name: "บันทึกชื่อ" }).click();
      await expect(page.getByText("บันทึกชื่อแล้ว")).toBeVisible();
      await expect(page.getByRole("heading", { name: renamed, level: 2 })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`room=${p.room.id}`));

      // repair #2 (the S03 location picker) reads the same plan rows
      const repair = JSON.stringify((await (await page.request.get("/api/v1/repair/buildings")).json()).data);
      expect(repair).toContain(p.room.id);
      expect(repair).toContain(renamed);
    } finally {
      const fresh = (await plan(page.request)).room;
      await page.request.patch(`${API}/rooms/${p.room.id}`, { data: { name: p.room.name, updatedAt: fresh.updatedAt } });
    }
  });

  test("AC3 / AC4 / AC5: inline type, add, duplicate code, move, deactivate and reactivate", async ({ page }) => {
    test.slow();
    const p = await plan(page.request);
    const t = tag();
    const typeName = `เครื่องพิมพ์ ${t}`;
    const prefix = `Q${t.replace(/[^A-Z0-9]/g, "").slice(0, 3)}`.slice(0, 5);
    const assetName = `เครื่องพิมพ์ทดสอบ ${t}`;
    try {
      await openRoom(page, p.building, p.floor, p.room);
      await page.getByRole("button", { name: "เพิ่มอุปกรณ์" }).first().click();
      const dialog = page.getByRole("dialog", { name: "เพิ่มอุปกรณ์" });
      await dialog.getByLabel("ชื่ออุปกรณ์").fill(assetName);

      // AC4: inline type keeps the other fields and gets selected
      await dialog.getByRole("button", { name: "เพิ่มประเภทใหม่" }).click();
      await dialog.getByLabel("ชื่อประเภทใหม่").fill(typeName);
      await dialog.getByLabel("รหัสนำหน้า").fill(prefix.toLowerCase());
      await dialog.getByRole("radio", { name: "ผนัง" }).click();
      await dialog.getByRole("button", { name: "เพิ่มประเภท", exact: true }).click();
      await expect(page.getByText("เพิ่มประเภทอุปกรณ์แล้ว")).toBeVisible();
      await expect(dialog.getByRole("combobox").filter({ hasText: typeName })).toBeVisible();
      await expect(dialog.getByLabel("ชื่ออุปกรณ์")).toHaveValue(assetName);
      const code = `${prefix}-${p.floor.name}-001`;
      await expect(dialog.getByLabel("รหัสอุปกรณ์")).toHaveValue(code);

      // AC3: add → listed; the same code in another case is refused
      await dialog.getByRole("button", { name: "เพิ่มอุปกรณ์" }).click();
      await expect(page.getByText("เพิ่มอุปกรณ์แล้ว")).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: assetName });
      await expect(row).toContainText(code);

      await page.getByRole("button", { name: "เพิ่มอุปกรณ์" }).first().click();
      await dialog.getByLabel("รหัสอุปกรณ์").fill(code.toLowerCase());
      await dialog.getByLabel("ชื่ออุปกรณ์").fill("ซ้ำ");
      await dialog.getByRole("button", { name: "เพิ่มอุปกรณ์" }).click();
      await expect(dialog.getByText("รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น")).toBeVisible();
      await dialog.getByRole("button", { name: "ยกเลิก" }).click();

      // move to the other room: same code, the 3D position cleared, the selection follows
      await row.getByRole("button", { name: `ตัวเลือก ${assetName}` }).click();
      await page.getByRole("menuitem", { name: "แก้ไข / ย้ายห้อง" }).click();
      const edit = page.getByRole("dialog", { name: "แก้ไขอุปกรณ์" });
      await expect(edit.getByText("เปลี่ยนประเภทไม่ได้")).toBeVisible();
      await edit.getByRole("combobox").nth(2).click();
      await page.getByRole("option", { name: p.other.name }).click();
      await expect(edit.getByText("ย้ายห้องแล้วต้องจัดวางตำแหน่งบนผัง 3D ใหม่")).toBeVisible();
      await edit.getByRole("button", { name: "บันทึก" }).click();
      await expect(page.getByText("บันทึกอุปกรณ์แล้ว")).toBeVisible();
      await expect(page.getByRole("heading", { name: p.other.name, level: 2 })).toBeVisible();
      const moved = (await (await page.request.get(`${API}/rooms/${p.other.id}/assets`)).json()).data.find((a: { code: string }) => a.code === code);
      expect(moved.placed).toBe(false);

      // AC5: deactivate → hidden unless "แสดงอุปกรณ์ที่ปิดใช้งาน"; reactivate
      const movedRow = page.getByRole("row").filter({ hasText: assetName });
      await movedRow.getByRole("button", { name: `ตัวเลือก ${assetName}` }).click();
      await page.getByRole("menuitem", { name: "ปิดใช้งาน" }).click();
      await page.getByRole("alertdialog", { name: `ปิดใช้งาน "${assetName}"?` }).getByRole("button", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByText(`ปิดใช้งาน "${assetName}" แล้ว`)).toBeVisible();
      await expect(movedRow).toHaveCount(0);
      await page.getByLabel("แสดงอุปกรณ์ที่ปิดใช้งาน").check();
      await expect(movedRow).toContainText("ปิดใช้งาน");
      await movedRow.getByRole("button", { name: `ตัวเลือก ${assetName}` }).click();
      await expect(page.getByRole("menuitem", { name: "แก้ไข / ย้ายห้อง" })).toHaveCount(0);
      await page.getByRole("menuitem", { name: "เปิดใช้งาน" }).click();
      await expect(page.getByText(`เปิดใช้งาน "${assetName}" แล้ว`)).toBeVisible();

      // types tab: the new type with its prefix; a duplicate prefix is refused
      await page.getByRole("tab", { name: /ประเภทอุปกรณ์/ }).click();
      await expect(page.getByRole("row").filter({ hasText: typeName })).toContainText(prefix);
      await page.getByRole("button", { name: "เพิ่มประเภทอุปกรณ์" }).click();
      const typeDialog = page.getByRole("dialog", { name: "เพิ่มประเภทอุปกรณ์" });
      await typeDialog.getByLabel("ชื่อประเภทอุปกรณ์").fill(`${typeName} 2`);
      await typeDialog.getByLabel("รหัสนำหน้า").fill(prefix);
      await typeDialog.getByRole("button", { name: "เพิ่มประเภทอุปกรณ์" }).click();
      await expect(typeDialog.getByText("รหัสนำหน้านี้มีประเภทอื่นใช้แล้ว")).toBeVisible();
    } finally {
      psql(`DELETE FROM platform.assets WHERE name = '${assetName}'; DELETE FROM platform.asset_types WHERE name LIKE '${typeName}%';`);
    }
  });
});

test.describe("phone", () => {
  test.use({ storageState: auth("admin") });
  test("navigator first, then the asset panel; the asset dialog is a bottom sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    test.slow();
    await page.goto("/settings/buildings");
    const nav = page.getByRole("navigation", { name: "เลือกห้องจากผัง" });
    await expect(nav).toBeVisible();
    const add = page.getByRole("button", { name: "เพิ่มอุปกรณ์" }).first();
    await expect(add).toBeVisible();
    expect((await nav.boundingBox())!.y).toBeLessThan((await add.boundingBox())!.y);
    await add.click();
    const sheet = page.getByRole("dialog", { name: "เพิ่มอุปกรณ์" });
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(viewport.height - 2);
  });
});

test.describe("access", () => {
  test("employee gets Forbidden on S20 and 403 from #13 / #46", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: auth("employee"), baseURL });
    const page = await ctx.newPage();
    await page.goto("/settings/buildings");
    await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
    expect((await page.request.get(`${API}/buildings`)).status()).toBe(403);
    expect((await page.request.get(`${API}/asset-types`)).status()).toBe(403);
    await ctx.close();
  });
});
