import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { psql } from "./people";

// F26 BR-F26-6 / F27 BR-F27-1 (settings Stage 4P, CR-005, repair CR-025): building types in S20 (tab, add with its
// categories, deactivate refused while used, a building's type), S22 `ใช้กับประเภทอาคาร`, S26 rows. Real API; rows
// this spec creates are removed and the mock warehouse gets its type back.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";
const WAREHOUSE = "c025b1d0-0000-4000-8000-000000000001";
const OFFICE = "c025b700-0000-4000-8000-000000000001";
const STORE = "c025b700-0000-4000-8000-000000000002";
const AIRCON = "c014ca70-0000-4000-8000-000000000002"; // ระบบปรับอากาศ: office only (CR-025 table)

type BuildingType = { id: string; name: string; isActive: boolean; buildingCount: number; categoryIds: string[]; updatedAt: string };
type Building = { id: string; name: string; updatedAt: string; buildingType: { id: string; name: string }; floors: { id: string }[] };

const tag = () => Date.now().toString(36).slice(-5).toUpperCase();

async function types(api: APIRequestContext): Promise<BuildingType[]> {
  return (await (await api.get(`${API}/building-types`)).json()).data;
}
async function building(api: APIRequestContext, id: string): Promise<Building> {
  return ((await (await api.get(`${API}/buildings`)).json()).data as Building[]).find((b) => b.id === id)!;
}
async function setType(api: APIRequestContext, id: string, typeId: string) {
  const b = await building(api, id);
  expect((await api.patch(`${API}/buildings/${id}`, { data: { name: b.name, buildingTypeId: typeId, updatedAt: b.updatedAt } })).ok()).toBeTruthy();
}
/** Same data path as the repair form (S03 `categoryUsedIn`): the building's type is in the category's list. */
async function repairOffers(api: APIRequestContext, buildingId: string, categoryId: string) {
  const bs: Building[] = (await (await api.get("/api/v1/repair/buildings")).json()).data;
  const cats: { id: string; buildingTypeIds: string[] }[] = (await (await api.get("/api/v1/repair/categories")).json()).data;
  const b = bs.find((x) => x.id === buildingId)!;
  return cats.find((c) => c.id === categoryId)?.buildingTypeIds.includes(b.buildingType.id) ?? false;
}

async function openTab(page: Page) {
  await page.goto("/settings/buildings?tab=building-types");
  await expect(page.getByRole("heading", { name: "อาคารและอุปกรณ์", level: 1 })).toBeVisible();
  return page.getByRole("region", { name: "ประเภทอาคาร" });
}

