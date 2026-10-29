// Standalone design proposal. All actions use the existing simulated dialogs.
const originalReviewPanel = reviewPanel;
reviewPanel = function(t) {
  if(t.step !== 'awaiting_rating' || viewer !== 'reporter') return originalReviewPanel(t);
  return `<section class="card review-card action-review" aria-labelledby="review-title">
    <div class="review-intro"><span class="review-icon" aria-hidden="true">${icon('star')}</span>
      <div><h2 id="review-title">ซ่อมเสร็จแล้ว · รอคุณประเมิน</h2>
        <p>ตรวจผลซ่อมด้านล่าง แล้วกดประเมินงานซ่อม<br>เพื่อให้คะแนนและแสดงความคิดเห็น</p></div>
    </div>
    <div class="review-picker">
      <button type="button" class="review-open" data-action="rate">${icon('star')}ประเมินงานซ่อม ${icon('right')}</button>
      <span class="shortcut-label">หรือเลือกคะแนนเพื่อเริ่มประเมิน</span>
      <div class="quick-stars" role="group" aria-label="เลือกคะแนนเพื่อเปิดแบบประเมิน">${[1,2,3,4,5].map(n=>`<button type="button" data-quick-score="${n}" aria-label="ประเมิน ${n} ดาว">${icon('star')}</button>`).join('')}</div>
    </div>
    <div class="review-bottom"><span>${icon('clock')}ประเมินภายใน 21 ต.ค. 2569 เวลา 10:20 น. ก่อนระบบปิดงานอัตโนมัติ</span><button type="button" data-action="send-back">${icon('refresh')}ยังไม่เรียบร้อย · ส่งกลับให้แก้</button></div>
  </section>`;
};
$('.preview-bar strong').textContent='CR-013 · ตัวอย่างการออกแบบ · ข้อมูลสมมติ';
detailRender();
