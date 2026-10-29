// Presentation-only extension of the existing local design preview.
// No API calls; example art is reused from the approved repository reference.
const renderOriginalDetail = detailRender;
const selectedPhotos = { before:0, after:0 };
const photoCounts = { before:2, after:3 };
const photoTitles = { before:'ก่อนซ่อม', after:'หลังซ่อม' };
const originalStagesFor = stagesFor;
stagesFor = function previewStages(ticket) {
  return originalStagesFor(ticket).map(stage=>stage.title==='ส่งกลับให้แก้'
    ? {...stage,time:'18 ต.ค. 2569 · 11:00'} : stage);
};

function picture(side, index) {
  const svg = acIllustration(side === 'after');
  // Different crops make each sample thumbnail distinguishable.
  return svg.replace('viewBox="0 0 520 310"', `viewBox="${['0 0 520 310','60 40 320 210','95 140 300 165'][index]}"`);
}

function gallery(side, empty, pending) {
  if (empty || pending) return `<div class="pending-photo">${icon(pending ? 'wrench' : 'image')}<span>${pending ? 'รอช่างบันทึกผลการซ่อม' : side === 'after' ? 'ไม่มีรูปหลังซ่อม' : 'ไม่มีรูปแนบ'}</span></div>`;
  return `<button type="button" class="photo-main" data-enlarge="${side}" aria-label="ขยายรูป${photoTitles[side]}">${picture(side,selectedPhotos[side])}<span class="photo-label">${selectedPhotos[side]+1} / ${photoCounts[side]} · ขยายรูป</span></button>
    <div class="thumb-strip" role="group" aria-label="รูป${photoTitles[side]}">${Array.from({length:photoCounts[side]},(_,i)=>`<button type="button" data-thumb="${side}" data-index="${i}" aria-pressed="${selectedPhotos[side]===i}" aria-label="เลือกรูป${photoTitles[side]} ${i+1}">${picture(side,i)}</button>`).join('')}<small>${photoCounts[side]} รูปตัวอย่าง</small></div>`;
}

function evidence(t) {
  const empty = scenario === 'empty';
  const rework = t.step === 'reworking';
  const hasResult = ['awaiting_rating','closed','reworking'].includes(t.step);
  return `<section class="card evidence-card" aria-labelledby="evidence-heading">
    <div class="evidence-heading"><h2 id="evidence-heading">${rework ? 'ผลซ่อมครั้งก่อน' : 'รายละเอียดการซ่อม'}</h2><span class="result-status">${icon(hasResult ? 'checkCircle' : 'clock')}${rework ? 'อยู่ระหว่างแก้ไข' : hasResult ? 'บันทึกผลแล้ว' : 'รอผลการซ่อม'}</span></div>
    <div class="repair-note"><span class="repair-note-icon">${icon('wrench')}</span><div><h3>${hasResult ? 'สิ่งที่ช่างดำเนินการ' : 'ช่างกำลังดูแลงานนี้'}</h3><p>${hasResult ? escapeHtml(t.result || 'ล้างแผงคอยล์เย็น เปลี่ยนท่อน้ำทิ้ง ทดสอบแล้วไม่มีน้ำหยด') : 'เมื่อซ่อมเสร็จ ช่างจะบันทึกรายละเอียดและแนบรูปให้คุณตรวจงานได้ที่นี่'}</p>${hasResult ? '<span class="repair-byline">ธนากร พึ่งบุญ · 18 ต.ค. 2569 เวลา 10:20 น.</span>' : ''}</div></div>
    ${rework ? '<div class="evidence-notice rework"><strong>เหตุผลที่ส่งกลับให้แก้</strong><p>ยังพบปัญหาเดิมหลังซ่อม รอช่างกำหนดวันเสร็จใหม่</p></div>' : ''}
    <div class="evidence-grid">
      <article class="evidence-half before"><header><h3>ก่อนซ่อม</h3><span>จากผู้แจ้ง</span></header><div data-gallery="before">${gallery('before',empty,false)}</div></article>
      <article class="evidence-half after"><header><h3>${rework ? 'หลังซ่อมครั้งก่อน' : 'หลังซ่อม'}</h3><span>จากช่าง</span></header><div data-gallery="after">${gallery('after',empty,!hasResult)}</div></article>
    </div>
    <div class="reported-detail"><div class="reported-title">${icon('file')}<h3>รายละเอียดที่แจ้ง</h3></div><p>${escapeHtml(empty ? 'ไม่มีรายละเอียดเพิ่มเติม' : t.note)}</p><span>แจ้งโดย${viewer === 'reporter' ? 'คุณ' : ' วรรณา สุขประเสริฐ'} · 15 ต.ค. 2569 เวลา 08:40 น.</span></div>
    ${t.step === 'closed' ? `<div class="evidence-notice">${closure === 'confirmed' ? 'คะแนนจากผู้แจ้ง 5/5 · ประเมินตรวจงานแล้ว' : closure === 'auto_closed' ? 'ปิดงานอัตโนมัติ · ไม่มีคะแนนจากผู้แจ้ง' : 'Admin ปิดงาน · ไม่มีคะแนนจากผู้แจ้ง'}</div>` : ''}
  </section>`;
}

