/* Preserve the demo's domain behavior while presenting one section at a time. */
let wizardStep = 'problem';
const wizardLabels = {problem:'ปัญหาที่พบ',location:'สถานที่',photo:'รูปภาพ',team:'งานที่ทีมทำ',review:'ตรวจสอบก่อนส่ง'};
const wizardSteps = () => ['problem','location','photo',...(mode==='team'?['team']:[]),'review'];
const wizardValid = {problem:validProblem,location:validLocation,photo:validPhotos,team:validTeam};
const wizardErrors = {problem:'เลือกหมวดงานและอาการ พร้อมระบุข้อมูลอื่นๆ ให้ครบ',location:'เลือกอาคารและชั้นที่เกิดปัญหา',photo:'ถ่ายหรือแนบรูปปัญหาอย่างน้อย 1 รูป',team:'บอกสิ่งที่ทีมทำ และแนบรูปหลังทำอย่างน้อย 1 รูป'};
$('sections').insertAdjacentHTML('beforebegin','<nav class="wizard-progress" aria-label="ขั้นตอนแจ้งซ่อม"><div class="wizard-caption" aria-live="polite" id="wizard-caption"></div><ol class="wizard-steps" id="wizard-steps"></ol></nav>');
$('sections').insertAdjacentHTML('beforeend','<section class="form-section" id="review-section" hidden><div class="sec-head"><h2 tabindex="-1">ตรวจสอบก่อนส่ง</h2></div><p class="wizard-review-intro">ตรวจปัญหา สถานที่ และรูปให้ถูกต้อง กดแก้ไขเพื่อกลับไปยังขั้นตอนนั้นได้</p><div id="wizard-review"></div></section>');
document.querySelector('.form-summary').insertAdjacentHTML('afterend','<div class="wizard-footer"><button class="btn" type="button" id="wizard-back">ย้อนกลับ</button><span class="wizard-save">ข้อมูลที่กรอกไว้จะอยู่เมื่อย้อนกลับ</span><button class="btn primary" type="submit" id="wizard-next">ถัดไป</button></div>');

// Keep category names and behavior; add familiar objects to clarify each choice.
const categoryExamples={ac:'แอร์ · เครื่องปรับอากาศ',el:'หลอดไฟ · ปลั๊ก · เบรกเกอร์',pl:'ก๊อกน้ำ · ท่อน้ำ · ชักโครก',bf:'ประตู · โต๊ะ · เก้าอี้ · ฝ้า',cl:'พื้นเปียก · ขยะ · กลิ่น',other:'ปัญหาที่ไม่ตรงกับหมวดด้านบน'};
$('category-label').innerHTML='เลือกหมวดที่ตรงกับปัญหา <span class="req">*</span><span class="choice-help">เลือก 1 หมวด</span>';
const originalCategoryCards=renderCategories;
renderCategories=function(){
 originalCategoryCards();
 $('categories').querySelectorAll('[data-cat]').forEach(button=>{
  const label=button.lastElementChild;
  label.className='category-copy';
  label.innerHTML=`<b>${escapeHtml(label.textContent)}</b><small>${categoryExamples[button.dataset.cat]}</small>`;
  button.insertAdjacentHTML('beforeend','<span class="category-radio" aria-hidden="true"></span>');
 });
};
renderCategories();

// Keep native field values as the demo's data source, with direct location choices.
const locationSection=$('location-section');
locationSection.querySelector('h2').textContent='ปัญหาเกิดขึ้นที่ไหน';
const locationFields=locationSection.querySelector('.location-fields');
locationFields.className='location-inputs';
[$('building'),$('floor')].forEach(field=>{field.parentElement.hidden=true;});
locationFields.insertAdjacentHTML('afterbegin','<div class="place-building-group"><div class="label" id="place-building-label">เลือกอาคาร <span class="req">*</span></div><div id="place-buildings" class="place-buildings" role="group" aria-labelledby="place-building-label"></div></div><div class="place-floor-group"><div class="label" id="place-floor-label">เลือกชั้น <span class="req">*</span></div><div id="place-floors" class="place-floors" role="group" aria-labelledby="place-floor-label"></div><p class="place-floor-hint" id="place-floor-hint">เลือกอาคารเพื่อดูชั้นที่แจ้งได้</p></div>');
locationFields.querySelector('.spot-field').append($('rooms'));
locationSection.append($('recent'));
function renderLocationChoices(){
 const building=$('building').value,floor=$('floor').value;
 const currentFocus=document.activeElement;
 const buildingFocus=currentFocus?.dataset.placeBuilding,floorFocus=currentFocus?.dataset.placeFloor;
 const buildingHtml=SAMPLE_BUILDINGS.map(b=>`<button type="button" class="place-building" data-place-building="${b.id}" aria-pressed="${b.id===building}"><span class="place-building-icon">${icon('building')}</span><span>${escapeHtml(b.name)}</span><span class="place-radio" aria-hidden="true"></span></button>`).join('');
 // Do not replace the controls on unrelated text input.
 if($('place-buildings').dataset.value!==building){$('place-buildings').innerHTML=buildingHtml;$('place-buildings').dataset.value=building;paintIcons($('place-buildings'));}
 const b=bOf(building),floorKey=building+':'+floor;
 if($('place-floors').dataset.value!==floorKey){
  $('place-floors').innerHTML=b?Array.from({length:b.floors},(_,i)=>`<button type="button" data-place-floor="${i+1}" aria-pressed="${String(i+1)===floor}">ชั้น ${i+1}</button>`).join(''):'';
  $('place-floors').dataset.value=floorKey;
 }
 $('place-floor-hint').hidden=!!b;
 if(validLocation())$('location-error').hidden=true;
 if(buildingFocus)$('place-buildings').querySelector(`[data-place-building="${buildingFocus}"]`)?.focus({preventScroll:true});
 if(floorFocus)$('place-floors').querySelector(`[data-place-floor="${floorFocus}"]`)?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
 const building=e.target.closest('[data-place-building]'),floor=e.target.closest('[data-place-floor]');
 if(!building&&!floor)return;
 const field=building?$('building'):$('floor'),value=building?building.dataset.placeBuilding:floor.dataset.placeFloor;
 if(field.value===value)return;
 field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));
});

