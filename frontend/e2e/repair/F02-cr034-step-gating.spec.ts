import { expect, test, type Page } from "@playwright/test";
import { as, auth, fillPlace, PLACE, report, tag } from "./helpers";

// CR-034 (Stage 5P) on F02 / F03: ถัดไป cannot be pressed while the step misses a required field or a blocking
// duplicate has no other spot — the hint under the bar says what is missing (BR-F02-1a); once a blocking duplicate
// was found for this room + category the extra spot keeps `*` after it is typed (BR-F03-2). Real API.

test.use({ storageState: auth("employee") });

const nextButton = (page: Page) => page.getByRole("button", { name: "ถัดไป" });
const hint = (page: Page) => page.locator("#step-missing");

test("AC1: ถัดไป is disabled with a hint until the step is complete", async ({ page }) => {
  await page.goto("/repair/new");
  const s = page.locator('[data-step="location"]');
  await expect(s.getByRole("heading", { name: "ปัญหาเกิดขึ้นที่ไหน" })).toBeVisible({ timeout: 15_000 });
  const restart = page.getByRole("button", { name: "เริ่มใหม่" });
  if (await restart.isVisible()) await restart.click();

  await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(nextButton(page)).toHaveAttribute("aria-describedby", "step-missing");
  await expect(hint(page)).toHaveText("กรุณาเลือกอาคาร");
  await expect(nextButton(page)).toBeDisabled(); // aria-disabled: Playwright counts it as not enabled
  await nextButton(page).click({ force: true });
  await expect(s).toBeVisible(); // still on step 1

  await s.getByText(PLACE.building, { exact: true }).click();
  await s.getByRole("radiogroup", { name: "เลือกชั้น" }).getByText(PLACE.floor, { exact: true }).click();
  await expect(hint(page)).toHaveText("เลือกห้องหรือจุดที่เกิด");
  await s.getByText(PLACE.room, { exact: true }).click();
  await expect(hint(page)).toHaveCount(0);
  await expect(nextButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await nextButton(page).click();
  await expect(page.locator('[data-step="problem"]')).toBeVisible();
  await expect(hint(page)).toHaveText("กรุณาเลือกหมวดงาน");
});

test("AC1 + AC2: a blocking duplicate disables ถัดไป; the extra spot keeps * after another spot is typed", async ({ page, baseURL }, info) => {
  test.slow(); // first visits compile on `next dev`
  const spot = tag(info, "ซ้ำ");
  await report(await as("housekeeper_lead", baseURL), spot);

  await fillPlace(page, spot);
  await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(hint(page)).toHaveText("กรุณาระบุจุดที่ต่างจากงานเดิม ก่อนดำเนินการต่อ");
  const label = page.locator('label[for="duplicateSpot"]');
  await expect(label).toContainText("*");

  await page.locator('[data-step="problem"]').getByLabel("บอกจุดเพิ่มเติม").fill(`${spot} อีกฝั่ง`);
  await expect(hint(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(nextButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(label).toContainText("*");
  await expect(label).not.toContainText("ไม่บังคับ");
  await expect(label).toContainText("จำเป็นเมื่อพบงานที่ตรงกัน");
});
