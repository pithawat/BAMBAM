/* Run directly with Node. Checks this isolated prototype, never the application or its database. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(path.resolve(__dirname, "../../../../../frontend/node_modules/playwright"));
const { expect } = require(path.resolve(__dirname, "../../../../../frontend/node_modules/@playwright/test"));
const base = pathToFileURL(path.join(__dirname, "CR-001-admin-settings.html")).href;
const errors = [];
const checks = [];
const record = (message) => checks.push(message);

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "th-TH" });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    const visit = async (screen, query = "") => {
      await page.goto("about:blank");
      await page.goto(`${base}${query}#${screen}`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".page-mascot")).toHaveJSProperty("naturalWidth", 384);
      await expect(page.locator(".page-mascot")).toHaveAttribute("data-mascot-role", query.includes("viewer=admin") ? "admin" : "super_admin");
      await expect(page.locator(".page-mascot")).toHaveAttribute("alt", "");
    };
    const snapshot = async (name) => {
      await page.evaluate(() => { document.getElementById("toast").hidden = true; });
      const modalOpen = await page.locator("#modal").evaluate((modal) => modal.open);
      return page.screenshot({ path: path.join(__dirname, "CR-001-assets", `${name}.png`), fullPage: !modalOpen, animations: "disabled" });
    };
    const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Page must not overflow horizontally");
    await visit("users");
    assert.equal(await page.locator(".user-table tbody tr").count(), 6);
    assert.equal(await page.locator('#topbar,.prototype-bar,.brand,.organization,.header-account,[data-action="notifications"]').count(), 0);
    assert.equal(await page.evaluate(() => document.fonts.check('14px "Anuphan"')), true);
    await snapshot("users-desktop");
    await page.locator('[data-action="change-user-role"][data-id="1"]').click();
    await page.locator('input[name="new-role"][value="technician"]').check();
    await expect(page.locator("#save-user-role")).toBeEnabled();
    await snapshot("user-role-confirmation-desktop");
    await page.locator("#save-user-role").click();
    await expect(page.locator('[data-action="change-user-role"][data-id="1"]')).toContainText("ช่างเทคนิค");
    await page.locator("#user-search").fill("EMP0108");
    assert.equal(await page.locator(".user-table tbody tr").count(), 1);
    await page.locator("#user-search").fill("no-such-person");
    await expect(page.getByRole("heading", { name: "ไม่พบผู้ใช้ที่ตรงกับการค้นหา" })).toBeVisible();
    await page.locator('[data-action="clear-users"]').click();
    await page.locator("#user-role-filter").selectOption("admin");
    assert.equal(await page.locator(".user-table tbody tr").count(), 2);
    await page.locator("#user-role-filter").selectOption("");
    await page.getByRole("button", { name: "หน้าถัดไป", exact: true }).click();
    await expect(page.locator(".pagination")).toContainText("7–12 จาก 12");
    record("Users: search, role filtering, pagination and confirmed role change");

    await visit("roles");
    await snapshot("roles-desktop");
    const cell = page.locator('.matrix-table input[data-permission="technician:close_any"]');
    await cell.check();
    await expect(page.locator("#savebar")).toContainText("1 รายการ");
    await cell.uncheck();
    await expect(page.locator("#savebar")).toBeHidden();
    await cell.check();
    await page.locator('[data-action="save-permissions"]').click();
    await expect(page.locator("#modal")).toContainText("ช่างเทคนิค");
    await expect(page.locator("#modal")).toContainText("ปิดงานใดก็ได้");
    await page.locator("#confirm-action").click();
    await expect(page.locator("#savebar")).toBeHidden();
    await expect(cell).toBeChecked();
    await cell.uncheck();
    await page.locator('.nav-link[href="#places"]').click();
    await expect(page.locator("#modal-title")).toContainText("ออกโดยไม่บันทึก");
    await page.locator('#modal [data-action="close-modal"]').filter({ hasText: "ยกเลิก" }).click();
    await expect(page.locator("h1")).toHaveText("Role และสิทธิ์");
    await page.locator('.nav-link[href="#places"]').click();
    await page.locator("#confirm-action").click();
    await expect(page.locator("h1")).toHaveText("อาคารและอุปกรณ์");
    record("Permissions: toggle/revert, exact change count, confirmation and unsaved-navigation guard");

    await visit("roles");
    await page.locator('[data-action="add-role"]').click();
    await page.locator("#role-name").fill("หัวหน้าช่าง");
    await page.locator("#copy-role").selectOption("technician");
    await page.locator('#role-form button[type="submit"]').click();
    await page.locator('[data-action="role-tab"][data-tab="roles"]').click();
    await expect(page.locator(".role-list-table")).toContainText("หัวหน้าช่าง");
    record("Roles: add role and copy repair permissions without inheriting administrative access");

    await visit("places");
    await snapshot("places-desktop");
    assert.equal(await page.locator('[data-action="add-floor"],[data-action="add-room"],[data-action="add-building"]').count(), 0);
    const roomId = await page.locator('.room-button.active').getAttribute('data-id');
    await page.locator('[data-action="rename-room"]').click();
    await page.locator("#location-name").fill("ห้องประชุมใหญ่");
    await page.locator('#location-form button[type="submit"]').click();
    await expect(page.locator(".room-title")).toContainText("ห้องประชุมใหญ่");
    assert.equal(await page.locator('.room-button.active').getAttribute('data-id'), roomId);
    assert.equal(await page.locator('.asset-table tbody tr').count(), 4);
    await page.locator('[data-action="rename-building"]').click();
    await page.locator("#location-name").fill("อาคารสำนักงาน");
    await page.locator('#location-form button[type="submit"]').click();
    await expect(page.locator(".context-path")).toContainText("อาคารสำนักงาน");
    await expect(page.locator("#building-select")).toHaveValue("b1");
    await page.locator('[data-action="select-room"][data-id="r113"]').click();
    await expect(page.getByRole("heading", { name: "ยังไม่มีอุปกรณ์ในห้องนี้" })).toBeVisible();
    await page.locator('[data-action="select-room"][data-id="r111"]').click();
    record("Plan-owned locations: no creation controls; renaming preserves building/room IDs and attached assets");
    await page.locator('[data-action="place-tab"][data-tab="types"]').click();
    await snapshot("asset-types-desktop");
    await page.locator('[data-action="add-asset-type"]').click();
    await page.locator("#asset-type-name").fill("เครื่องปรับอากาศ");
    await page.locator('#asset-type-form button[type="submit"]').click();
    await expect(page.locator("#form-error")).toContainText("มีอยู่แล้ว");
    await page.locator("#asset-type-name").fill("เครื่องพิมพ์");
    await snapshot("asset-type-form-desktop");
    await page.locator('#asset-type-form button[type="submit"]').click();
    await expect(page.locator(".asset-types-table")).toContainText("เครื่องพิมพ์");
    await page.locator('[data-action="place-tab"][data-tab="assets"]').click();
    await page.locator('[data-action="add-asset"]').click();
    await snapshot("asset-form-desktop");
    await page.locator("#asset-type").selectOption({ label: "เครื่องพิมพ์" });
    await page.locator("#asset-code").fill("ac-1-001");
    await page.locator("#asset-name").fill("อุปกรณ์ทดสอบ");
    await page.locator('#asset-form button[type="submit"]').click();
    await expect(page.locator("#form-error")).toContainText("มีอยู่แล้ว");
    await page.locator("#asset-code").fill("AC-TEST-001");
    await page.locator("#asset-room").selectOption("r112");
    await page.locator('[data-action="toggle-inline-type"]').click();
    await page.locator("#inline-type-name").fill("เครื่องพิมพ์");
    await page.locator('[data-action="save-inline-type"]').click();
    await expect(page.locator("#inline-type-error")).toContainText("มีอยู่แล้ว");
    await page.locator("#inline-type-name").fill("เครื่องสแกนเอกสาร");
    await page.locator("#inline-type-name").press("Enter");
    await expect(page.locator("#asset-type option:checked")).toHaveText("เครื่องสแกนเอกสาร");
    await expect(page.locator("#asset-code")).toHaveValue("AC-TEST-001");
    await expect(page.locator("#asset-name")).toHaveValue("อุปกรณ์ทดสอบ");
    await expect(page.locator("#asset-room")).toHaveValue("r112");
    await page.locator('#asset-form button[type="submit"]').click();
    await expect(page.locator(".room-title")).toContainText("ห้องประชุม 1B");
    await expect(page.locator(".asset-table")).toContainText("AC-TEST-001");
    await expect(page.locator("#asset-type-filter")).toContainText("เครื่องสแกนเอกสาร");
    await page.locator('[data-action="place-tab"][data-tab="types"]').click();
    await expect(page.locator('.asset-types-table tr').filter({ hasText: "เครื่องสแกนเอกสาร" })).toContainText("1 ชิ้น");
    record("Asset types: create/select and duplicate validation; inline creation retains asset draft; new equipment stays bound to its selected room");

    await visit("categories");
    await snapshot("categories-desktop");
    await page.locator('[data-action="add-category"]').click();
    await page.locator("#category-name").fill("หมวดทดสอบ");
    await page.locator("#category-priority").selectOption("high");
    await page.locator('#category-form button[type="submit"]').click();
    await page.locator('[data-action="add-symptom"]').first().click();
    await page.locator("#symptom-name").fill("อาการทดสอบ");
    await page.locator("#symptom-priority").selectOption("critical");
    await page.locator('#symptom-form button[type="submit"]').click();
    await expect(page.locator(".symptom-row")).toContainText("ฉุกเฉิน");
    await page.locator('[data-action="symptom-menu"]').click();
    await page.locator("#menu-action-0").click();
    await page.locator("#symptom-priority").selectOption("low");
    await page.locator('#symptom-form button[type="submit"]').click();
    await expect(page.locator(".symptom-row")).toContainText("ต่ำ");
    await page.locator('[data-action="symptom-menu"]').click();
    await page.locator("#menu-action-1").click();
    await expect(page.locator("#modal")).toContainText("อาการสุดท้าย");
    await page.locator("#confirm-action").click();
    await expect(page.getByRole("heading", { name: "ยังไม่มีอาการที่เปิดใช้งาน" })).toBeVisible();
    record("Categories/symptoms: create, edit urgency and warn before disabling the final symptom");

    await visit("users", "?viewer=admin");
    await expect(page.getByRole("heading", { name: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้" })).toBeVisible();
    assert.equal(await page.locator('.nav-link[href="#users"],.nav-link[href="#roles"],.user-table').count(), 0);
    await visit("roles", "?viewer=admin");
    assert.equal(await page.locator(".matrix-table").count(), 0);
    await visit("places", "?viewer=admin");
    await page.locator('[data-action="add-asset"]').click();
    await expect(page.locator("#asset-form")).toBeVisible();
    await page.locator('#modal [data-action="close-modal"]').filter({ hasText: "ยกเลิก" }).click();
    await snapshot("admin-desktop");
    await page.locator('[data-action="place-tab"][data-tab="types"]').click();
    await page.locator('[data-action="add-asset-type"]').click();
    await expect(page.locator("#asset-type-form")).toBeVisible();
    record("Admin: identity links hidden; direct URLs forbidden; master-data actions available");

    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const screen of ["users", "roles", "places", "categories"]) {
        await visit(screen);
        await overflow();
        if (width === 375) await snapshot(`${screen}-mobile`);
      }
      await visit("places", "?tab=types");
      await overflow();
      if (width === 375) {
        await page.locator('[data-action="open-nav"]').click();
        await expect(page.locator("#sidebar")).toBeInViewport();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("body").evaluate((body) => body.classList.contains("nav-open")), false);
        await visit("roles");
        const mobile = page.locator('.matrix-mobile input[data-permission="technician:close_any"]');
        await mobile.check();
        await expect(page.locator("#savebar")).toBeVisible();
        await page.locator("#mobile-role").selectOption("super_admin");
        assert.equal(await page.locator(".matrix-mobile input:not(:disabled)").count(), 0);
        await page.locator('[data-action="reset-permissions"]').click();
        await visit("places", "?tab=types");
        await overflow();
        await snapshot("asset-types-mobile");
        await page.locator('[data-action="add-asset-type"]').click();
        await page.locator("#asset-type-name").fill("อุปกรณ์พกพา");
        await page.locator('#asset-type-form button[type="submit"]').click();
        await expect(page.locator(".asset-types-table")).toContainText("อุปกรณ์พกพา");
        await overflow();
      }
    }
    record("Responsive: all four screens at 1280px/375px, no page overflow, drawer/Escape, mobile permission switches");

    for (const screen of ["users", "roles", "places", "categories"]) {
      for (const view of ["loading", "empty", "error", "forbidden", "normal"]) {
        await visit(screen, `?state=${view}`);
        await overflow();
        if (view === "loading") await expect(page.locator('[aria-busy="true"]')).toBeVisible();
        if (view === "error") await expect(page.getByRole("heading", { name: "โหลดข้อมูลไม่สำเร็จ" })).toBeVisible();
        if (view === "forbidden") await expect(page.getByRole("heading", { name: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้" })).toBeVisible();
      }
    }
    record("State gallery: loading, empty, error, forbidden and normal for each screen");
    await visit("places", "?tab=types&state=empty");
    await expect(page.getByRole("heading", { name: "ยังไม่มีประเภทอุปกรณ์" })).toBeVisible();
    await page.locator('[data-action="add-asset-type"]').click();
    await page.locator("#asset-type-name").fill("เครื่องกรองอากาศ");
    await page.locator('#asset-type-form button[type="submit"]').click();
    await expect(page.locator(".asset-types-table")).toContainText("เครื่องกรองอากาศ");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: "PASS", checks, consoleErrors: errors.length }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
