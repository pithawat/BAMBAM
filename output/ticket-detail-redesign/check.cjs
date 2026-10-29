// Visual and interaction smoke check for the standalone proposal only.
const { chromium } = require('../../frontend/node_modules/@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    for(const width of [375,768,1280,1440]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
      const columns=await page.locator('.evidence-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width<600?1:2);
      if([375,1280,1440].includes(width)) await page.screenshot({path:path.join(__dirname,`preview-${width}.png`),fullPage:true});
    }
    await page.locator('[data-thumb="before"][data-index="1"]').click();
    assert.equal(await page.locator('[data-thumb="before"][data-index="1"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-enlarge="before"]').click();
    assert(await page.locator('#dialog').isVisible());
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('#dialog-title').innerText(),/1 \/ 2/);
    await page.keyboard.press('Escape');
    assert(await page.locator('[data-enlarge="before"]').evaluate(el=>el===document.activeElement));
    await page.locator('#viewer').selectOption('subscriber');
    assert.equal(await page.locator('[data-action]').count(),0);
    assert.equal(await page.locator('[data-quick-score]').count(),0);
    await page.locator('#viewer').selectOption('reporter');
    await page.locator('[data-action="rate"]').click();
    assert.equal(await page.locator('[data-score][aria-checked="true"]').count(),0);
    assert(await page.locator('#demo-submit').isDisabled());
    await page.locator('[data-score="4"]').click();
    assert.match(await page.locator('.rating-feedback').innerText(),/4 \/ 5 · ดีมาก/);
    assert(await page.locator('#demo-submit').isEnabled());
    await page.locator('#dialog').screenshot({path:path.join(__dirname,'rating-desktop.png')});
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-score="5"]').getAttribute('aria-checked'),'true');
    await page.keyboard.press('Escape');
    await page.locator('[data-quick-score="3"]').click();
    assert.equal(await page.locator('[data-score="3"]').getAttribute('aria-checked'),'true');
    await page.setViewportSize({width:375,height:812});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#dialog').screenshot({path:path.join(__dirname,'rating-mobile.png')});
    await page.locator('#demo-submit').click();
    assert.equal(await page.locator('#dialog').isVisible(),false);
    assert.match(await page.locator('#toast').innerText(),/ยังไม่ได้ส่งข้อมูลจริง/);
    assert.equal(await page.locator('#step').inputValue(),'awaiting_rating');
    await page.locator('[data-action="send-back"]').click();
    await page.locator('#demo-submit').click();
    assert(await page.locator('.form-error').isVisible());
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000});
    for(const step of ['awaiting_assessment','in_repair','reworking','awaiting_rating','closed','date_changed','auto_closed','admin_closed']) {
      await page.locator('#step').selectOption(step);
      assert(await page.locator('.evidence-card').isVisible());
      if(step==='reworking') assert(await page.getByRole('heading',{name:'ผลซ่อมครั้งก่อน'}).isVisible());
      if(['auto_closed','admin_closed'].includes(step)) assert.match(await page.locator('.evidence-notice').innerText(),/ไม่มีคะแนน/);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.locator('#step').selectOption('awaiting_rating');
    for(const state of ['loading','empty','error','forbidden','not-found']) {
      await page.locator('#scenario').selectOption(state);
      if(state==='empty') assert.equal(await page.locator('.pending-photo').count(),2);
      else assert.equal(await page.locator('.evidence-card').count(),0);
    }
    await page.locator('#scenario').selectOption('normal');
    await page.locator('[data-history]').click();
    assert(await page.locator('.history-list').isVisible());
    await page.keyboard.press('Escape');
    const typography=await page.locator('.timeline li h3').first().evaluate(el=>({size:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight,weight:getComputedStyle(el).fontWeight}));
    assert.deepEqual(typography,{size:'16px',line:'24px',weight:'600'});
    assert.equal(await page.locator('.done .marker').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(39, 65, 250)');
    assert.equal(await page.locator('.job-properties > div').count(),4);
    assert.match(await page.locator('.job-info').innerText(),/AC-05-012/);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.preview-bar').isVisible(),false);
    assert(await page.locator('.evidence-card').isVisible());
    await page.pdf({path:path.join(__dirname,'preview-print.pdf'),format:'A4',printBackground:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: responsive 375/768/1280/1440; gallery + keyboard + focus; reporter/follower; lifecycle + page states; timeline type; print; no JS errors.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
