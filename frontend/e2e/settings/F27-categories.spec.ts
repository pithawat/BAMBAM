import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { psql } from "./people";

// F27 (settings Stage 5, S22, CR-001 / CR-008 / CR-014): Admin adds a category with symptoms and priorities; it shows
// in the repair form (#1 categories) only while it has an active symptom; used items cannot be deleted. Real API;
// rows this spec creates are removed afterwards.
const auth = (role: string) => path.join(__dirname, "..", ".auth", `${role}.json`);
const API = "/api/v1/settings";
const tag = () => Date.now().toString(36).slice(-5);

type FormCategory = { id: string; name: string; icon: string; symptoms: { name: string; priority: string }[] };

async function formCategories(page: Page): Promise<FormCategory[]> {
  return (await (await page.request.get("/api/v1/repair/categories")).json()).data;
}

test.describe("admin", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: auth("admin") });
  test.skip(({ isMobile }) => isMobile, "writes run once (desktop)");

  test("AC1 / AC2: new category with symptoms appears in the form in order; no active symptom hides it", async ({ page }) => {
    test.slow();
    const name = `ลิฟต์และบันไดเลื่อน ${tag()}`;
    try {
      await page.goto("/settings/categories");
      await expect(page.getByRole("heading", { name: "หมวดงานและอาการ", level: 1 })).toBeVisible();
      await page.getByRole("button", { name: "เพิ่มหมวดงาน" }).click();
      const dialog = page.getByRole("dialog", { name: "เพิ่มหมวดงาน" });
      await dialog.getByLabel("ชื่อหมวดงาน").fill(name);
      await dialog.getByRole("radio", { name: "ประตู / อาคาร" }).click();
      await dialog.getByRole("radio", { name: "สูง" }).click();
      await dialog.getByRole("checkbox", { name: "อาคารสำนักงาน" }).check(); // CR-005: ≥ 1 building type
      await dialog.getByRole("button", { name: "เพิ่มหมวดงาน" }).click();
      await expect(page.getByText("เพิ่มหมวดงานแล้ว")).toBeVisible();
      await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
      await expect(page).toHaveURL(/\/settings\/categories\/[0-9a-f-]{36}$/);
      await expect(page.getByText("หมวดนี้ไม่แสดงในฟอร์มแจ้งซ่อม เพราะยังไม่มีอาการที่เปิดใช้งาน")).toBeVisible();
      expect((await formCategories(page)).some((c) => c.name === name)).toBe(false);

      for (const [symptom, priority] of [["ลิฟต์ค้าง", "ฉุกเฉิน"], ["ประตูลิฟต์ไม่ปิด", "สูง"]]) {
        await page.getByRole("button", { name: "เพิ่มอาการ" }).first().click();
        const s = page.getByRole("dialog", { name: "เพิ่มอาการ" });
        await s.getByLabel("ชื่ออาการ").fill(symptom);
        await s.getByRole("radio", { name: priority }).click();
        await s.getByRole("button", { name: "เพิ่มอาการ" }).click();
        await expect(page.getByText("เพิ่มอาการแล้ว")).toBeVisible();
        await expect(s).toBeHidden();
      }
      // duplicate in the same category
      await page.getByRole("button", { name: "เพิ่มอาการ" }).first().click();
      const dup = page.getByRole("dialog", { name: "เพิ่มอาการ" });
      await dup.getByLabel("ชื่ออาการ").fill("ลิฟต์ค้าง");
      await dup.getByRole("button", { name: "เพิ่มอาการ" }).click();
      await expect(dup.getByText("ชื่อนี้มีอยู่แล้วในหมวดนี้")).toBeVisible();
      await dup.getByRole("button", { name: "ยกเลิก" }).click();

      // order: move the second symptom up
      await page.getByRole("button", { name: "ตัวเลือกของ ประตูลิฟต์ไม่ปิด" }).click();
      await page.getByRole("menuitem", { name: "เลื่อนขึ้น" }).click();
      await expect(page.getByText("บันทึกลำดับแล้ว")).toBeVisible();

      let cat = (await formCategories(page)).find((c) => c.name === name)!;
      expect(cat.icon).toBe("door-open");
      expect(cat.symptoms.map((s) => s.name)).toEqual(["ประตูลิฟต์ไม่ปิด", "ลิฟต์ค้าง"]);
      expect(cat.symptoms[1].priority).toBe("critical");

      // AC2: deactivate both → the last one warns, the form hides the category
      await page.getByRole("button", { name: "ตัวเลือกของ ลิฟต์ค้าง" }).click();
      await page.getByRole("menuitem", { name: "ปิดใช้งาน" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByText(`ปิดใช้งาน "ลิฟต์ค้าง" แล้ว`)).toBeVisible();
      await page.getByRole("button", { name: "ตัวเลือกของ ประตูลิฟต์ไม่ปิด" }).click();
      await page.getByRole("menuitem", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByRole("alertdialog").getByText(`นี่คืออาการสุดท้ายที่เปิดใช้งานของหมวด "${name}" หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม`)).toBeVisible();
      await page.getByRole("alertdialog").getByRole("button", { name: "ปิดใช้งาน" }).click();
      await expect(page.getByText("หมวดนี้ไม่แสดงในฟอร์มแจ้งซ่อม เพราะยังไม่มีอาการที่เปิดใช้งาน")).toBeVisible();
      cat = (await formCategories(page)).find((c) => c.name === name)!;
      expect(cat).toBeUndefined();

      // an unused category can be deleted
      await page.getByRole("button", { name: `ตัวเลือกของ ${name}` }).click();
      await page.getByRole("menuitem", { name: /^ลบ/ }).click();
      await page.getByRole("alertdialog", { name: `ลบ "${name}"?` }).getByRole("button", { name: "ลบ" }).click();
      await expect(page.getByText(`ลบ "${name}" แล้ว`)).toBeVisible();
    } finally {
      psql(`DELETE FROM repair.symptoms WHERE category_id IN (SELECT id FROM repair.categories WHERE name = '${name}');
            DELETE FROM repair.category_building_types WHERE category_id IN (SELECT id FROM repair.categories WHERE name = '${name}');
            DELETE FROM repair.categories WHERE name = '${name}';`);
    }
  });

  test("AC4: a used category / symptom cannot be deleted (menu says why; the API refuses)", async ({ page }) => {
    // a category with a ticket: create one through repair, then try
    const cats = (await (await page.request.get(`${API}/categories`)).json()).data as { id: string; name: string; inUse: boolean; isOther: boolean }[];
    const used = cats.find((c) => c.inUse && !c.isOther);
    test.skip(!used, "no used category in this database yet");
    await page.goto(`/settings/categories/${used!.id}`);
    await page.getByRole("button", { name: `ตัวเลือกของ ${used!.name}` }).click();
    await expect(page.getByRole("menuitem", { name: /^ลบ/ })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: /เคยถูกใช้แล้ว ปิดใช้งานแทน/ })).toBeVisible();
    const res = await page.request.delete(`${API}/categories/${used!.id}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("IN_USE");
  });
});

test.describe("phone", () => {
  test.use({ storageState: auth("admin") });
  test("panels stack; dialogs are bottom sheets", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/settings/categories");
    const nav = page.getByRole("navigation", { name: "หมวดงาน" });
    await expect(nav).toBeVisible();
    const add = page.getByRole("button", { name: "เพิ่มอาการ" });
    await expect(add).toBeVisible();
    expect((await nav.boundingBox())!.y).toBeLessThan((await add.boundingBox())!.y);
  });
});

test("employee gets Forbidden on S22 and 403 from #32", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ storageState: auth("employee"), baseURL });
  const page = await ctx.newPage();
  await page.goto("/settings/categories");
  await expect(page.getByText("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")).toBeVisible();
  expect((await page.request.get(`${API}/categories`)).status()).toBe(403);
  await ctx.close();
});