function jobInfo(t) {
  const completed=['awaiting_rating','closed'].includes(t.step);
  const assigned=t.step!=='awaiting_assessment';
  const when=completed ? '18 ต.ค. 2569 <small>เวลา 10:20 น.</small>' : t.step==='awaiting_assessment' ? 'รอช่างกำหนด' : t.step==='reworking' ? 'รอช่างกำหนดวันใหม่' : changedDate ? '21 ต.ค. 2569' : escapeHtml(t.expected);
  return `<section class="card job-info" aria-labelledby="job-title"><h2 id="job-title">ข้อมูลงาน</h2>
    <div class="job-location"><span>${icon('pin')}</span><div><h3>ห้องประชุม 5B</h3><p>อาคารฝั่ง Office <i>/</i> ชั้น 5</p></div></div>
    <dl class="job-properties"><div><dt>หมวดงาน</dt><dd>${escapeHtml(t.category)}</dd></div><div><dt>อุปกรณ์</dt><dd>AC-05-012 <small>เครื่องปรับอากาศ</small></dd></div><div><dt>ความเร่งด่วน</dt><dd><span class="priority-tag"><span aria-hidden="true">•</span> สูง</span><small>จากอาการ “มีน้ำหยด”</small></dd></div><div><dt>${completed?'ซ่อมเสร็จเมื่อ':'คาดว่าจะเสร็จ'}</dt><dd>${when}</dd></div></dl>
    <div class="job-people"><div><span class="person-avatar">วส</span><div><span class="person-label">ผู้แจ้ง</span><strong>วรรณา สุขประเสริฐ</strong><small>ฝ่ายบัญชี · ผู้ติดตาม 1 คน</small></div></div><div><span class="person-avatar">ธพ</span><div><span class="person-label">ผู้ซ่อม</span><strong>${assigned?'ธนากร พึ่งบุญ':'รอช่างรับงาน'}</strong><small>${assigned?'ช่างของบริษัท':'จะแสดงเมื่อช่างเริ่มดำเนินการ'}</small></div></div></div>
  </section>`;
}

function reviewPanel(t) {
  if(t.step!=='awaiting_rating') return `<div class="state-next">${nextAction(t)}</div>`;
  if(viewer!=='reporter') return `<section class="card review-card follower-review"><span class="review-icon">${icon('checkCircle')}</span><div><h2>ซ่อมเสร็จแล้ว รอผู้แจ้งตรวจงาน</h2><p>คุณกำลังติดตามงานนี้ ผู้แจ้งเป็นผู้ประเมินหรือส่งกลับให้แก้</p></div></section>`;
  return `<section class="card review-card" aria-labelledby="review-title"><div class="review-intro"><span class="review-icon">${icon('checkCircle')}</span><div><h2 id="review-title">งานซ่อมเป็นอย่างไรบ้าง?</h2><p>ตรวจผลซ่อมด้านล่าง แล้วให้คะแนนความพึงพอใจ</p></div></div>
    <div class="review-picker"><div class="quick-stars" role="group" aria-label="เลือกคะแนนเพื่อเปิดแบบประเมิน">${[1,2,3,4,5].map(n=>`<button type="button" data-quick-score="${n}" aria-label="ประเมิน ${n} ดาว">${icon('star')}</button>`).join('')}</div><button type="button" class="review-open" data-action="rate">เลือกดาวเพื่อประเมิน ${icon('right')}</button></div>
    <div class="review-bottom"><span>${icon('clock')}ประเมินภายใน 21 ต.ค. 2569 เวลา 10:20 น. ก่อนระบบปิดงานอัตโนมัติ</span><button type="button" data-action="send-back">${icon('refresh')}ยังไม่เรียบร้อย · ส่งกลับให้แก้</button></div></section>`;
}

