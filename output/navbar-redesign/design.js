// Standalone design proposal. All records and actions are local examples.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  home:'<path d="m3 10 9-7 9 7v10H3Z M9 20v-7h6v7"/>',
  wrench:'<path d="m14 6 4-4a6 6 0 0 1-7 8l-8 8a2 2 0 0 0 3 3l8-8a6 6 0 0 0 8-7l-4 4Z"/>',
  car:'<path d="m4 10 2-6h12l2 6v8H4ZM4 10h16M7 14h1m8 0h1M6 18v2m12-2v2"/>',
  room:'<path d="M4 21V4h16v17M2 21h20M8 8h2m4 0h2M8 12h2m4 0h2M10 21v-5h4v5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevron:'<path d="m7 10 5 5 5-5"/>',right:'<path d="m9 6 6 6-6 6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>',checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 4 4 4-6 5 7"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',print:'<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7Z"/>',file:'<path d="M14 2H5v20h14V7Zm0 0v5h5M8 12h8M8 16h6"/>'
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${paths[name] || paths.file}</svg>`;
const screen = document.body.dataset.screen;
const params = new URLSearchParams(location.search);
const services = [{key:'repair',name:'แจ้งซ่อม',icon:'wrench',desc:'แจ้งปัญหาและติดตามความคืบหน้าการซ่อม',href:'repair-my.html'}, {key:'car',name:'จองรถ',icon:'car',desc:'บริการจองรถส่วนกลางสำหรับการเดินทาง',href:'index.html?service=car'}, {key:'room',name:'จองห้องประชุม',icon:'room',desc:'บริการจองพื้นที่ประชุมสำหรับคุณและทีม',href:'index.html?service=room'}];
const activeService = screen === 'home' ? params.get('service') : 'repair';
const options = (items, current) => items.map(([key, text]) => `<option value="${key}" ${key === current ? 'selected' : ''}>${text}</option>`).join('');
const scenarioOptions = [['normal','ข้อมูลตัวอย่าง'],['loading','กำลังโหลด'],['empty','ยังไม่มีงาน'],['error','โหลดไม่สำเร็จ'],['forbidden','ไม่มีสิทธิ์เข้าถึง']];
if (screen === 'detail') scenarioOptions.push(['not-found','ไม่พบงาน']);
$('#shell').innerHTML = `<a href="#main" class="skip">ข้ามไปเนื้อหา</a><div class="preview-bar"><span><strong>DESIGN PREVIEW</strong> &nbsp; / &nbsp; ${screen === 'home' ? 'THREE SERVICES' : screen === 'list' ? 'REPAIR · MY TICKETS' : 'REPAIR · TICKET DETAIL'}</span><div class="preview-controls"><a href="index.html">หน้ารวมบริการ</a>${screen === 'home' ? '<a href="repair-my.html">ดูแบบติดตามงานซ่อม</a>' : `<label>สถานการณ์<select id="scenario" aria-label="สถานการณ์ตัวอย่าง">${options(scenarioOptions,'normal')}</select></label>`}${screen === 'detail' ? `<label>มุมมอง<select id="viewer">${options([['reporter','ผู้แจ้ง'],['subscriber','ผู้ติดตาม']], params.get('viewer') || 'reporter')}</select></label>` : ''}</div></div><header class="app-header"><a class="brand" href="index.html" aria-label="BAMBAM หน้าแรก"><img src="../../frontend/public/brand/bam-logo.webp" alt="BAMBAM" width="96" height="31"></a><nav class="global-nav" aria-label="บริการหลัก"><a class="nav-home" href="index.html" ${!activeService ? 'aria-current="page"' : ''}>หน้าแรก</a>${services.map(s => `<a href="${s.href}" data-service="${s.key}" ${activeService === s.key ? 'aria-current="page"' : ''}>${icon(s.icon)}${s.name}</a>`).join('')}</nav><div class="utilities"><button class="icon-button" aria-label="แจ้งเตือน" data-demo="ตัวอย่างทางเข้าแจ้งเตือนของทั้ง 3 บริการ">${icon('bell')}</button><details class="account"><summary aria-label="เมนูบัญชีผู้ใช้"><span class="avatar">ว</span><span class="account-name">วรรณา<br><small>พนักงานทั่วไป</small></span>${icon('chevron','chevron')}</summary><div class="dropdown"><button data-demo="ตัวอย่างทางเข้าโปรไฟล์">${icon('user')}โปรไฟล์</button><button data-demo="เมื่อใช้จริง จะเปิดหน้าต่างยืนยันออกจากระบบ">ออกจากระบบ</button></div></details></div></header>`;
const main = $('#main');
const footer = `<p class="footer-note">${icon('info')}ต้นแบบเพื่อทบทวน UX · ข้อมูลสมมติและปุ่มทดลอง ยังไม่เชื่อมระบบจริง</p>`;
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4000); }
function closeMenus() { $$('details.account[open]').forEach(d => d.open = false); }
document.addEventListener('click', event => {
  if (!event.target.closest('.account')) closeMenus();
  const demo = event.target.closest('[data-demo]');
  if (demo) { event.preventDefault(); const d = demo.closest('details'); if(d) $('summary',d).focus(); closeMenus(); toast(demo.dataset.demo); }
  if (event.target.closest('[data-close]')) $('#dialog').close();
});
document.addEventListener('keydown', event => { if(event.key === 'Escape') { const d = $('details.account[open]'); if(d) $('summary',d).focus(); closeMenus(); } });
const crumb = detail => `<nav class="breadcrumb" aria-label="เส้นทางหน้า"><a href="index.html">หน้าแรก</a>${icon('right')}<a href="repair-my.html">แจ้งซ่อม</a>${icon('right')}${detail ? '<a href="repair-my.html">ติดตามงานซ่อม</a>' : '<span aria-current="page">ติดตามงานซ่อม</span>'}${detail ? icon('right') + '<span aria-current="page">รายละเอียดงาน</span>' : ''}</nav>`;
function statePanel(kind, filtered = false) {
  if(kind === 'loading') return `<div aria-busy="true" aria-label="กำลังโหลดข้อมูล">${[1,2,3].map(() => '<div class="card skeleton-card"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>').join('')}</div>`;
  const states = {
    empty:['list',filtered ? 'ไม่พบงานที่ตรงกับตัวกรอง' : 'ยังไม่มีงานซ่อมที่คุณแจ้งหรือติดตาม',filtered ? 'ลองเปลี่ยนคำค้นหรือเลือกสถานะอื่น' : 'เมื่อแจ้งปัญหาแล้ว คุณจะติดตามความคืบหน้าได้ที่นี่'],
    error:['refresh','โหลดข้อมูลไม่สำเร็จ','ลองอีกครั้งได้ โดยตัวกรองที่เลือกไว้จะยังอยู่'],
    forbidden:['lock','คุณไม่มีสิทธิ์ดูข้อมูลนี้','กลับไปดูงานที่คุณแจ้งหรือติดตามได้'],
    'not-found':['search','ไม่พบงานซ่อมนี้','งานนี้อาจไม่มีอยู่ หรือเลขงานในลิงก์ไม่ถูกต้อง']
  };
  const [i,title,desc] = states[kind] || states.error;
  return `<section class="state-panel"><span class="service-icon">${icon(i)}</span><h2>${title}</h2><p>${desc}</p><div class="actions">${kind === 'error' ? '<button class="btn primary" data-retry>ลองอีกครั้ง</button>' : filtered ? '<button class="btn" data-reset>ล้างตัวกรอง</button>' : kind === 'empty' ? '<button class="btn primary" data-demo="เปิดฟอร์มแจ้งซ่อมเดิมเมื่อเชื่อมระบบจริง">แจ้งซ่อม</button>' : '<a href="repair-my.html" class="btn">กลับไปติดตามงานซ่อม</a>'}</div></section>`;
}
if (screen === 'home') {
  const service = services.find(s => s.key === activeService);
  main.innerHTML = service ? `<section class="card unavailable-service"><span class="service-icon">${icon(service.icon)}</span><p class="eyebrow">BAMBAM / ${service.name}</p><h1>${service.name}</h1><p>บริการนี้กำลังเตรียมเปิดให้ใช้งาน<br>คุณยังเข้าถึงบริการอื่นได้จากเมนูด้านบน</p><a href="index.html" class="btn">กลับไปหน้ารวมบริการ</a></section>${footer}` : `<section class="home-intro"><p class="eyebrow">YOUR WORKPLACE, CONNECTED</p><h1>ทุกบริการที่ทำงาน ในที่เดียว</h1><p>เลือกบริการที่คุณต้องการ แล้วให้แบมแบมช่วยดูแล</p></section><section class="service-grid" aria-label="บริการทั้งหมด">${services.map(s => `<article class="card service-card"><span class="service-icon">${icon(s.icon)}</span><h2>${s.name}</h2><p>${s.desc}</p><a class="btn" href="${s.href}" aria-label="เข้าสู่บริการ${s.name}">เข้าสู่บริการ${icon('arrow')}</a></article>`).join('')}</section><p class="home-note">${icon('info')}จองรถและจองห้องประชุมกำลังเตรียมเปิดให้บริการ</p>${footer}`;
}

const tickets = [
  {id:'148',title:'แอร์ไม่เย็น · มีน้ำหยด',place:'อาคารฝั่ง Office · ชั้น 5 · ห้องประชุม 5B',category:'ระบบปรับอากาศ',step:'awaiting_rating',relation:'reported',created:'2026-10-15',expected:'18 ต.ค. 2569',updated:'18 ต.ค. 10:20',note:'น้ำหยดบริเวณโต๊ะประชุม และแอร์ไม่เย็นตั้งแต่ช่วงเช้า',result:'ล้างแผงคอยล์เย็นและเปลี่ยนท่อน้ำทิ้ง ทดสอบแล้วแอร์เย็นตามปกติและไม่มีน้ำหยด'},
  {id:'147',title:'ไฟไม่ติด',place:'อาคารฝั่ง Office · ชั้น 3 · ห้องทำงาน',category:'ไฟฟ้าและแสงสว่าง',step:'in_repair',relation:'reported',created:'2026-10-15',expected:'20 ต.ค. 2569',updated:'18 ต.ค. 09:10',note:'หลอดไฟเหนือโต๊ะทำงานไม่ติด'},
  {id:'146',title:'ประตูปิดไม่สนิท',place:'อาคารฝั่ง Office · ชั้น 2 · ห้องประชุม',category:'อาคารและเฟอร์นิเจอร์',step:'awaiting_assessment',relation:'reported',created:'2026-10-16',expected:'รอช่างกำหนด',updated:'17 ต.ค. 16:45',note:'ประตูห้องประชุมปิดไม่สนิท'},
  {id:'145',title:'น้ำรั่ว',place:'อาคาร Office โรงงานบางซ่อน · ชั้น 1 · ห้องน้ำ',category:'ประปาและสุขภัณฑ์',step:'reworking',relation:'reported',created:'2026-10-15',expected:'รอช่างกำหนดวันใหม่',updated:'18 ต.ค. 08:30',note:'มีน้ำซึมใต้ก๊อกอ่างล้างมือ'},
  {id:'144',title:'ฝ้าเพดานรั่ว',place:'อาคารฝั่ง Office · ชั้น 4 · ทางเดิน',category:'อาคารและเฟอร์นิเจอร์',step:'awaiting_rating',relation:'following',created:'2026-10-15',expected:'18 ต.ค. 2569',updated:'18 ต.ค. 10:20',note:'มีน้ำหยดจากฝ้าบริเวณทางเดิน',result:'แก้ไขจุดรั่วและเปลี่ยนฝ้าในบริเวณที่ชำรุดแล้ว'},
  {id:'143',title:'เก้าอี้ชำรุด',place:'อาคารฝั่ง Office · ชั้น 5 · พื้นที่ทำงาน',category:'อาคารและเฟอร์นิเจอร์',step:'in_repair',relation:'following',created:'2026-10-15',expected:'20 ต.ค. 2569',updated:'17 ต.ค. 13:30',note:'ขาเก้าอี้หลวม'},
  {id:'142',title:'ปลั๊กไม่มีไฟ',place:'อาคารฝั่ง Office · ชั้น 2 · ห้องทำงาน',category:'ไฟฟ้าและแสงสว่าง',step:'closed',relation:'reported',created:'2026-10-15',expected:'18 ต.ค. 2569',updated:'18 ต.ค. 11:00',note:'ปลั๊กบริเวณโต๊ะทำงานไม่มีไฟ',result:'เปลี่ยนปลั๊กและทดสอบการใช้งานเรียบร้อยแล้ว'},
  {id:'141',title:'ท่อตัน',place:'อาคารฝั่ง Office · ชั้น 1 · ห้องน้ำ',category:'ประปาและสุขภัณฑ์',step:'closed',relation:'reported',created:'2026-10-01',expected:'4 ต.ค. 2569',updated:'4 ต.ค. 11:00',note:'อ่างล้างมือระบายน้ำช้า',result:'ทำความสะอาดท่อระบายน้ำ ทดสอบแล้วน้ำไหลสะดวก'}
];
const labels = {awaiting_assessment:'รับเรื่องแล้ว',in_repair:'กำลังดำเนินการ',reworking:'ส่งกลับให้แก้',awaiting_rating:'รอประเมินตรวจงาน',closed:'ปิดงานแล้ว'};
const stepIcons = {awaiting_assessment:'clock',in_repair:'wrench',reworking:'refresh',awaiting_rating:'star',closed:'checkCircle'};
const badge = (t, viewer) => `<span class="badge ${t.step}">${icon(stepIcons[t.step])}${t.step === 'awaiting_rating' && (viewer === 'reporter' || (!viewer && t.relation === 'reported')) ? 'รอคุณประเมินตรวจงาน' : labels[t.step]}</span>`;
const number = t => 'RP-2569-000' + t.id;
const group = t => t.step === 'closed' ? 'closed' : t.step === 'awaiting_rating' ? 'resolved' : 'in_progress';
let filters = {status:params.get('status') || 'all',relation:params.get('relation') || 'all',q:params.get('q') || '',range:params.get('range') || 'all',sort:params.get('sort') || 'updated'};
const collapsedGroups = new Set();
let scenario = 'normal';
function listUrl() { const q = new URLSearchParams(); Object.entries(filters).forEach(([key,value]) => { if(value && value !== 'all') q.set(key,value); }); return 'repair-my.html' + (q.size ? '?' + q : ''); }
function detailUrl(t) { const q = new URLSearchParams({id:t.id,viewer:t.relation === 'following' ? 'subscriber' : 'reporter',back:listUrl()}); return 'ticket-detail.html?' + q; }
function listRender() {
  main.innerHTML = `<header class="workspace-heading"><div class="heading-intro"><img class="workspace-mascot" src="../../frontend/public/brand/mascot-white-leopard-bust-v2.png" width="64" height="64" alt="" aria-hidden="true"><div class="heading-copy"><h1 id="workspace-title">ติดตามงานซ่อม</h1><p>งานที่คุณแจ้งและติดตาม · ดูความคืบหน้าและตรวจงานเมื่อซ่อมเสร็จ</p></div></div><button class="btn new-ticket" data-demo="เปิดฟอร์มแจ้งซ่อมเดิมเมื่อเชื่อมระบบจริง">${icon('plus')} แจ้งซ่อมใหม่</button></header>
    <a class="review-focus" id="review-focus" hidden></a>
    <section class="ticket-workspace" aria-labelledby="overview-title"><div class="overview-heading"><h2 id="overview-title">ภาพรวมงานซ่อม</h2><span>เลือกสถานะเพื่อกรองรายการ</span></div>
    <div class="overview" role="group" aria-label="เลือกสถานะงานซ่อม">${[['all','ทุกสถานะ','ทุกงานที่คุณเกี่ยวข้อง','list'],['resolved','รอประเมินตรวจงาน','งานซ่อมเสร็จ รอผู้แจ้งตรวจ','star'],['in_progress','กำลังดำเนินการ','รับเรื่องแล้วหรืออยู่ระหว่างซ่อม','wrench'],['closed','ปิดงานแล้ว','ดูประวัติงานที่เสร็จ','checkCircle']].map(([value,label,hint,i]) => `<button class="overview-card" data-status="${value}" aria-pressed="${filters.status === value}"><span class="overview-icon">${icon(i)}</span><span class="overview-copy"><span class="overview-label">${label}</span><span class="overview-hint">${hint}</span></span><strong class="overview-count" data-count="${value}">0</strong></button>`).join('')}</div>
    <div class="view-tabs"><div class="view-tab-list" role="group" aria-label="มุมมองงานซ่อม">${[['all','ทั้งหมด','list'],['reported','ที่ฉันแจ้ง','user'],['following','ที่ฉันติดตาม','bell']].map(([value,label,i]) => `<button data-relation="${value}" aria-pressed="${filters.relation === value}">${icon(i)}${label}</button>`).join('')}</div><span class="workspace-count" id="result-count" role="status"></span></div>
    <div class="workspace-filters" aria-label="ตัวกรองงานซ่อม">
      <label class="filter-chip">${icon('clock')}<select id="range" aria-label="ช่วงวันที่แจ้ง">${options([['all','วันที่แจ้ง: ทั้งหมด'],['7','แจ้งใน 7 วันที่ผ่านมา'],['30','แจ้งใน 30 วันที่ผ่านมา'],['90','แจ้งใน 90 วันที่ผ่านมา']],filters.range)}</select></label>
      <label class="filter-chip sort-filter">${icon('list')}<select id="sort" aria-label="เรียงลำดับภายในกลุ่ม">${options([['updated','อัปเดตล่าสุดก่อน'],['newest','แจ้งล่าสุดก่อน'],['oldest','แจ้งเก่าสุดก่อน']],filters.sort)}</select></label>
      <label class="search">${icon('search')}<input type="search" id="search" aria-label="ค้นหาเรื่อง เลขงาน หรือสถานที่" placeholder="ค้นหาเรื่อง เลขงาน หรือสถานที่" maxlength="80" value="${escapeHtml(filters.q)}"></label>
      <button class="reset" data-reset>${icon('refresh')}ล้างตัวกรอง</button>
    </div><p class="list-guidance">${icon('info')}งานที่รอประเมินแสดงก่อน · กดชื่อเรื่องหรือปุ่มท้ายแถวเพื่อดูรายละเอียด</p><div id="list-content"></div></section>${footer}`;
  $$('[data-relation]').forEach(b => b.addEventListener('click', () => {filters.relation = b.dataset.relation; updateList();}));
  $$('[data-status]').forEach(b => b.addEventListener('click', () => {filters.status = b.dataset.status; updateList();}));
  $('#search').addEventListener('input', event => {filters.q = event.target.value; updateList();});
  $('#range').addEventListener('change', event => {filters.range = event.target.value; updateList();});
  $('#sort').addEventListener('change', event => {filters.sort = event.target.value; updateList();});
  updateList();
}
function sampleUpdatedAt(t) { const [,day,hour,minute] = t.updated.match(/^(\d+).*?(\d{2}):(\d{2})$/); return Date.parse(`2026-10-${day.padStart(2,'0')}T${hour}:${minute}:00+07:00`); }
function sortTickets(a,b) {
  const needsReview = t => t.step === 'awaiting_rating' && t.relation === 'reported';
  const reviewOrder = Number(needsReview(b)) - Number(needsReview(a));
  if(reviewOrder) return reviewOrder;
  if(filters.sort === 'newest') return b.created.localeCompare(a.created) || sampleUpdatedAt(b) - sampleUpdatedAt(a);
  if(filters.sort === 'oldest') return a.created.localeCompare(b.created) || sampleUpdatedAt(a) - sampleUpdatedAt(b);
  return sampleUpdatedAt(b) - sampleUpdatedAt(a);
}
function ticketRow(t) {
  const [building,...place] = t.place.split(' · ');
  const review = t.step === 'awaiting_rating' && t.relation === 'reported';
  const completed = ['closed','awaiting_rating'].includes(t.step);
  return `<tr class="${review ? 'waiting-row' : ''}"><td><a class="issue-link" href="${detailUrl(t)}"><span class="issue-title">${t.title}</span><span class="ticket-no">${number(t)}</span></a>${t.relation === 'following' ? '<span class="relation-note">คุณติดตามงานนี้</span>' : ''}</td><td><span class="place-primary">${building}</span><span class="place-detail">${place.join(' · ')}</span></td><td>${badge(t)}<span class="cell-sub">${review ? 'ตรวจผลซ่อมและให้คะแนน' : t.step === 'awaiting_rating' ? 'รอผู้แจ้งประเมินตรวจงาน' : t.step === 'awaiting_assessment' ? 'รอช่างประเมินงาน' : t.step === 'reworking' ? 'ช่างกำลังแก้ไขตามที่ส่งกลับ' : t.step === 'closed' ? 'ดูผลซ่อมย้อนหลังได้' : 'ช่างกำลังดำเนินการ'}</span></td><td class="date-cell" data-complete="${completed}">${completed ? 'ซ่อมเสร็จแล้ว' : t.expected}<small>อัปเดต ${t.updated}</small></td><td><a class="row-open ${review ? 'needs-review' : ''}" href="${detailUrl(t)}" aria-label="${review ? 'ตรวจงาน' : 'ดูรายละเอียด'} ${number(t)}">${review ? 'ตรวจงาน' : 'ดูงาน'}${icon('right')}</a></td></tr>`;
}
function updateList() {
  $$('[data-relation]').forEach(b => b.setAttribute('aria-pressed',String(filters.relation === b.dataset.relation)));
  $$('[data-status]').forEach(b => b.setAttribute('aria-pressed',String(filters.status === b.dataset.status)));
  ['range','sort'].forEach(id => $('#'+id).closest('.filter-chip').classList.toggle('active', id === 'sort' ? filters.sort !== 'updated' : $('#'+id).value !== 'all'));
  const base = tickets.filter(t => (filters.relation === 'all' || filters.relation === t.relation) && (!filters.q || (t.title + ' ' + number(t) + ' ' + t.place).toLocaleLowerCase('th').includes(filters.q.trim().toLocaleLowerCase('th'))) && (filters.range === 'all' || (Date.parse('2026-10-18T23:59:59+07:00') - Date.parse(t.created+'T00:00:00+07:00')) / 86400000 <= Number(filters.range)));
  $$('[data-count]').forEach(el => {el.textContent = ['loading','error','forbidden'].includes(scenario) ? '—' : scenario === 'empty' ? 0 : el.dataset.count === 'all' ? base.length : base.filter(t => group(t) === el.dataset.count).length;});
  const visible = base.filter(t => filters.status === 'all' || group(t) === filters.status).sort(sortTickets);
  const needsReview = visible.filter(t => t.step === 'awaiting_rating' && t.relation === 'reported');
  const reviewFocus = $('#review-focus');
  reviewFocus.hidden = scenario !== 'normal' || !needsReview.length;
  if(needsReview.length) {
    reviewFocus.href = detailUrl(needsReview[0]);
    reviewFocus.innerHTML = `<span class="review-icon">${icon('checkCircle')}</span><span class="review-copy"><strong>ซ่อมเสร็จแล้ว · มี ${needsReview.length} งานรอคุณตรวจ</strong><span>ตรวจผลการซ่อมและให้คะแนน เพื่อปิดงานที่คุณแจ้ง</span></span><span class="review-cta">ไปตรวจงาน ${icon('right')}</span>`;
  }
  $('#result-count').textContent = ['loading','error','forbidden'].includes(scenario) ? '—' : (scenario === 'empty' ? 0 : visible.length) + ' งาน';
  const content = $('#list-content');
  if(scenario !== 'normal') {content.innerHTML = `<div class="empty-workspace">${statePanel(scenario)}</div>`; return;}
  if(!visible.length) {content.innerHTML = `<div class="empty-workspace">${statePanel('empty',true)}</div>`; return;}
  const groups = [['resolved','รอประเมินตรวจงาน','star','ผู้แจ้งตรวจผลซ่อมก่อนปิดงาน'],['in_progress','กำลังดำเนินการ','wrench','งานที่รับเรื่องแล้วและอยู่ระหว่างซ่อม'],['closed','ปิดงานแล้ว','checkCircle','เก็บไว้ดูประวัติการซ่อม']];
  content.innerHTML = groups.map(([key,title,i,hint]) => {
    const items=visible.filter(t=>group(t)===key); if(!items.length) return '';
    return `<details class="ticket-group" data-group="${key}" ${collapsedGroups.has(key) ? '' : 'open'}><summary>${icon('chevron','group-arrow')}<span class="group-icon">${icon(i)}</span><span class="group-name">${title}</span><span class="group-count" aria-label="${items.length} งาน">${items.length} งาน</span><span class="group-hint">${hint}</span></summary><div class="ticket-table-frame" role="region" aria-label="ตาราง${title}" tabindex="0"><table class="tickets"><caption class="group-table-label">${title}</caption><thead><tr><th scope="col">เรื่องที่แจ้ง</th><th scope="col">สถานที่</th><th scope="col">สถานะล่าสุด</th><th scope="col">กำหนด / อัปเดต</th><th scope="col">รายละเอียด</th></tr></thead><tbody>${items.map(ticketRow).join('')}</tbody></table></div></details>`;
  }).join('') + `<div class="list-footer"><span role="status">แสดง ${visible.length} งาน ใน ${groups.filter(([key])=>visible.some(t=>group(t)===key)).length} กลุ่ม</span><span>งานรอคุณประเมินแสดงก่อนในกลุ่ม</span></div>`;
  $$('.ticket-group').forEach(d=>d.addEventListener('toggle',()=>{if(d.isConnected){if(d.open)collapsedGroups.delete(d.dataset.group);else collapsedGroups.add(d.dataset.group);}}));
}
let selectedTicket = tickets.find(t => t.id === params.get('id')) || tickets[0];
let currentStep = selectedTicket.step;
let viewer = params.get('viewer') === 'subscriber' ? 'subscriber' : 'reporter';
let closure = 'confirmed';
let changedDate = false;
function returnUrl() { const back = params.get('back'); return back && /^repair-my\.html(?:\?[a-zA-Z0-9%&=_+.-]*)?$/.test(back) ? back : 'repair-my.html'; }
function stagesFor(t) {
  const early = t.step === 'awaiting_assessment';
  const resolved = ['awaiting_rating','closed'].includes(t.step);
  const old = t.id === '141';
  const received = old ? '1 ต.ค. 2569 · 08:40' : t.id === '146' ? '16 ต.ค. 2569 · 08:40' : '15 ต.ค. 2569 · 08:40';
  const assessed = old ? '2 ต.ค. 2569 · 09:15' : '16 ต.ค. 2569 · 09:15';
  const resolvedAt = old ? '4 ต.ค. 2569 · 10:20' : '18 ต.ค. 2569 · 10:20';
  const steps = [{state:'done',title:'แจ้งงาน',time:received,desc:viewer === 'reporter' ? 'คุณส่งรายละเอียดปัญหา' : 'ผู้แจ้งส่งรายละเอียดปัญหา'}, {state:early ? 'now' : 'done',title:'รับเรื่อง',time:received,desc:early ? 'ระบบรับเรื่องแล้ว รอช่างกำหนดวันเสร็จ' : 'ระบบรับเรื่องเรียบร้อยแล้ว'}, {state:early ? 'later' : t.step === 'in_repair' ? 'now' : 'done',title:'กำลังดำเนินการ',time:early ? '' : assessed,desc:early ? 'ช่างจะกำหนดวันที่คาดว่าจะเสร็จ' : changedDate ? 'ปรับวันคาดว่าจะเสร็จเป็น 21 ต.ค. 2569' : 'ช่างดำเนินการซ่อมตามรายละเอียดที่แจ้ง'}];
  if(t.step === 'reworking') steps.push({state:'now',title:'ส่งกลับให้แก้',time:'18 ต.ค. 2569 · 08:30',desc:'ยังพบปัญหาเดิมหลังซ่อม รอช่างกำหนดวันเสร็จใหม่'});
  steps.push({state:resolved ? 'done' : 'later',title:'เสร็จ',time:resolved ? resolvedAt : '',desc:resolved ? 'ช่างบันทึกผลการซ่อมแล้ว' : early || t.step === 'reworking' ? 'รอช่างกำหนดวันที่คาดว่าจะเสร็จ' : 'คาดว่า ' + (changedDate ? '21 ต.ค. 2569' : t.expected)});
  const closed = t.step === 'closed';
  steps.push({state:closed ? 'done' : t.step === 'awaiting_rating' ? 'now' : 'later',title:closed && closure !== 'confirmed' ? closure === 'auto_closed' ? 'ปิดงานอัตโนมัติ' : 'Admin ปิดงาน' : 'ประเมินตรวจงาน',time:closed ? closure === 'auto_closed' ? '21 ต.ค. 2569 · 10:20' : (old ? '4' : '18') + ' ต.ค. 2569 · 11:00' : '',desc:closed ? closure === 'confirmed' ? 'คุณประเมินตรวจงานแล้ว · 5/5' : closure === 'auto_closed' ? 'ครบกำหนดโดยไม่ได้รับการประเมินจากผู้แจ้ง' : 'ปิดงานโดย Admin พร้อมบันทึกเหตุผล' : t.step === 'awaiting_rating' ? viewer === 'reporter' ? 'รอคุณตรวจผลซ่อมและให้คะแนน' : 'รอผู้แจ้งประเมินตรวจงาน' : 'ผู้แจ้งตรวจผลซ่อมก่อนปิดงาน'});
  return steps;
}
function nextAction(t) {
  let title,desc,cls='info',i='clock',buttons='',deadline='';
  if(t.step === 'awaiting_assessment') {title='รับเรื่องแล้ว รอช่างกำหนดวันเสร็จ';desc='ตอนนี้คุณยังไม่ต้องทำอะไร เมื่อช่างเริ่มดำเนินการ วันที่คาดว่าจะเสร็จจะแสดงที่นี่';}
  if(t.step === 'in_repair') {title='ช่างกำลังดำเนินการ';desc=`คาดว่าจะเสร็จ ${changedDate ? '21 ต.ค. 2569' : t.expected} คุณติดตามความคืบหน้าได้จากหน้านี้`;i='wrench';}
  if(t.step === 'reworking') {title='ส่งกลับให้แก้แล้ว';desc='เหตุผล: ยังพบปัญหาเดิมหลังซ่อม ขณะนี้รอช่างกำหนดวันเสร็จใหม่ คุณยังไม่ต้องประเมินซ้ำ';i='refresh';}
  if(t.step === 'awaiting_rating') {
    cls='';i='star';title=viewer === 'reporter' ? 'ซ่อมเสร็จแล้ว รอคุณตรวจงาน' : 'ซ่อมเสร็จแล้ว รอผู้แจ้งตรวจงาน';
    desc=viewer === 'reporter' ? 'อ่านผลการซ่อมด้านล่าง แล้วประเมินตรวจงาน หากยังพบปัญหา สามารถส่งกลับให้แก้ได้' : 'คุณกำลังติดตามงานนี้ ผู้แจ้งเป็นผู้ประเมินตรวจงานหรือส่งกลับให้แก้';
    if(viewer === 'reporter') buttons='<div class="buttons"><button class="btn violet" data-action="rate">'+icon('star')+'ประเมินตรวจงาน</button><button class="btn" data-action="send-back">ส่งกลับให้แก้</button></div>';
    deadline='หากผู้แจ้งไม่ตอบ ระบบจะปิดงานอัตโนมัติ 21 ต.ค. 2569 เวลา 10:20 น.';
  }
  if(t.step === 'closed') {cls='success';i='checkCircle';title='งานนี้ปิดเรียบร้อยแล้ว';desc=closure === 'confirmed' ? (viewer === 'reporter' ? 'คุณ' : 'ผู้แจ้ง')+'ประเมินตรวจงานแล้ว ขอบคุณที่ช่วยดูแลพื้นที่ทำงาน' : closure === 'auto_closed' ? 'ระบบปิดงานอัตโนมัติเนื่องจากครบกำหนดประเมิน โดยไม่มีการให้คะแนน' : 'Admin ปิดงาน · เหตุผล: ตรวจสอบและยืนยันว่าปัญหาได้รับการแก้ไขแล้ว';}
  return `<section class="next-action ${cls}" aria-labelledby="next-title"><span class="action-icon">${icon(i)}</span><div><h3 id="next-title">${title}</h3><p>${desc}</p>${buttons}${deadline ? '<p class="deadline">'+deadline+'</p>' : ''}</div></section>`;
}
function detailRender() {
  const t={...selectedTicket,step:currentStep};
  const evidenceEmpty = scenario === 'empty';
  const resolved=['awaiting_rating','closed'].includes(t.step);
  const stages=stagesFor(t);
  main.innerHTML = `${crumb(true)}<div class="detail-toolbar"><a class="back-link" href="${escapeHtml(returnUrl())}">${icon('back')}กลับไปติดตามงานซ่อม</a><button class="btn text" data-print>${icon('print')}พิมพ์งานนี้</button></div>${!['normal','empty'].includes(scenario) ? `<div class="card">${statePanel(scenario)}</div>` : `<div class="detail-layout"><div class="detail-main stack"><section class="card pad" aria-labelledby="ticket-title"><div class="summary-top"><span class="ticket-reference">${number(t)}<button class="icon-button" data-copy aria-label="คัดลอกเลขงาน">${icon('copy')}</button></span>${badge(t,viewer)}</div><h1 class="ticket-title" id="ticket-title">${t.title}</h1><p class="location">${icon('pin')}${t.place}</p><dl class="facts"><div><dt>${resolved ? 'ซ่อมเสร็จเมื่อ' : 'คาดว่าจะเสร็จ'}</dt><dd>${resolved ? (t.id === '141' ? '4' : '18')+' ต.ค. 2569' : t.step === 'awaiting_assessment' ? 'รอช่างกำหนด' : t.step === 'reworking' ? 'รอกำหนดวันใหม่' : changedDate ? '21 ต.ค. 2569' : t.expected}</dd></div><div><dt>ประเภทงาน</dt><dd>${t.category}</dd></div><div><dt>ความเกี่ยวข้องกับงาน</dt><dd>${viewer === 'reporter' ? 'คุณเป็นผู้แจ้ง' : 'คุณติดตามงานนี้'}<small>${viewer === 'subscriber' ? 'ผู้แจ้งเป็นผู้ประเมินตรวจงาน' : 'ประเมินตรวจงานได้เมื่อซ่อมเสร็จ'}</small></dd></div></dl>${changedDate && t.step === 'in_repair' ? '<p class="date-change">เลื่อนจาก 20 ต.ค. เป็น 21 ต.ค. 2569<br>เหตุผล: รออะไหล่สำหรับเปลี่ยน</p>' : ''}${nextAction(t)}</section><section class="card pad" aria-label="รายละเอียดและผลการซ่อม">${resolved ? `<div class="evidence-block"><div class="evidence-title">${icon('checkCircle')}<h2>ผลการซ่อม</h2></div><p class="evidence-copy">${t.result || 'ตรวจสอบและแก้ไขตามอาการที่แจ้ง ทดสอบการใช้งานเรียบร้อยแล้ว'}</p><p class="byline">บันทึกโดย ช่างธนากร · ${t.id === '141' ? '4' : '18'} ต.ค. 2569 เวลา 10:20 น.</p><div class="photo-empty">${icon('image')}ไม่มีรูปหลังซ่อมในข้อมูลตัวอย่างนี้</div></div>` : ''}<div class="evidence-block"><div class="evidence-title">${icon('file')}<h2>รายละเอียดที่แจ้ง</h2></div><p class="evidence-copy">${evidenceEmpty ? '??????????????????????????????????' : t.note}</p><p class="byline">${viewer === 'reporter' ? 'แจ้งโดยคุณ' : 'แจ้งโดยผู้แจ้งงาน'} · ${t.id === '141' ? '1' : t.id === '146' ? '16' : '15'} ต.ค. 2569 เวลา 08:40 น.</p><div class="photo-empty">${icon('image')}ไม่มีรูปแนบในข้อมูลตัวอย่างนี้</div></div></section></div><aside class="card timeline-panel" aria-labelledby="timeline-title"><h2 id="timeline-title">ความคืบหน้าของงาน</h2><p class="timeline-sub">ตั้งแต่แจ้งเรื่อง จนถึงปิดงาน</p><ol class="timeline">${stages.map(s => `<li class="${s.state}" ${s.state === 'now' ? 'aria-current="step"' : ''}><span class="marker">${icon(s.state === 'done' ? 'check' : 'clock')}</span>${s.time ? '<span class="when">'+s.time+'</span>' : '<span class="when">'+(s.state === 'now' ? 'ขั้นตอนปัจจุบัน' : 'ขั้นตอนถัดไป')+'</span>'}<h3>${s.title}</h3><p>${s.desc}</p>${s.state === 'now' ? '<span class="current-tag">อยู่ในขั้นตอนนี้</span>' : ''}</li>`).join('')}</ol><button class="btn history-button" data-history>${icon('list')}ดูประวัติทั้งหมด</button></aside></div>`}${footer}`;
  $('[data-print]')?.addEventListener('click',() => window.print());
  $('[data-copy]')?.addEventListener('click',async () => {try {await navigator.clipboard.writeText(number(t));toast('คัดลอกเลขงานแล้ว');} catch {toast('เลขงาน: '+number(t));}});
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>actionDialog(b.dataset.action)));
  $('[data-history]')?.addEventListener('click',() => openDialog('ประวัติงานซ่อม',`<ul class="history-list">${stages.filter(s => s.time).map(s=>`<li><time>${s.time}</time><strong>${s.title}</strong><p>${s.desc}</p></li>`).join('')}${changedDate && t.step==='in_repair' ? '<li><time>18 ต.ค. 2569 · 09:10</time><strong>เลื่อนวันคาดว่าจะเสร็จ</strong><p>จาก 20 ต.ค. เป็น 21 ต.ค. 2569 · รออะไหล่สำหรับเปลี่ยน</p></li>' : ''}</ul>`));
}
let dialogOpener;
function openDialog(title,body) {dialogOpener=document.activeElement;$('#dialog').innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-close aria-label="ปิดหน้าต่าง">${icon('close')}</button></div>${body}`;$('#dialog').setAttribute('aria-labelledby','dialog-title');$('#dialog').showModal();}
$('#dialog').addEventListener('close',()=>dialogOpener?.focus());
function actionDialog(action) {
  const rate=action==='rate';let score=0;
  openDialog(rate?'ประเมินตรวจงาน':'ส่งกลับให้แก้',`<p>${rate?'ตรวจสอบว่าปัญหาได้รับการแก้ไขเรียบร้อย แล้วเลือกคะแนนความพึงพอใจ':'ระบุปัญหาที่ยังพบ เพื่อให้ช่างทราบสิ่งที่ต้องแก้ไข'}</p>${rate?'<div class="stars" role="radiogroup" aria-label="คะแนนความพึงพอใจ">'+[1,2,3,4,5].map(n=>`<button role="radio" aria-checked="false" tabindex="${n===1?0:-1}" aria-label="${n} ดาว" data-score="${n}">☆</button>`).join('')+'</div>':''}<label for="comment">${rate?'ความคิดเห็น (ไม่บังคับ)':'ปัญหาที่ยังพบ'}</label><textarea id="comment" placeholder="${rate?'บอกเราเพิ่มเติมเกี่ยวกับงานนี้':'เช่น ยังมีน้ำหยดเมื่อเปิดใช้งาน'}"></textarea><p class="form-error" role="alert" hidden></p><p class="small muted">แบบทดลองเท่านั้น ยังไม่ส่งข้อมูลหรือเปลี่ยนสถานะงานจริง</p><div class="dialog-actions"><button class="btn" data-close>ยกเลิก</button><button class="btn primary" id="demo-submit">ทดลอง${rate?'ส่งผลประเมิน':'ส่งกลับให้แก้'}</button></div>`);
  function setScore(n){score=n;$$('[data-score]').forEach(b=>{b.setAttribute('aria-checked',String(Number(b.dataset.score)===n));b.tabIndex=Number(b.dataset.score)===n?0:-1;b.textContent=Number(b.dataset.score)<=n?'★':'☆';});}
  $$('[data-score]').forEach(b=>{b.addEventListener('click',()=>setScore(Number(b.dataset.score)));b.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=Math.max(1,Math.min(5,Number(b.dataset.score)+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)));setScore(n);$(`[data-score="${n}"]`).focus();});});
  $('#demo-submit').addEventListener('click',()=>{if((rate&&!score)||(!rate&&!$('#comment').value.trim())){$('.form-error').hidden=false;$('.form-error').textContent=rate?'กรุณาเลือกคะแนนก่อนส่งผลประเมิน':'กรุณาระบุปัญหาที่ยังพบ';return;}$('#dialog').close();toast('จบการทดลอง — ยังไม่ได้ส่งข้อมูลไปยังระบบ');});
}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-reset]')){filters={status:'all',relation:'all',q:'',range:'all',sort:'updated'};collapsedGroups.clear();scenario='normal';if($('#scenario'))$('#scenario').value='normal';listRender();$('#search').focus();}
  if(event.target.closest('[data-retry]')){scenario='normal';$('#scenario').value='normal';screen==='list'?updateList():detailRender();}
});
$('#scenario')?.addEventListener('change',event=>{scenario=event.target.value;screen==='list'?updateList():detailRender();});
if(screen==='list')listRender();
if(screen==='detail'){
  const control=document.createElement('label');control.innerHTML=`ขั้นตอน<select id="step">${options([...Object.entries(labels),['date_changed','เลื่อนวันเสร็จ'],['auto_closed','ปิดอัตโนมัติ'],['admin_closed','Admin ปิดงาน']],currentStep)}</select>`;$('.preview-controls').append(control);
  $('#step').addEventListener('change',event=>{const value=event.target.value;changedDate=value==='date_changed';closure=['auto_closed','admin_closed'].includes(value)?value:'confirmed';currentStep=changedDate?'in_repair':closure!=='confirmed'?'closed':value;scenario='normal';$('#scenario').value='normal';detailRender();});
  $('#viewer').addEventListener('change',event=>{viewer=event.target.value;detailRender();});detailRender();
}
