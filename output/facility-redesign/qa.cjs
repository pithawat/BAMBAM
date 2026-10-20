const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname,'../../แผนผังงานซ่อมอาคาร.html'),'utf8');
for (const m of html.matchAll(/<script(?: type="(.*?)")?>([\s\S]*?)<\/script>/g)) {
 if(!m[1]) new vm.Script(m[2]);
 if(m[1]==='module') fs.writeFileSync(path.join(__dirname,'model-check.mjs'),m[2]);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const page=await browser.newPage({viewport:{width:1512,height:1100},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame;window.__nativeRAF=raf;window.requestAnimationFrame=cb=>{window.__frame=cb;return window.__freeze?0:raf(cb);};});
 await page.goto('http://127.0.0.1:8766/'+encodeURIComponent('แผนผังงานซ่อมอาคาร.html'),{waitUntil:'networkidle',timeout:60000});
 if(process.env.QA_ONLINE==='1')await page.waitForFunction(()=>!!window.facility,{timeout:30000});
 await expect(page.locator('#ticketRows tr')).toHaveCount(12);
 const modelReady=await page.evaluate(()=>!!window.facility);
 await page.evaluate(()=>window.__freeze=true);await page.waitForTimeout(300);
 console.log('Initial dashboard and model:',modelReady?'PASS (WebGL ready)':'PASS (offline fallback)');
 await page.locator('[data-kpi="pending"]').click();await expect(page.locator('#ticketRows tr')).toHaveCount(5);
 await expect(page.locator('#statusFilter')).toHaveValue('pending');
 await page.locator('#resetFilters').click();await page.locator('.category-legend [data-category="0"]').click();await expect(page.locator('#ticketRows tr')).toHaveCount(3);
 await page.locator('#buildingFilter').selectOption('B1');await expect(page.locator('#ticketRows tr')).toHaveCount(2);
 await page.locator('#resetFilters').click();await page.locator('#rankingChart [data-location="B1:1"]').click();
 await expect(page.locator('#buildingFilter')).toHaveValue('B1');await expect(page.locator('#ticketRows tr')).toHaveCount(4);await expect(page.locator('#crumb')).toContainText('ชั้น 1');
 if(modelReady){
  await expect(page.locator('#labels .pin-lbl')).toHaveCount(4);
  await page.locator('[data-kpi="pending"]').click();await expect(page.locator('#labels .pin-lbl')).toHaveCount(2);
  await page.evaluate(()=>window.__frame(performance.now()));await page.locator('#labels .pin-lbl').first().click();await expect(page.locator('#jobDrawer')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('[data-kpi="pending"]').click();await expect(page.locator('#labels .pin-lbl')).toHaveCount(4);await page.evaluate(()=>window.__frame(performance.now()));
 }
 await page.locator('#ticketRows button[data-open-job="WO-6910-014"]').click();await expect(page.locator('#jobDrawer')).toBeVisible();await expect(page.locator('#drawerTitle')).toContainText('แอร์');await expect(page.locator('.timeline li')).toHaveCount(4);
 await page.keyboard.press('Escape');await expect(page.locator('#jobDrawer')).not.toBeVisible();
 await page.locator('#resetFilters').click();await page.locator('#search').fill('nothing-matches-this');await expect(page.locator('#categoryChart')).toContainText('ยังไม่มีงานซ่อมในช่วงนี้');await expect(page.locator('#monthlyChart')).toContainText('ยังไม่มีงานซ่อมในช่วงนี้');await expect(page.locator('#rankingChart')).toContainText('ยังไม่มีงานซ่อมในช่วงนี้');await expect(page.locator('#exportBtn')).toBeDisabled();
 await page.locator('#resetFilters').click();await page.locator('[data-month="2025-11"]').click();await expect(page.locator('#tableCount')).toHaveText('0');
 await page.locator('#resetFilters').click();await page.locator('#period').selectOption('today');await expect(page.locator('#tableCount')).toHaveText('5');
 await page.locator('#resetFilters').click();await page.locator('#sort').selectOption('updated');await expect(page.locator('#ticketRows tr').first()).toContainText('WO-6910-022');
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloadPromise;await download.saveAs(path.join(__dirname,'export-check.csv'));const csv=fs.readFileSync(path.join(__dirname,'export-check.csv'),'utf8');if(csv.split('\r\n').length!==13||!csv.includes('WO-6910-014'))throw Error('CSV mismatch');
 console.log('Filters, cross-selection, drawer, empty states, sort and CSV: PASS');
 await page.locator('#themeBtn').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#themeBtn').click();
 await page.locator('#collapseNav').click();await expect(page.locator('html')).toHaveClass(/nav-collapsed/);await page.locator('#collapseNav').click();
 for(const width of [1512,1280,1024,768,390,360]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);const size=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));if(size.scroll>size.w)throw Error('Horizontal overflow '+JSON.stringify(size));}
 console.log('Responsive widths 1512 / 1280 / 1024 / 768 / 390 / 360: PASS');
 await page.setViewportSize({width:390,height:844});await page.locator('#panelToggle').click();await expect(page.locator('#panelToggle')).toHaveAttribute('aria-expanded','false');
 await page.locator('.bottom-nav [data-directory="settings"]').click();await expect(page.locator('#directoryDialog')).toBeVisible();await page.locator('[data-theme-choice="dark"]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(3600);await page.screenshot({path:path.join(__dirname,'mobile-dark.png'),fullPage:false,timeout:15000});
 await page.evaluate(()=>{setTheme('light');resetFilters();});await page.screenshot({path:path.join(__dirname,'mobile.png'),fullPage:false,timeout:15000});
 await page.setViewportSize({width:1512,height:1100});await page.evaluate(()=>{window.facility?.focusBuilding(null);window.__frame?.(performance.now());});await page.waitForTimeout(300);
 await page.mouse.move(0,0);await page.screenshot({path:path.join(__dirname,'desktop.png'),fullPage:true,timeout:15000});
 if(modelReady){await page.evaluate(()=>{window.facility.openFloor('B1',1);window.__frame?.(performance.now());});await page.locator('#model').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'floor.png'),fullPage:false,timeout:15000});}
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Themes, navigation, keyboard dismissal and JavaScript errors: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