detailRender = function renderRefinedDetail() {
  renderOriginalDetail();
  const t={...selectedTicket,step:currentStep};
  const summary=$('.detail-main > section:first-child');
  if(summary) {
    const title=document.createElement('header');
    title.className='ticket-page-heading';
    title.innerHTML=`<div class="summary-top"><span class="ticket-reference">${number(t)}<button type="button" class="icon-button" data-copy-new aria-label="คัดลอกเลขงาน">${icon('copy')}</button></span><span class="ticket-step">${icon('clock')}${currentStep==='awaiting_rating'?'รอประเมินตรวจงาน':currentStep==='closed'?'ปิดงานแล้ว':currentStep==='reworking'?'ส่งกลับให้แก้':currentStep==='in_repair'?'กำลังดำเนินการ':'รับเรื่องแล้ว'}</span></div><h1 class="ticket-title">${escapeHtml(t.title)}</h1><p>แจ้งเมื่อ 15 ต.ค. 2569 เวลา 08:40 น.</p>`;
    $('.detail-layout').before(title);
    const review=document.createElement('div');review.className='review-container';review.innerHTML=reviewPanel(t);title.after(review);
    summary.outerHTML=jobInfo(t);
    $('[data-copy-new]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(number(t));toast('คัดลอกเลขงานแล้ว');}catch{toast(number(t));}});
    $$('[data-action]').forEach(b=>b.addEventListener('click',()=>actionDialog(b.dataset.action)));
    $$('[data-quick-score]').forEach(b=>b.addEventListener('click',()=>actionDialog('rate',Number(b.dataset.quickScore))));
  }
  const oldEvidence = $('[aria-label="รายละเอียดและผลการซ่อม"]');
  if (oldEvidence) oldEvidence.outerHTML = evidence({...selectedTicket,step:currentStep});
  $$('.timeline li').forEach((li,index)=>{
    const heading = $('h3',li);
    if (li.classList.contains('now')) {
      if (currentStep === 'awaiting_rating') {
        li.classList.add('review');
        heading.textContent = viewer === 'reporter' ? 'รอคุณประเมินตรวจงาน' : 'รอผู้แจ้งประเมินตรวจงาน';
      }
      if (currentStep === 'reworking') li.classList.add('rework');
      const tag = $('.current-tag',li);
      tag.textContent = 'ตอนนี้';
      heading.append(' ',tag);
    }
    // The current implementation does not fabricate dates for future steps.
    const when = $('.when',li);
    if (when && ['ขั้นตอนปัจจุบัน','ขั้นตอนถัดไป'].includes(when.textContent)) when.remove();
    if (index===0) $('p',li).textContent = viewer === 'reporter' ? `คุณส่งรายละเอียดและรูป ${scenario==='empty'?0:2} รูป` : 'ผู้แจ้งส่งรายละเอียดและรูป 2 รูป';
  });
  // All navigation remains inside the existing standalone previews.
  $$('a[href]').forEach(a=>{
    const href=a.getAttribute('href');
    if (/^(index|repair-my)\.html/.test(href)) a.setAttribute('href','../navbar-redesign/'+href);
  });
};

function refreshGallery(side) {
  $(`[data-gallery="${side}"]`).innerHTML=gallery(side,false,false);
}

function showPhoto(side) {
  const index=selectedPhotos[side];
  openDialog(`รูป${photoTitles[side]} · ${index+1} / ${photoCounts[side]}`,
    `<div class="gallery-art">${picture(side,index)}</div><div class="gallery-controls"><button class="btn" data-photo-nav="-1" aria-label="รูปก่อนหน้า">${icon('back')}ก่อนหน้า</button><span>ภาพประกอบตัวอย่าง</span><button class="btn" data-photo-nav="1" aria-label="รูปถัดไป">ถัดไป${icon('arrow')}</button></div>`);
  const opener=dialogOpener;
  function move(delta) {
    selectedPhotos[side]=(selectedPhotos[side]+delta+photoCounts[side])%photoCounts[side];
    $('.gallery-art').innerHTML=picture(side,selectedPhotos[side]);
    $('#dialog-title').textContent=`รูป${photoTitles[side]} · ${selectedPhotos[side]+1} / ${photoCounts[side]}`;
    refreshGallery(side);
    // Re-rendering the gallery replaces the original trigger.
    dialogOpener=$(`[data-enlarge="${side}"]`) || opener;
  }
  $$('[data-photo-nav]').forEach(b=>b.addEventListener('click',()=>move(Number(b.dataset.photoNav))));
  const onKey=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}};
  $('#dialog').addEventListener('keydown',onKey);
  $('#dialog').addEventListener('close',()=>$('#dialog').removeEventListener('keydown',onKey),{once:true});
}