test.describe("admin", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC1: the tab lists the seed types; add โรงงาน with every category → offered in แก้ไขอาคาร", async ({ page }) => {
    test.slow();
    const name = `โรงงาน ${tag()}`;
    try {
      const panel = await openTab(page);
      for (const n of ["อาคารสำนักงาน", "โกดังเก็บของ", "พื้นที่ภายนอกอาคาร"]) {
        const row = panel.getByRole("row", { name: new RegExp(`^${n}`) });
        await expect(row).toBeVisible();
        await expect(row.getByRole("cell").nth(1)).not.toHaveText("0");
      }
      await page.getByRole("button", { name: "เพิ่มประเภทอาคาร" }).first().click();
      const dialog = page.getByRole("dialog", { name: "เพิ่มประเภทอาคาร" });
      await dialog.getByLabel("ชื่อประเภทอาคาร").fill(name);
      const boxes = dialog.getByRole("checkbox");
      await expect(boxes.first()).toBeChecked();
      for (const box of await boxes.all()) await expect(box).toBeChecked();
      await expect(dialog.getByText("หมวด “อื่น ๆ” ใช้ได้กับทุกประเภทอาคาร")).toBeVisible();
      await dialog.getByRole("button", { name: "เพิ่มประเภทอาคาร" }).click();
      await expect(page.getByText(`เพิ่มประเภทอาคาร "${name}" แล้ว`)).toBeVisible();
      const created = (await types(page.request)).find((t) => t.name === name)!;
      expect(created.categoryIds.length).toBeGreaterThan(0);
      await expect(panel.getByRole("row", { name: new RegExp(`^${name}`) })).toContainText(`${created.categoryIds.length} หมวด`);

      await page.goto(`/settings/buildings?building=${WAREHOUSE}`);
      await expect(page.getByTestId("building-type-tag")).toHaveText("โกดังเก็บของ");
      await page.getByRole("button", { name: "แก้ไขอาคาร" }).click();
      const edit = page.getByRole("dialog", { name: "แก้ไขอาคาร" });
      await expect(edit.getByText("เปลี่ยนประเภทแล้วมีผลกับงานแจ้งใหม่เท่านั้น")).toBeVisible();
      await edit.getByRole("combobox", { name: "ประเภทอาคาร" }).click();
      await expect(page.getByRole("option", { name })).toBeVisible();
      await page.keyboard.press("Escape");
    } finally {
      psql(`DELETE FROM repair.category_building_types WHERE building_type_id IN (SELECT id FROM platform.building_types WHERE name = '${name}');
            DELETE FROM platform.building_types WHERE name = '${name}';`);
    }
  });

  test("AC2: deactivating a type an active building has is refused", async ({ page }) => {
    const panel = await openTab(page);
    await panel.getByRole("row", { name: /^อาคารสำนักงาน/ }).getByRole("button", { name: "ตัวเลือก อาคารสำนักงาน" }).click();
    await page.getByRole("menuitem", { name: "ปิดใช้งาน" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน");
    // the API refuses too (no UI shortcut)
    const office = (await types(page.request)).find((t) => t.id === OFFICE)!;
    const res = await page.request.patch(`${API}/building-types/${OFFICE}`, { data: { isActive: false, updatedAt: office.updatedAt } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("IN_USE");
  });

  test("AC3 + AC5: the warehouse as อาคารสำนักงาน offers ระบบปรับอากาศ; back hides it; S26 shows the change", async ({ page }) => {
    test.slow();
    try {
      expect(await repairOffers(page.request, WAREHOUSE, AIRCON)).toBe(false);
      await page.goto(`/settings/buildings?building=${WAREHOUSE}`);
      await page.getByRole("button", { name: "แก้ไขอาคาร" }).click();
      const edit = page.getByRole("dialog", { name: "แก้ไขอาคาร" });
      await edit.getByRole("combobox", { name: "ประเภทอาคาร" }).click();
      await page.getByRole("option", { name: "อาคารสำนักงาน" }).click();
      await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
      await expect(page.getByTestId("building-type-tag")).toHaveText("อาคารสำนักงาน");
      expect(await repairOffers(page.request, WAREHOUSE, AIRCON)).toBe(true);
    } finally {
      await setType(page.request, WAREHOUSE, STORE);
    }
    expect(await repairOffers(page.request, WAREHOUSE, AIRCON)).toBe(false);
  });

  test("AC4: a category needs a building type; อื่น ๆ is used everywhere", async ({ page }) => {
    test.slow();
    const name = `ลิฟต์ ${tag()}`;
    try {
      await page.goto("/settings/categories");
      await page.getByRole("button", { name: "เพิ่มหมวดงาน" }).first().click();
      const dialog = page.getByRole("dialog", { name: "เพิ่มหมวดงาน" });
      await dialog.getByLabel("ชื่อหมวดงาน").fill(name);
      for (const box of await dialog.getByRole("checkbox").all()) await expect(box).not.toBeChecked();
      await dialog.getByRole("button", { name: "เพิ่มหมวดงาน" }).click();
      await expect(dialog.getByRole("alert")).toHaveText("เลือกประเภทอาคารอย่างน้อย 1 ประเภท");
      // the API refuses too
      const res = await page.request.post(`${API}/categories`, { data: { name, icon: "wrench", defaultPriority: "low", buildingTypeIds: [] } });
      expect((await res.json()).error.fields.buildingTypeIds).toBe("MIN_ITEMS");

      await dialog.getByRole("checkbox", { name: "โกดังเก็บของ" }).check();
      await dialog.getByRole("button", { name: "เพิ่มหมวดงาน" }).click();
      await expect(page.getByTestId("category-building-types")).toContainText("โกดังเก็บของ");

      const cats = (await (await page.request.get(`${API}/categories`)).json()).data as { id: string; name: string; isOther: boolean }[];
      const otherCat = cats.find((c) => c.isOther)!;
      await page.goto(`/settings/categories/${otherCat.id}`);
      await expect(page.getByTestId("category-building-types")).toContainText("ทุกประเภทอาคาร");
      await page.getByRole("button", { name: `ตัวเลือกของ ${otherCat.name}` }).click();
      await page.getByRole("menuitem", { name: "แก้ไขหมวดงาน" }).click();
      const other = page.getByRole("dialog", { name: "แก้ไขหมวดงาน" });
      await expect(other.getByText("ใช้ได้กับทุกประเภทอาคาร")).toBeVisible();
      await expect(other.getByRole("checkbox")).toHaveCount(0);
    } finally {
      psql(`DELETE FROM repair.category_building_types WHERE category_id IN (SELECT id FROM repair.categories WHERE name = '${name}');
            DELETE FROM repair.categories WHERE name = '${name}';`);
    }
  });
});

test.describe("superadmin", () => {
  test.use({ storageState: auth("super_admin") });
  test.skip(({ isMobile }) => isMobile, "reads the rows the admin specs wrote");

  test("AC5: S26 lists building and building-type changes", async ({ page }) => {
    await page.goto("/settings/audit?type=master");
    await expect(page.getByRole("heading", { name: "ประวัติการเปลี่ยนแปลง", level: 1 })).toBeVisible();
    await page.getByRole("searchbox", { name: "ค้นหาชื่อรายการ" }).fill("โกดังเก็บของ 1");
    await expect(page.getByText("ประเภทอาคาร").first()).toBeVisible();
  });
});

test.describe("employee", () => {
  test.use({ storageState: auth("employee") });

  test("the building-types API is Forbidden", async ({ page }) => {
    expect((await page.request.get(`${API}/building-types`)).status()).toBe(403);
  });
});