// Use the second column for guidance before upload and the actual selected photos afterwards.
const photoSection=$('photo-section');
const photoWorkspace=document.createElement('div');photoWorkspace.className='photo-workspace';
const photoUpload=document.createElement('div');photoUpload.className='photo-upload';
const photoPreview=document.createElement('aside');photoPreview.className='photo-preview';photoPreview.setAttribute('aria-label','รูปที่แนบและคำแนะนำ');
photoSection.querySelector('.sec-head').after(photoWorkspace);photoWorkspace.append(photoUpload,photoPreview);
['#photo-label','.mobile-only','#upload-trigger','#photo-files','#camera-file'].forEach(selector=>photoUpload.append(photoSection.querySelector(selector)));
photoUpload.append(photoSection.querySelector('.hint'));
photoPreview.innerHTML='<div class="photo-preview-head"><b id="photo-preview-title">ถ่ายให้เห็นปัญหาชัดเจน</b><span id="photo-preview-count"></span></div><div id="photo-guide"><div class="photo-tip">'+icon('camera')+'<div><b>มุมใกล้: ให้เห็นอาการ</b><p>เช่น จุดน้ำรั่ว หรือส่วนที่ชำรุด</p></div></div><div class="photo-tip">'+icon('map-pin')+'<div><b>มุมกว้าง: ให้เห็นตำแหน่ง</b><p>ให้ช่างรู้ว่าอยู่ตรงไหนของห้อง</p></div></div><p class="hint">ไม่ต้องถ่ายให้สวย แค่เห็นปัญหาและบริเวณรอบ ๆ ชัดเจน</p></div>';
photoPreview.append($('photo-strip'));
photoUpload.querySelector('.hint').textContent='แนบอย่างน้อย 1 รูป สูงสุด 5 รูป · เลือกเพิ่มหรือลบรูปได้ก่อนส่ง';
function renderPhotoWorkspace(){
 const hasPhotos=F.photos.length>0;
 $('photo-guide').hidden=hasPhotos;
 $('photo-preview-title').textContent=hasPhotos?'รูปที่แนบแล้ว':'ถ่ายให้เห็นปัญหาชัดเจน';
 $('photo-preview-count').textContent=`${F.photos.length}/5 รูป`;
 photoPreview.classList.toggle('has-photos',hasPhotos);
}