const originalActionDialog=actionDialog;
actionDialog=function refinedReviewDialog(action,initialScore=0) {
  if(action!=='rate') { originalActionDialog(action); return; }
  let score=initialScore;
  const ratingLabels=['','ต้องปรับปรุง','พอใช้','ดี','ดีมาก','ยอดเยี่ยม'];
  openDialog('ประเมินงานซ่อม',`<div class="rating-context">${icon('wrench')}<div><strong>แอร์ไม่เย็น · มีน้ำหยด</strong><span>ห้องประชุม 5B · ซ่อมเสร็จ 18 ต.ค. 2569</span></div></div>
    <div class="rating-question"><h3>คุณพอใจกับงานซ่อมครั้งนี้แค่ไหน?</h3><p>เลือกคะแนนที่ตรงกับประสบการณ์ของคุณ</p></div>
    <div class="rating-options" role="radiogroup" aria-label="คะแนนความพึงพอใจ">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" aria-checked="false" tabindex="${n===1?0:-1}" aria-label="${n} ดาว ${ratingLabels[n]}" data-score="${n}">${icon('star')}<span>${n}</span></button>`).join('')}</div>
    <p class="rating-feedback" aria-live="polite">ยังไม่ได้เลือกคะแนน</p>
    <label for="comment" class="rating-comment-label">มีอะไรอยากบอกเราเพิ่มเติม? <span>ไม่บังคับ</span></label><textarea id="comment" placeholder="เช่น ซ่อมเรียบร้อย ช่างอธิบายวิธีดูแลได้ชัดเจน" rows="3"></textarea>
    <div class="rating-submit-area"><p>${icon('info')}เมื่อยืนยันผลประเมิน งานนี้จะถูกปิด</p><button type="button" class="btn primary" id="demo-submit" disabled>ยืนยันผลประเมิน ${icon('arrow')}</button><span class="rating-preview-note">ตัวอย่างการประเมิน · ยังไม่ส่งข้อมูลจริง</span></div>`);
  $('#dialog').classList.add('rating-dialog');
  $('#dialog').addEventListener('close',()=>$('#dialog').classList.remove('rating-dialog'),{once:true});
  function setScore(n) {
    score=n;
    $$('[data-score]').forEach(b=>{const value=Number(b.dataset.score);b.setAttribute('aria-checked',String(value===n));b.classList.toggle('filled',value<=n);b.tabIndex=value===(n||1)?0:-1;});
    $('.rating-feedback').textContent=n?`${n} / 5 · ${ratingLabels[n]}`:'ยังไม่ได้เลือกคะแนน';
    $('#demo-submit').disabled=!n;
  }
  $$('[data-score]').forEach(b=>{
    b.addEventListener('click',()=>setScore(Number(b.dataset.score)));
    b.addEventListener('keydown',e=>{
      if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();
      const n=e.key==='Home'?1:e.key==='End'?5:Math.max(1,Math.min(5,Number(b.dataset.score)+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)));
      setScore(n);$(`[data-score="${n}"]`).focus();
    });
  });
  setScore(score);
  $('#demo-submit').addEventListener('click',()=>{if(!score)return;$('#dialog').close();toast('ขอบคุณสำหรับการทดลองประเมิน — ยังไม่ได้ส่งข้อมูลจริง');});
};

document.addEventListener('click',event=>{
  const thumb=event.target.closest('[data-thumb]');
  if(thumb){const side=thumb.dataset.thumb;selectedPhotos[side]=Number(thumb.dataset.index);refreshGallery(side);$(`[data-thumb="${side}"][data-index="${selectedPhotos[side]}"]`).focus();}
  const enlarge=event.target.closest('[data-enlarge]');
  if(enlarge) showPhoto(enlarge.dataset.enlarge);
});

// The prototype is scoped to the air-conditioner example shown in the request.
selectedTicket=tickets[0];
currentStep=selectedTicket.step;
$('#step').value=currentStep;
$('.preview-bar strong').textContent='S07 · DESIGN PREVIEW';
detailRender();
