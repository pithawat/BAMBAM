// Browser checks for the standalone CR-010/CR-011 proposal.
const { chromium } = require('../../frontend/node_modules/@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = file => pathToFileURL(path.join(__dirname,file)).href;
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    async function noOverflow(label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);}
    for(const width of [375,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      for(const [file,name] of [['index.html','services'],['repair-my.html','repair-my'],['ticket-detail.html','ticket-detail']]){
        await page.goto(url(file));await page.evaluate(()=>document.fonts.ready);
        await noOverflow(`${file} overflows at ${width}`);
        assert.equal(await page.locator('.global-nav [data-service]').count(),3);
        assert.equal(await page.locator('.app-header img').count(),1,'Logo only in navbar');
        assert(await page.locator('.brand img').evaluate(img=>img.complete&&img.naturalWidth>0));
        if(width===375||width===1440)await page.screenshot({path:path.join(__dirname,`${name}-${width}.png`),fullPage:true});
      }
    }
    await page.goto(url('index.html'));
    await page.locator('[data-service="car"]').click();
    assert(await page.getByText('บริการนี้กำลังเตรียมเปิดให้ใช้งาน',{exact:false}).isVisible());
    await page.locator('[data-service="room"]').click();
    assert.equal(await page.locator('h1').innerText(),'จองห้องประชุม');
    await page.goto(url('repair-my.html'));
    assert.equal(await page.locator('.tickets tbody tr').count(),8);
    assert.equal(await page.locator('#result-count').innerText(),'8 งาน');
    assert.equal(await page.locator('.ticket-group').count(),3);
    assert.equal(await page.locator('.stats').count(),0,'Reference uses grouped tables, not dashboard statistic cards');
    const progressSummary=page.locator('[data-group="in_progress"] > summary');
    await progressSummary.click();
    assert.equal(await page.locator('[data-group="in_progress"]').getAttribute('open'),null);
    await page.locator('#search').click();
    assert.equal(await page.locator('[data-group="resolved"]').getAttribute('open'),'','Account dismiss handler must not collapse ticket groups');
    await progressSummary.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-group="in_progress"]').getAttribute('open'),'');
    assert((await page.locator('.tickets tbody tr').last().innerText()).includes('RP-2569-000141'),'Older October 4 record must sort last');
    await page.locator('[data-relation="following"]').click();
    assert.equal(await page.locator('.tickets tbody tr').count(),2);
    assert.equal(await page.locator('.tickets .violet').count(),0,'Subscriber cannot evaluate');
    await page.locator('#status-filter').selectOption('resolved');
    assert.equal(await page.locator('.tickets tbody tr').count(),1);
    await page.locator('[data-reset]').first().click();
    await page.locator('#range').selectOption('7');
    assert.equal(await page.locator('#result-count').innerText(),'7 งาน');
    await page.locator('#search').fill('000148');
    assert.equal(await page.locator('.tickets tbody tr').count(),1);
    await page.locator('.issue-link').click();
    assert.equal(await page.locator('h1').innerText(),'แอร์ไม่เย็น · มีน้ำหยด');
    await page.locator('.back-link').click();
    assert.equal(await page.locator('#search').inputValue(),'000148');
    assert.equal(await page.locator('#range').inputValue(),'7');
    await page.locator('#search').fill('no-match');
    assert(await page.getByText('ไม่พบงานที่ตรงกับตัวกรอง',{exact:true}).isVisible());
    await page.locator('[data-reset]').first().click();
    await page.locator('#status-filter').selectOption('closed');
    await page.locator('#sort').selectOption('oldest');
    assert((await page.locator('.tickets tbody tr').first().innerText()).includes('000141'));
    await page.locator('#sort').selectOption('updated');
    assert((await page.locator('.tickets tbody tr').first().innerText()).includes('000142'));
    await page.locator('[data-reset]').first().click();
    for(const state of ['loading','empty','error','forbidden']){
      await page.locator('#scenario').selectOption(state);await noOverflow(state);
      if(state==='error'){await page.locator('[data-retry]').click();assert.equal(await page.locator('.tickets tbody tr').count(),8);}
    }
    await page.goto(url('ticket-detail.html'));
    for(const width of [375,1440]){
      await page.setViewportSize({width,height:1000});
      for(const step of ['awaiting_assessment','in_repair','reworking','awaiting_rating','closed','date_changed','auto_closed','admin_closed']){
        await page.locator('#step').selectOption(step);
        for(const viewer of ['reporter','subscriber']){
          await page.locator('#viewer').selectOption(viewer);await noOverflow(`${step} ${viewer} ${width}`);
          assert.equal(await page.locator('[data-action="rate"]').count(),step==='awaiting_rating'&&viewer==='reporter'?1:0);
          const text=await page.locator('main').innerText();
          for(const hidden of ['ความเร่งด่วน','คะแนนช่างภายนอก','ลำดับคิว'])assert(!text.includes(hidden));
          if(step==='reworking')assert.equal(await page.locator('.timeline li').count(),6);
          if(step==='auto_closed')assert(!text.includes('5/5'));
        }
      }
    }
    await page.locator('#step').selectOption('awaiting_rating');
    await page.locator('#viewer').selectOption('reporter');
    await page.locator('[data-action="rate"]').click();
    await page.locator('#demo-submit').click();
    assert(await page.getByText('กรุณาเลือกคะแนนก่อนส่งผลประเมิน',{exact:true}).isVisible());
    await page.locator('[data-score="1"]').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-score="2"]').getAttribute('aria-checked'),'true');
    await page.locator('#demo-submit').click();
    assert(!await page.locator('dialog').isVisible());
    await page.locator('[data-action="send-back"]').click();
    await page.locator('#demo-submit').click();
    assert(await page.getByText('กรุณาระบุปัญหาที่ยังพบ',{exact:true}).isVisible());
    await page.keyboard.press('Escape');
    assert(await page.locator('[data-action="send-back"]').evaluate(el=>el===document.activeElement));
    await page.locator('#viewer').selectOption('subscriber');
    await page.locator('[data-history]').click();
    assert(!(await page.locator('dialog').innerText()).includes('ความเร่งด่วน'));
    await page.keyboard.press('Escape');
    for(const state of ['loading','empty','error','forbidden','not-found']){await page.locator('#scenario').selectOption(state);await noOverflow(`detail ${state}`);if(state==='empty')assert(await page.locator('#ticket-title').isVisible(),'Missing evidence must not hide ticket context');}
    await page.locator('.account summary').focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');
    assert(await page.locator('.account summary').evaluate(el=>el===document.activeElement));
    assert.deepEqual(errors,[]);
    console.log('PASS: 3 pages x 4 widths; neutral navigation; list counts/search/relation/date/reset/back; 8 detail variants x 2 viewers x 2 widths; states; keyboard/dialog validation; no runtime errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