function renderWizardReview(){
 const cat=catOf(F.cat),building=bOf($('building').value);
 const edit=(key,label)=>`<button class="text-link report-edit" type="button" data-wizard-edit="${key}" aria-label="แก้ไข${label}">แก้ไข</button>`;
 const row=(key,label,iconName,body)=>`<section class="report-row report-row-${key}" aria-labelledby="report-label-${key}"><h3 id="report-label-${key}">${icon(iconName)}${label}</h3><div class="report-value">${body}</div>${edit(key,label)}</section>`;
 const photos=list=>`<div class="review-photos">${list.map((p,i)=>`<div class="review-photo">${p.sample?`<span role="img" aria-label="รูปตัวอย่างที่ ${i+1}">${acIllustration(list===F.teamPhotos)}</span>`:`<img src="${p.url}" alt="รูปที่แนบ ${i+1}">`}</div>`).join('')}</div>`;
 $('wizard-review').innerHTML=`<article class="report-card" aria-label="สรุปข้อมูลแจ้งซ่อม"><header class="report-heading"><span class="report-category-icon">${icon(cat?.icon||'wrench')}</span><div><p class="report-category">${escapeHtml(F.cat==='other'?F.categoryOther:cat?.name||'')}</p><h3>${escapeHtml(titleText())}</h3></div>${edit('problem','ปัญหาที่พบ')}</header>`+
  ($('details').value?row('problem','รายละเอียด','file-text',`<p class="report-description">${escapeHtml($('details').value)}</p>`):'')+
  row('location','สถานที่','map-pin',`<p class="report-building">${escapeHtml(building?.name||'')} · ชั้น ${escapeHtml($('floor').value)}</p><p class="report-spot">${escapeHtml($('spot').value||'ไม่ได้ระบุห้อง / จุด')}</p>${F.qr?'<p class="report-asset">อุปกรณ์ AC-05-012</p>':''}`)+
  row('photo',`รูปแนบ (${F.photos.length})`,'camera',photos(F.photos))+
  (mode==='team'?row('team','งานที่ทีมทำ','check-circle',`<p class="report-description">${escapeHtml($('team-note').value)}</p><p class="report-spot">รูปหลังทำ (${F.teamPhotos.length} รูป)</p>${photos(F.teamPhotos)}`):'')+'</article>';
 paintIcons($('wizard-review'));
}
function renderWizard(focus=false){
 const steps=wizardSteps();if(!steps.includes(wizardStep))wizardStep='problem';
 const index=steps.indexOf(wizardStep),last=wizardStep==='review';
 $('page-sub').textContent=mode==='team'?'กรอกทีละขั้น แล้วตรวจข้อมูลก่อนบันทึกงานทีม':'กรอกทีละขั้น แล้วตรวจข้อมูลก่อนส่งให้ช่าง';
 $('symptoms').parentElement.hidden=!F.cat;
 $('problem-section').classList.toggle('has-category',!!F.cat);
 renderPhotoWorkspace();
 renderLocationChoices();
 ['problem','location','photo','team','review'].forEach(key=>$(key+'-section').hidden=key!==wizardStep);
 $('wizard-caption').innerHTML=`<b>ขั้นตอน ${index+1} จาก ${steps.length}</b><span>${last?'ตรวจข้อมูลแล้วกดส่งได้เลย':`เหลืออีก ${steps.length-index-1} ขั้นตอน`}</span>`;
 $('wizard-steps').innerHTML=steps.map((key,i)=>`<li class="${i<index?'complete':''}"><button type="button" data-wizard-go="${key}" ${i===index?'aria-current="step"':''} ${i>index?'disabled':''}>${i+1}. ${key==='review'?'ตรวจสอบ':wizardLabels[key]}</button></li>`).join('');
 $('wizard-back').disabled=index===0;
 $('wizard-next').innerHTML=(last?(mode==='team'?'ยืนยันบันทึกงานทีม':'ยืนยันส่งแจ้งซ่อม'):'ถัดไป')+icon(last?'send':'chevron-right');
 paintIcons($('wizard-next'));
 $('dup-inline').hidden=!['location','review'].includes(wizardStep);
 $('qr-banner').hidden=wizardStep!=='problem';
 if(last)renderWizardReview();
 if(focus){const heading=$(wizardStep+'-section').querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});document.querySelector('.wizard-progress').scrollIntoView({block:'start',behavior:'smooth'});}
}
function checkWizardStep(key){
 if(!wizardValid[key]||wizardValid[key]())return true;
 wizardStep=key;renderWizard();const error=$(key+'-error');error.textContent=wizardErrors[key];error.hidden=false;
 $(key+'-section').querySelector('button,input,select,textarea')?.focus();error.setAttribute('role','alert');return false;
}
const originalWizardSubmit=$('repair-form').onsubmit;
$('repair-form').onsubmit=e=>{
 e.preventDefault();clearErrors();
 if(wizardStep!=='review'){
  if(!checkWizardStep(wizardStep))return;
  const steps=wizardSteps();wizardStep=steps[steps.indexOf(wizardStep)+1];renderWizard(true);return;
 }
 for(const key of wizardSteps().filter(key=>key!=='review'))if(!checkWizardStep(key))return;
 originalWizardSubmit(e);
};
$('wizard-back').onclick=()=>{const steps=wizardSteps();wizardStep=steps[Math.max(0,steps.indexOf(wizardStep)-1)];clearErrors();renderWizard(true);};
document.addEventListener('click',e=>{const button=e.target.closest('[data-wizard-go],[data-wizard-edit]');if(!button)return;wizardStep=button.dataset.wizardGo||button.dataset.wizardEdit;clearErrors();renderWizard(true);});
const originalWizardSummary=updateSummary;
updateSummary=function(){originalWizardSummary();renderWizard();};
const originalWizardOrder=applyOrder;
applyOrder=function(){originalWizardOrder();renderWizard();};
const originalWizardReset=resetForm;
resetForm=function(...args){wizardStep='problem';originalWizardReset(...args);renderWizard();};
renderWizard();
