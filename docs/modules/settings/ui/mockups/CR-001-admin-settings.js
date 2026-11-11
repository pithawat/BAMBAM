/* CR-001 interactive design proposal. All changes live in browser memory only. */
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const shapes = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18a2.1 2.1 0 0 0 3 3l5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z"/>',
  car: '<path d="m5 8 2-4h10l2 4m-15 9h16V9H4zm2 0v3m12-3v3M7 12h1m8 0h1"/>',
  room: '<path d="M4 21h16M6 21V4l11-1v18M10 12h1m7-7h2v16"/>',
  tags: '<path d="M20 13 11 22 2 13V3h10l8 8a1.4 1.4 0 0 1 0 2z"/><circle cx="7" cy="8" r="1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-11 12a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  aircon: '<rect x="3" y="4" width="18" height="10" rx="2"/><path d="M6 10h12M8 17v3m4-3v4m4-4v3"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  speaker: '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="3"/><circle cx="12" cy="6" r="1"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1V5m14 9-4 1v4M3 14l4 1v4m14-9-4-1V5"/>',
  zap: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  drop: '<path d="M12 2S4 10 4 15a8 8 0 0 0 16 0c0-5-8-13-8-13z"/>',
  chair: '<path d="M5 12V7a7 5 0 0 1 14 0v5M5 16h14m-13 0v5m12-5v5M5 12H2v5h20v-5h-3M6 10v6m12-6v6"/>',
  clean: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6zM20 2v4m-2-2h4"/>',
  plug: '<path d="M8 2v5m8-5v5M6 7h12v4a6 6 0 0 1-12 0zm6 10v5"/>',
  shower: '<path d="M4 22V7a5 5 0 0 1 9-3m-2 3 5-5 4 4-5 5zM12 14h.01M16 14h.01m4 0h.01M10 18h.01m5 0h.01m5 0h.01"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.1 7a8 8 0 0 1 13.4-3L20 7M4 17l1.5 3a8 8 0 0 0 13.4-3"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  box: '<path d="m12 3 9 5-9 5-9-5zm-9 5v10l9 5 9-5V8M12 13v10M7 5.8l9 5"/>',
};
const icon = (name, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${shapes[name] || shapes.box}</svg>`;
const action = (label, name, extra = "", cls = "") => `<button type="button" class="button ${cls}" data-action="${name}" ${extra}>${label}</button>`;
const iconAction = (name, label, extra = "", glyph = "more") => `<button type="button" class="icon-button" data-action="${name}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(glyph)}</button>`;
const avatar = (name, cls = "") => `<span class="avatar ${cls}" aria-hidden="true">${esc(name.split(" ").map((part) => part[0]).slice(0, 2).join(""))}</span>`;
const uid = () => globalThis.crypto?.randomUUID?.() || `sample-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const roles = [
  { id: "super_admin", name: "Superadmin", description: "ดูแลระบบทั้งหมด รวมผู้ใช้และสิทธิ์", system: true },
  { id: "employee", name: "พนักงานทั่วไป", description: "แจ้งซ่อมและติดตามงานของตัวเอง", system: true },
  { id: "housekeeper_lead", name: "หัวหน้าแม่บ้าน", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง" },
  { id: "security_lead", name: "หัวหน้ารปภ.", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง" },
  { id: "technician", name: "ช่างเทคนิค", description: "รับเรื่อง ดำเนินการ และบันทึกผลซ่อม" },
  { id: "admin", name: "Admin", description: "จัดการงานซ่อม สถานที่ อุปกรณ์ และหมวดงาน" },
];
const users = [
  { id: "1", name: "กานดา สุขสวัสดิ์", email: "kanda.s@example.com", code: "EMP0108", department: "ฝ่ายทรัพยากรบุคคล", position: "เจ้าหน้าที่บุคคล", role: "employee", last: "26 ต.ค. 2569 · 09:12" },
  { id: "2", name: "จิราพร วัฒนกุล", email: "jiraporn.w@example.com", code: "EMP0112", department: "ฝ่ายบัญชี", position: "เจ้าหน้าที่บัญชี", role: "employee", last: "26 ต.ค. 2569 · 08:56" },
  { id: "3", name: "ชุติมา พรหมรักษ์", email: "chutima.p@example.com", code: "EMP0103", department: "ฝ่ายอาคารสถานที่", position: "หัวหน้าแม่บ้าน", role: "housekeeper_lead", last: "26 ต.ค. 2569 · 08:40" },
  { id: "4", name: "ณัฐพล อินทรวงศ์", email: "nattapon.i@example.com", code: "EMP0105", department: "ฝ่ายเทคโนโลยีสารสนเทศ", position: "เจ้าหน้าที่ระบบ", role: "super_admin", locked: true, last: "26 ต.ค. 2569 · 10:24" },
  { id: "5", name: "ธนกร พัฒนกิจ", email: "thanakorn.p@example.com", code: "EMP0107", department: "ฝ่ายวิศวกรรม", position: "ช่างเทคนิค", role: "technician", last: "26 ต.ค. 2569 · 10:15" },
  { id: "6", name: "นภัสสร ใจมั่น", email: "napatsorn.j@example.com", code: "EMP0109", department: "ฝ่ายจัดซื้อ", position: "เจ้าหน้าที่จัดซื้อ", role: "employee", last: "26 ต.ค. 2569 · 09:31" },
  { id: "7", name: "ปวีณา ศรีสุข", email: "paweena.s@example.com", code: "EMP0101", department: "ฝ่ายอาคารสถานที่", position: "ผู้ดูแลอาคาร", role: "admin", last: "26 ต.ค. 2569 · 10:02" },
  { id: "8", name: "พงศกร รุ่งเรือง", email: "pongsakorn.r@example.com", code: "EMP0110", department: "ฝ่ายบริหาร", position: "ผู้จัดการฝ่าย", role: "employee", last: "25 ต.ค. 2569 · 15:20" },
  { id: "9", name: "วราภรณ์ ดีพร้อม", email: "waraporn.d@example.com", code: "EMP0111", department: "ฝ่ายทรัพยากรบุคคล", position: "เจ้าหน้าที่บุคคล", role: "employee", last: "25 ต.ค. 2569 · 13:45" },
  { id: "10", name: "สมชาย ใจดี", email: "somchai.j@example.com", code: "EMP0104", department: "ฝ่ายรักษาความปลอดภัย", position: "หัวหน้ารปภ.", role: "security_lead", last: "26 ต.ค. 2569 · 07:52" },
  { id: "11", name: "สุพัตรา พูนผล", email: "supatra.p@example.com", code: "EMP0106", department: "ฝ่ายอาคารสถานที่", position: "ผู้ดูแลอาคาร", role: "admin", last: "25 ต.ค. 2569 · 16:30" },
  { id: "12", name: "อรทัย มีสุข", email: "orathai.m@example.com", code: "EMP0113", department: "ฝ่ายบริหาร", position: "ผู้อำนวยการ", role: "employee", last: "24 ต.ค. 2569 · 11:14" },
];
const roleName = (id) => roles.find((role) => role.id === id)?.name || id;
const roleCount = (id) => users.filter((user) => user.role === id).length;
const currentUser = () => users.find((user) => user.id === (state.viewer === "super_admin" ? "4" : "7"));
const priorityNames = { critical: "ฉุกเฉิน", high: "สูง", medium: "ปกติ", low: "ต่ำ" };
const priorityBadge = (priority) => `<span class="priority ${esc(priority)}">${priorityNames[priority]}</span>`;
const assetTypes = [ { id: "aircon", name: "เครื่องปรับอากาศ", icon: "aircon", prefix: "AC" }, { id: "microphone", name: "ไมโครโฟน", icon: "mic", prefix: "MIC" }, { id: "speaker", name: "ลำโพง", icon: "speaker", prefix: "SPK" }, { id: "tv", name: "จอทีวี", icon: "monitor", prefix: "TV" } ];
const buildings = [
  { id: "b1", name: "อาคาร 1", floors: [
    { id: "f11", name: "ชั้น 1", rooms: [ { id: "r111", name: "ห้องประชุม 1A" }, { id: "r112", name: "ห้องประชุม 1B" }, { id: "r113", name: "พื้นที่ส่วนกลางชั้น 1" } ] },
    { id: "f12", name: "ชั้น 2", rooms: [ { id: "r121", name: "ฝ่ายบัญชี" }, { id: "r122", name: "ฝ่ายจัดซื้อ" }, { id: "r123", name: "พื้นที่ส่วนกลางชั้น 2" } ] },
    { id: "f13", name: "ชั้น 3", rooms: [ { id: "r131", name: "ห้องประชุม 3A" }, { id: "r132", name: "พื้นที่ส่วนกลางชั้น 3" } ] },
  ] },
  { id: "b2", name: "อาคาร 2", floors: [ { id: "f21", name: "ชั้น 1", rooms: [ { id: "r211", name: "ห้องประชุม 1A" }, { id: "r212", name: "พื้นที่ส่วนกลางชั้น 1" } ] } ] },
];
const assets = [
  { id: "a1", room: "r111", type: "aircon", code: "AC-1-001", name: "แอร์ห้องประชุม 1A", active: true },
  { id: "a2", room: "r111", type: "microphone", code: "MIC-1-001", name: "ไมโครโฟนไร้สาย ตัวที่ 1", active: true },
  { id: "a3", room: "r111", type: "speaker", code: "SPK-1-001", name: "ลำโพงห้องประชุม 1A", active: true },
  { id: "a4", room: "r111", type: "tv", code: "TV-1-001", name: "จอทีวีห้องประชุม 1A", active: true },
  { id: "a5", room: "r112", type: "aircon", code: "AC-1-002", name: "แอร์ห้องประชุม 1B", active: true },
  { id: "a6", room: "r121", type: "aircon", code: "AC-2-001", name: "แอร์ฝ่ายบัญชี", active: true },
];
const categories = [
  { id: "c1", name: "ระบบปรับอากาศ", icon: "snow", priority: "medium", active: true, symptoms: [ { id: "s1", name: "แอร์ไม่เย็น", priority: "medium", active: true }, { id: "s2", name: "มีน้ำหยด", priority: "high", active: true }, { id: "s3", name: "เปิดเครื่องไม่ติด", priority: "medium", active: true }, { id: "s4", name: "มีกลิ่นไหม้หรือควัน", priority: "critical", active: true }, { id: "s5", name: "มีเสียงดังผิดปกติ", priority: "low", active: true } ] },
  { id: "c2", name: "ไฟฟ้าและแสงสว่าง", icon: "zap", priority: "medium", active: true, symptoms: [ { id: "s6", name: "หลอดไฟไม่ติด", priority: "medium", active: true }, { id: "s7", name: "ปลั๊กไฟชำรุด", priority: "high", active: true }, { id: "s8", name: "มีประกายไฟ", priority: "critical", active: true } ] },
  { id: "c3", name: "ประปาและสุขภัณฑ์", icon: "drop", priority: "medium", active: true, symptoms: [ { id: "s9", name: "ก๊อกน้ำรั่ว", priority: "medium", active: true }, { id: "s10", name: "ท่อน้ำแตก", priority: "high", active: true }, { id: "s11", name: "น้ำไหลช้า", priority: "low", active: true } ] },
  { id: "c4", name: "อาคารและเฟอร์นิเจอร์", icon: "chair", priority: "low", active: true, symptoms: [ { id: "s12", name: "เก้าอี้ชำรุด", priority: "low", active: true }, { id: "s13", name: "ประตูเปิดปิดไม่ได้", priority: "medium", active: true } ] },
  { id: "c5", name: "ห้องประชุมและโสตทัศนูปกรณ์", icon: "monitor", priority: "medium", active: true, symptoms: [ { id: "s14", name: "ไมโครโฟนไม่มีเสียง", priority: "medium", active: true }, { id: "s15", name: "จอทีวีไม่แสดงภาพ", priority: "medium", active: true } ] },
];
const permissionGroups = [
  { name: "งานแจ้งซ่อม", icon: "wrench", description: "การเข้าถึงและดำเนินการกับงานซ่อม", actions: [
    { id: "view_all", label: "ดูทุกงาน", hint: "เห็นงานซ่อมทั้งหมดในระบบ", defaults: ["technician", "admin"] },
    { id: "work", label: "ดำเนินการและบันทึกผลซ่อม", hint: "รับเรื่องและบันทึกผลการดำเนินงาน", defaults: ["technician"] },
    { id: "close_any", label: "ปิดงานใดก็ได้", hint: "ปิดงานได้โดยไม่ต้องรอตรวจรับ", defaults: ["admin"] },
  ] },
  { name: "งานทีมและช่างภายนอก", icon: "users", description: "งานที่ทีมทำเองและข้อมูลประกอบงานซ่อม", actions: [
    { id: "team_handle", label: "บันทึกงานทีมทำเอง", hint: "บันทึกงานที่ทีมแก้เองและส่งต่องานของตัวเอง", defaults: ["housekeeper_lead", "security_lead"] },
    { id: "handover_any", label: "ส่งต่องานทีมทุกงาน", hint: "ส่งต่องานทีมทำเองของทุกคนให้ช่าง", defaults: ["admin"] },
    { id: "contractor_manage", label: "จัดการช่างภายนอก", hint: "เพิ่มและแก้ไขข้อมูลช่างภายนอก", defaults: ["technician"] },
    { id: "overview_view", label: "ดูภาพรวมอาคาร", hint: "ดูอาคารและงานที่ยังไม่ปิด", defaults: ["admin"] },
  ] },
  { name: "ตั้งค่าระบบ", icon: "shield", description: "สิทธิ์ผู้ดูแลตามขอบเขตที่กำหนด", fixed: true, actions: [
    { id: "buildings", label: "อาคาร ชั้น และห้อง", defaults: ["admin"], hint: "จัดการข้อมูลสถานที่" },
    { id: "assets", label: "อุปกรณ์", defaults: ["admin"], hint: "เพิ่มและแก้ไขอุปกรณ์ในห้อง" },
    { id: "categories", label: "หมวดงานและอาการ", defaults: ["admin"], hint: "ตั้งค่าหมวดงาน อาการ และความเร่งด่วน" },
    { id: "users", label: "ผู้ใช้", defaults: [], hint: "สำหรับ Superadmin เท่านั้น" },
    { id: "roles", label: "Role และสิทธิ์", defaults: [], hint: "สำหรับ Superadmin เท่านั้น" },
  ] },
];
let matrix = {};
for (const role of roles) for (const group of permissionGroups) for (const permission of group.actions) matrix[`${role.id}:${permission.id}`] = role.id === "super_admin" || permission.defaults.includes(role.id);
let savedMatrix = { ...matrix };
const params = new URLSearchParams(location.search);
const state = {
  viewer: params.get("viewer") === "admin" ? "admin" : "super_admin",
  preview: ["loading", "empty", "error", "forbidden"].includes(params.get("state")) ? params.get("state") : "normal",
  page: location.hash.slice(1) || "users", roleTab: "permissions", mobileRole: "technician", userQuery: "", roleFilter: "", userPage: 1,
  placeTab: params.get("tab") === "types" ? "types" : "assets", building: "b1", floor: "f11", room: "r111", assetQuery: "", assetFilter: "", showInactiveAssets: false, category: "c1", showInactiveCategories: false,
};
const titles = { users: "ผู้ใช้", roles: "Role และสิทธิ์", places: "อาคารและอุปกรณ์", categories: "หมวดงานและอาการ" };
const subtitles = { users: "จัดการบทบาทของทุกคนที่เข้าใช้ BAMBAM ผ่าน SSO", roles: "กำหนดว่าแต่ละบทบาททำอะไรได้ใน BAMBAM", places: "เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น", categories: "จัดระเบียบหมวดงาน อาการ และความเร่งด่วนของงานแจ้งซ่อม" };
const canAccess = (page) => state.viewer === "super_admin" || !["users", "roles"].includes(page);
const changes = () => Object.keys(matrix).filter((key) => matrix[key] !== savedMatrix[key]);
const selectedBuilding = () => buildings.find((building) => building.id === state.building);
const selectedFloor = () => selectedBuilding().floors.find((floor) => floor.id === state.floor);
const selectedRoom = () => selectedFloor().rooms.find((room) => room.id === state.room);
const selectedCategory = () => categories.find((category) => category.id === state.category);
const allLocations = () => buildings.flatMap((building) => building.floors.flatMap((floor) => floor.rooms.map((room) => ({ building, floor, room }))));
const renderOptions = (items, selected, name = "name") => items.map((item) => `<option value="${esc(item.id)}" ${selected === item.id ? "selected" : ""}>${esc(item[name])}</option>`).join("");
const priorityOptions = (selected) => Object.entries(priorityNames).map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");

function renderShell() {
  const nav = (page, glyph) => `<a href="#${page}" class="nav-link ${state.page === page ? "active" : ""}" ${state.page === page ? 'aria-current="page"' : ""}>${icon(glyph)}${titles[page]}</a>`;
  $("#sidebar").innerHTML = `<div class="sidebar-heading"><div class="sidebar-identity"><img class="sidebar-logo" src="../../../../../frontend/public/brand/bam-logo.webp" width="104" height="34" alt="BAMBAM"><span>ตั้งค่าระบบ</span></div>${iconAction("close-nav", "ปิดเมนู", "", "close")}</div>
    <p class="nav-group-label">บริการ</p><nav class="nav-group" aria-label="บริการ"><a class="nav-link" href="http://localhost:3000/">${icon("home")}หน้าแรก</a><a class="nav-link" href="http://localhost:3000/repair/my">${icon("wrench")}แจ้งซ่อม</a><div class="nav-link nav-static">${icon("car")}จองรถ<span class="soon">เร็ว ๆ นี้</span></div><div class="nav-link nav-static">${icon("room")}จองห้องประชุม<span class="soon">เร็ว ๆ นี้</span></div></nav>
    <p class="nav-group-label">ข้อมูลกลาง</p><nav class="nav-group" aria-label="ตั้งค่าข้อมูลกลาง">${nav("places", "building")}${nav("categories", "tags")}</nav>
    ${state.viewer === "super_admin" ? `<p class="nav-group-label">ผู้ใช้และสิทธิ์</p><nav class="nav-group" aria-label="ผู้ใช้และสิทธิ์">${nav("users", "users")}${nav("roles", "shield")}</nav>` : ""}
    <div class="sidebar-spacer"></div><details class="preview-tools"><summary>มุมมองตัวอย่าง</summary><label for="viewer">บทบาท<select id="viewer"><option value="super_admin">Superadmin</option><option value="admin">Admin</option></select></label><label for="preview-state">สถานะหน้าจอ<select id="preview-state"><option value="normal">ปกติ</option><option value="loading">กำลังโหลด</option><option value="empty">ไม่มีข้อมูล</option><option value="error">ข้อผิดพลาด</option><option value="forbidden">ไม่มีสิทธิ์</option></select></label></details>`;
  $('[data-action="close-nav"]').classList.add("sidebar-close");
  $("#viewer").value = state.viewer;
  $("#preview-state").value = state.preview;
  document.title = `${titles[state.page]} · BAMBAM`;
}

function heading() {
  let right = "";
  const mascot = state.viewer === "admin" ? "admin-planner" : "superadmin-guardian";
  const subtitle = state.page === "places" && state.placeTab === "types" ? "จัดการประเภทอุปกรณ์ที่เลือกใช้ร่วมกันได้ในทุกอาคาร" : subtitles[state.page];
  if (canAccess(state.page) && state.preview === "normal") {
    if (state.page === "roles") right = action(`${icon("plus")}เพิ่ม Role`, "add-role", "", "primary");
    if (state.page === "categories") right = action(`${icon("plus")}เพิ่มหมวดงาน`, "add-category", "", "primary");
    if (state.page === "places" && state.placeTab === "types") right = action(`${icon("plus")}เพิ่มประเภทอุปกรณ์`, "add-asset-type", "", "primary");
  }
  return `<div class="page-heading"><div class="heading-main">${iconAction("open-nav", "เปิดเมนูหลัก", 'aria-controls="sidebar" aria-expanded="false"', "menu").replace('class="icon-button"', 'class="icon-button mobile-menu"')}<div class="heading-copy"><h1>${titles[state.page]}</h1><p>${subtitle}</p></div><img class="page-mascot" data-mascot-role="${state.viewer}" src="../../../../../frontend/public/brand/bam-mascot-${mascot}.webp" width="112" height="112" alt="" aria-hidden="true" decoding="async"></div>${right}</div>`;
}

function statePanel(type, title, description, button = "") {
  return `<section class="panel empty-state"><div class="empty-icon">${icon(type)}</div><h2>${title}</h2><p>${description}</p>${button}</section>`;
}

function render() {
  if (!titles[state.page]) state.page = state.viewer === "admin" ? "places" : "users";
  renderShell();
  let content;
  if (!canAccess(state.page) || state.preview === "forbidden") {
    content = statePanel("lock", "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", ["users", "roles"].includes(state.page) ? "การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น" : "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ", action("ไปที่อาคารและอุปกรณ์", "go-places", "", "primary"));
  } else if (state.preview === "loading") {
    content = `<section class="panel" aria-busy="true" aria-label="กำลังโหลด${titles[state.page]}"><div class="panel-heading"><h2>กำลังโหลดข้อมูล</h2></div>${Array.from({ length: 6 }, () => '<div class="skeleton-row"><div class="skeleton skeleton-circle"></div><div class="skeleton-lines"><div class="skeleton"></div><div class="skeleton"></div></div></div>').join("")}</section>`;
  } else if (state.preview === "error") {
    content = statePanel("alert", "โหลดข้อมูลไม่สำเร็จ", "ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่", action(`${icon("refresh")}ลองอีกครั้ง`, "retry", "", "primary"));
  } else if (state.preview === "empty") {
    const empty = { users: ["users", "ยังไม่พบผู้ใช้", "ผู้ใช้จะปรากฏเมื่อเข้าสู่ BAMBAM ผ่าน SSO ครั้งแรก", ""], roles: ["shield", "ยังไม่มี Role ที่สร้างเพิ่ม", "Role ระบบยังคงอยู่ คุณสามารถสร้าง Role เพิ่มตามหน้าที่ของทีม", action(`${icon("plus")}เพิ่ม Role`, "add-role", "", "primary")], places: ["building", "ยังไม่มีข้อมูลผังอาคาร", "อาคาร ชั้น และห้องจะแสดงเมื่อมีการกำหนดผังอาคารแล้ว", ""], categories: ["tags", "ยังไม่มีหมวดงาน", "เพิ่มหมวดงานและอาการ เพื่อให้พนักงานเลือกแจ้งซ่อมได้", action(`${icon("plus")}เพิ่มหมวดงาน`, "add-category", "", "primary")] }[state.page];
    content = statePanel(...empty);
    if (state.page === "places" && state.placeTab === "types") content = statePanel("box", "ยังไม่มีประเภทอุปกรณ์", "เพิ่มประเภทอุปกรณ์ เพื่อให้เลือกใช้ตอนเพิ่มอุปกรณ์ในห้อง", action(`${icon("plus")}เพิ่มประเภทอุปกรณ์`, "add-asset-type", "", "primary"));
    // System roles cannot disappear even when there are no additional custom roles.
    if (state.page === "roles") content += renderRoles();
  } else content = ({ users: renderUsers, roles: renderRoles, places: renderPlaces, categories: renderCategories })[state.page]();
  $("#main").innerHTML = heading() + content;
  renderSavebar();
  syncNavAccessibility();
}

function renderUsers() {
  const query = state.userQuery.trim().toLocaleLowerCase();
  const filtered = users.filter((user) => (!state.roleFilter || user.role === state.roleFilter) && (!query || `${user.name} ${user.code} ${user.email}`.toLocaleLowerCase().includes(query)));
  const pageSize = 6, pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.userPage = Math.min(state.userPage, pageCount);
  const rows = filtered.slice((state.userPage - 1) * pageSize, state.userPage * pageSize);
  return `<section class="panel"><div class="panel-heading"><h2>สมาชิกในระบบ <span class="count">${users.length} คน</span></h2><span class="tiny muted">${roles.length} Role</span></div><div class="toolbar"><div class="search-field">${icon("search")}<input id="user-search" aria-label="ค้นหาผู้ใช้" placeholder="ค้นหาชื่อ รหัสพนักงาน หรืออีเมล" value="${esc(state.userQuery)}"></div><select id="user-role-filter" class="filter-select" aria-label="กรองตาม Role"><option value="">Role: ทั้งหมด</option>${renderOptions(roles, state.roleFilter)}</select><span class="toolbar-note">พบ ${filtered.length} คน</span></div>
    ${rows.length ? `<div class="table-wrap"><table class="user-table"><thead><tr><th>ผู้ใช้</th><th class="department-column">แผนก / ตำแหน่ง</th><th>Role</th><th>เข้าใช้ล่าสุด</th><th><span class="hidden">รายละเอียด</span></th></tr></thead><tbody>${rows.map((user) => `<tr><td class="member-column"><div class="person">${avatar(user.name)}<div><strong>${esc(user.name)}${user.id === currentUser().id ? ' <span class="muted tiny">(คุณ)</span>' : ""}</strong><small>${esc(user.email)}</small><div class="person-meta mono">${user.code}</div></div></div></td><td class="department-column"><span>${esc(user.department)}</span><div class="person-meta">${esc(user.position)}</div></td><td class="role-column"><button type="button" class="role-control" data-action="change-user-role" data-id="${user.id}" aria-label="เปลี่ยน Role ของ ${esc(user.name)}" ${user.locked || user.id === currentUser().id ? 'disabled title="Role นี้กำหนดโดยระบบ"' : ""}>${esc(roleName(user.role))}${icon(user.locked ? "lock" : "down")}</button>${user.locked ? '<div class="tiny muted" style="padding-left:8px;font-size:10px">กำหนดโดยระบบ</div>' : ""}</td><td class="last-login-column nowrap">${user.last.replace(" · ", "<br>")}</td><td class="action-column">${iconAction("user-detail", `ดูข้อมูล ${user.name}`, `data-id="${user.id}"`, "chevron")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><div class="empty-icon">${icon("search")}</div><h2>ไม่พบผู้ใช้ที่ตรงกับการค้นหา</h2><p>ลองค้นหาด้วยชื่อ รหัสพนักงาน หรืออีเมลอื่น</p>${action("ล้างการค้นหาและตัวกรอง", "clear-users")}</div>`}
    <div class="pagination"><span>${filtered.length ? `แสดง ${(state.userPage - 1) * pageSize + 1}–${Math.min(state.userPage * pageSize, filtered.length)} จาก ${filtered.length} คน` : "0 คน"}</span><div class="pagination-buttons"><button class="page-number" data-action="user-page" data-page="${state.userPage - 1}" aria-label="หน้าก่อนหน้า" ${state.userPage === 1 ? "disabled" : ""}>‹</button>${Array.from({ length: pageCount }, (_, index) => `<button class="page-number ${state.userPage === index + 1 ? "active" : ""}" data-action="user-page" data-page="${index + 1}" ${state.userPage === index + 1 ? 'aria-current="page"' : ""}>${index + 1}</button>`).join("")}<button class="page-number" data-action="user-page" data-page="${state.userPage + 1}" aria-label="หน้าถัดไป" ${state.userPage === pageCount ? "disabled" : ""}>›</button></div></div></section>
    <div class="subnote">${icon("info")}<span>ชื่อ อีเมล และข้อมูลพนักงานมาจาก SSO · การเปลี่ยน Role ต้องยืนยันก่อนบันทึก</span></div>`;
}

function renderRoles() {
  const tab = `<div class="segmented" role="group" aria-label="มุมมอง Role และสิทธิ์"><button data-action="role-tab" data-tab="permissions" class="${state.roleTab === "permissions" ? "active" : ""}" aria-pressed="${state.roleTab === "permissions"}">ตารางสิทธิ์</button><button data-action="role-tab" data-tab="roles" class="${state.roleTab === "roles" ? "active" : ""}" aria-pressed="${state.roleTab === "roles"}">รายการ Role <span class="count">${roles.length}</span></button></div>`;
  if (state.roleTab === "roles") return tab + `<section class="panel"><div class="panel-heading"><h2>Role ในระบบ <span class="count">${roles.length}</span></h2></div><div class="table-wrap"><table class="role-list-table"><thead><tr><th>Role</th><th class="description-column">คำอธิบาย</th><th>ผู้ใช้</th><th></th></tr></thead><tbody>${roles.map((role) => `<tr><td><strong style="font-weight:500">${esc(role.name)}</strong>${role.system ? `<span class="system-badge">${icon("lock")}Role ระบบ</span>` : ""}</td><td class="description-column muted">${esc(role.description)}</td><td><button class="text-button" data-action="role-users" data-id="${role.id}">${roleCount(role.id)} คน</button></td><td>${role.id === "super_admin" ? '<span class="muted tiny">กำหนดโดยระบบ</span>' : iconAction("role-menu", `ตัวเลือก Role ${role.name}`, `data-id="${role.id}"`)}</td></tr>`).join("")}</tbody></table></div></section>`;
  return tab + `<div class="info-strip">${icon("info")}<div><strong>ทุก Role แจ้งซ่อมและติดตามงานตัวเองได้เสมอ</strong><br>Superadmin มีทุกสิทธิ์ · สิทธิ์ตั้งค่าระบบล็อกตามขอบเขตของผู้ดูแล</div></div>
    <div class="mobile-role-select"><label for="mobile-role">เลือก Role ที่ต้องการตั้งค่า</label><select id="mobile-role">${renderOptions(roles, state.mobileRole)}</select></div>
    ${permissionGroups.map((group, groupIndex) => `<section class="panel matrix-card"><div class="panel-heading"><h2><span class="matrix-title-icon">${icon(group.icon)}</span>${group.name}</h2><span class="tiny muted">${group.fixed ? `${icon("lock", "small")} กำหนดโดยระบบ` : "ติ๊กเพื่อให้สิทธิ์"}</span></div>
    <table class="matrix-table"><thead><tr><th>Role / การกระทำ</th>${group.actions.map((permission) => `<th title="${esc(permission.hint)}">${permission.label}</th>`).join("")}</tr></thead><tbody>${roles.map((role) => `<tr class="${role.id === "super_admin" ? "locked" : ""}"><td><div class="matrix-role">${role.id === "super_admin" ? icon("lock") : ""}<div>${esc(role.name)}<small>${roleCount(role.id)} คน</small></div></div></td>${group.actions.map((permission) => permissionCell(role.id, permission, groupIndex, false)).join("")}</tr>`).join("")}</tbody></table>
    <div class="matrix-mobile">${group.actions.map((permission) => permissionCell(state.mobileRole, permission, groupIndex, true)).join("")}</div></section>`).join("")}
    <div class="subnote">${icon("info")}<span>ความเร่งด่วนกำหนดจากอาการที่เลือกตอนแจ้งซ่อม ตั้งค่าได้ที่ “หมวดงานและอาการ”</span></div>`;
}

function permissionCell(roleId, permission, groupIndex, mobile) {
  const key = `${roleId}:${permission.id}`, locked = roleId === "super_admin" || permissionGroups[groupIndex].fixed, changed = matrix[key] !== savedMatrix[key];
  const input = `<input type="checkbox" class="${mobile ? "switch" : "permission-check"}" ${mobile ? 'role="switch"' : ""} data-permission="${esc(key)}" aria-label="${esc(permission.label)} — ${esc(roleName(roleId))}" ${matrix[key] ? "checked" : ""} ${locked ? "disabled" : ""}>`;
  return mobile ? `<label class="mobile-permission ${changed ? "changed" : ""}"><span><strong>${permission.label}</strong><small>${permission.hint}${locked ? " · กำหนดโดยระบบ" : ""}</small></span>${input}</label>` : `<td><label class="cell-label ${changed ? "changed" : ""} ${locked ? "locked-cell" : ""}" title="${locked ? "สิทธิ์นี้กำหนดโดยระบบ" : esc(permission.hint)}">${input}</label></td>`;
}

function renderSavebar() {
  const pending = changes();
  const visible = pending.length > 0 && state.page === "roles" && canAccess("roles") && state.preview === "normal";
  $("#savebar").hidden = !visible;
  document.body.classList.toggle("has-unsaved", visible);
  $("#savebar").innerHTML = visible ? `<div class="savebar-message"><span class="savebar-dot"></span>เปลี่ยนสิทธิ์ <strong>${pending.length} รายการ</strong></div><div class="savebar-actions">${action("ยกเลิกการเปลี่ยนแปลง", "reset-permissions", "", "subtle")}${action(`${icon("check")}บันทึกสิทธิ์`, "save-permissions", "", "primary")}</div>` : "";
}

function placeTabs() {
  return `<div class="section-tabs" role="group" aria-label="มุมมองอาคารและอุปกรณ์"><button data-action="place-tab" data-tab="assets" class="${state.placeTab === "assets" ? "active" : ""}" aria-pressed="${state.placeTab === "assets"}">${icon("box")}อุปกรณ์ในห้อง</button><button data-action="place-tab" data-tab="types" class="${state.placeTab === "types" ? "active" : ""}" aria-pressed="${state.placeTab === "types"}">${icon("tags")}ประเภทอุปกรณ์ <span class="count">${assetTypes.length}</span></button></div>`;
}

function renderAssetTypes() {
  return `<section class="panel asset-types-panel"><div class="panel-heading"><div><h2>ประเภทอุปกรณ์</h2><p>ใช้ร่วมกันทุกอาคาร และเลือกได้เมื่อเพิ่มอุปกรณ์</p></div><span class="count">${assetTypes.length} ประเภท</span></div><table class="asset-types-table"><thead><tr><th>ชื่อประเภท</th><th>อุปกรณ์ที่ใช้งาน</th><th></th></tr></thead><tbody>${assetTypes.map((type) => `<tr><td><div class="person"><span class="asset-icon">${icon(type.icon)}</span><strong>${esc(type.name)}</strong></div></td><td class="muted">${assets.filter((asset) => asset.type === type.id && asset.active).length} ชิ้น</td><td><button class="text-button" data-action="edit-asset-type" data-id="${type.id}" aria-label="แก้ไขประเภท ${esc(type.name)}">${icon("edit")}แก้ไข</button></td></tr>`).join("")}</tbody></table></section>`;
}

function renderPlaces() {
  const tabs = placeTabs();
  if (state.placeTab === "types") return tabs + renderAssetTypes();
  const building = selectedBuilding(), floor = selectedFloor(), room = selectedRoom();
  const list = assets.filter((asset) => asset.room === room.id && (asset.active || state.showInactiveAssets) && (!state.assetFilter || asset.type === state.assetFilter) && `${asset.name} ${asset.code}`.toLocaleLowerCase().includes(state.assetQuery.toLocaleLowerCase()));
  return tabs + `<div class="split-view places-layout"><section class="panel navigator-panel"><div class="panel-heading"><h2>เลือกห้องจากผัง</h2></div><div class="navigator-body"><div class="navigator-section-heading"><label for="building-select">อาคาร</label><button class="text-button" data-action="rename-building" aria-label="แก้ไขชื่ออาคาร">${icon("edit")}แก้ชื่อ</button></div><select id="building-select">${renderOptions(buildings, building.id)}</select><div class="navigator-section"><div class="navigator-section-heading"><span>ชั้น</span></div><div class="floor-options">${building.floors.map((item) => `<button class="floor-option ${item.id === floor.id ? "active" : ""}" data-action="select-floor" data-id="${item.id}" aria-pressed="${item.id === floor.id}">${esc(item.name)}</button>`).join("")}</div></div><div class="navigator-section"><div class="navigator-section-heading"><span>ห้อง / พื้นที่</span><span class="muted">${floor.rooms.length} ห้อง</span></div><div class="rooms-list">${floor.rooms.map((item) => `<button class="room-button ${room.id === item.id ? "active" : ""}" data-action="select-room" data-id="${item.id}" aria-pressed="${room.id === item.id}">${icon("room")}<span>${esc(item.name)}</span><span class="count">${assets.filter((asset) => asset.room === item.id && asset.active).length}</span></button>`).join("")}</div></div></div><div class="plan-note">${icon("lock")}<span>ชั้นและห้องอ้างอิงจากผังอาคาร</span></div></section>
    <div class="asset-focus"><section class="panel"><div class="panel-heading room-heading"><div><div class="context-path">${esc(building.name)}${icon("chevron")}${esc(floor.name)}</div><div class="room-title"><h2>${esc(room.name)}</h2>${iconAction("rename-room", "แก้ไขชื่อห้อง", "", "edit")}</div><p>อุปกรณ์ ${assets.filter((asset) => asset.room === room.id && asset.active).length} ชิ้น</p></div>${action(`${icon("plus")}เพิ่มอุปกรณ์`, "add-asset", "", "primary")}</div><div class="toolbar"><div class="search-field">${icon("search")}<input id="asset-search" aria-label="ค้นหาอุปกรณ์" placeholder="ค้นหาชื่อหรือรหัสอุปกรณ์" value="${esc(state.assetQuery)}"></div><select id="asset-type-filter" class="filter-select" aria-label="กรองประเภทอุปกรณ์"><option value="">ทุกประเภท</option>${renderOptions(assetTypes, state.assetFilter)}</select></div>
    ${list.length ? `<div class="table-wrap"><table class="asset-table"><thead><tr><th>อุปกรณ์</th><th class="type-column">ประเภท</th><th></th></tr></thead><tbody>${list.map((asset) => { const type = assetTypes.find((item) => item.id === asset.type); return `<tr class="${asset.active ? "" : "inactive"}"><td><div class="person"><span class="asset-icon">${icon(type.icon)}</span><div><strong>${esc(asset.name)}</strong><small class="mono">${esc(asset.code)}</small>${asset.active ? "" : '<small>ปิดใช้งาน</small>'}</div></div></td><td class="type-column muted">${esc(type.name)}</td><td>${iconAction("asset-menu", `ตัวเลือก ${asset.name}`, `data-id="${asset.id}"`)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty-state"><div class="empty-icon">${icon("box")}</div><h2>${state.assetQuery || state.assetFilter ? "ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง" : "ยังไม่มีอุปกรณ์ในห้องนี้"}</h2><p>${state.assetQuery || state.assetFilter ? "ลองเปลี่ยนคำค้นหาหรือประเภทอุปกรณ์" : "เพิ่มอุปกรณ์ที่ติดตั้งในห้องนี้ เพื่อใช้อ้างอิงตอนแจ้งซ่อม"}</p>${state.assetQuery || state.assetFilter ? action("ล้างตัวกรอง", "clear-assets") : action(`${icon("plus")}เพิ่มอุปกรณ์ชิ้นแรก`, "add-asset", "", "primary")}</div>`}
    </section><label class="toggle-line"><input type="checkbox" id="inactive-assets" ${state.showInactiveAssets ? "checked" : ""}>แสดงอุปกรณ์ที่ปิดใช้งาน</label></div></div>`;
}

function renderCategories() {
  const category = selectedCategory(), visible = categories.filter((item) => item.active || state.showInactiveCategories);
  return `<div class="split-view"><section class="panel navigator-panel"><div class="panel-heading"><h2>หมวดงาน <span class="count">${visible.length}</span></h2></div><div class="category-list">${visible.map((item) => `<button class="category-button ${item.id === category.id ? "active" : ""} ${item.active ? "" : "inactive"}" data-action="select-category" data-id="${item.id}" aria-pressed="${item.id === category.id}"><span class="category-icon">${icon(item.icon)}</span><span><strong>${esc(item.name)}</strong><small>${item.symptoms.filter((symptom) => symptom.active).length} อาการ${item.active ? "" : " · ปิดใช้งาน"}</small></span>${icon("chevron")}</button>`).join("")}</div><div class="navigator-foot"><label class="toggle-line"><input type="checkbox" id="inactive-categories" ${state.showInactiveCategories ? "checked" : ""}>แสดงที่ปิดใช้งาน</label></div></section><div><section class="panel"><div class="category-header"><div class="category-header-main"><div class="person"><span class="category-icon">${icon(category.icon)}</span><div><h2>${esc(category.name)}</h2><p>${category.active ? "เปิดใช้งานในแบบฟอร์มแจ้งซ่อม" : "ปิดใช้งาน"}</p></div></div>${iconAction("category-menu", `ตัวเลือกหมวด ${category.name}`, `data-id="${category.id}"`)}</div><div class="category-meta">ความเร่งด่วนตั้งต้น ${priorityBadge(category.priority)}<span>ใช้เมื่อเลือก “อาการอื่น ๆ”</span></div></div><div class="panel-heading"><h3>อาการ <span class="count">${category.symptoms.filter((symptom) => symptom.active).length}</span></h3>${action(`${icon("plus")}เพิ่มอาการ`, "add-symptom", "", "primary small")}</div>${category.symptoms.filter((symptom) => symptom.active || state.showInactiveCategories).map((symptom) => `<div class="symptom-row ${symptom.active ? "" : "inactive"}"><span class="symptom-name">${esc(symptom.name)}${symptom.active ? "" : '<small class="muted"> · ปิดใช้งาน</small>'}</span>${priorityBadge(symptom.priority)}${iconAction("symptom-menu", `ตัวเลือกอาการ ${symptom.name}`, `data-id="${symptom.id}"`)}</div>`).join("") || `<div class="empty-state"><div class="empty-icon">${icon("tags")}</div><h2>ยังไม่มีอาการที่เปิดใช้งาน</h2><p>หมวดนี้จะไม่แสดงในแบบฟอร์มแจ้งซ่อม จนกว่าจะมีอาการที่เปิดใช้งาน</p>${action("เพิ่มอาการ", "add-symptom", "", "primary")}</div>`}</section><div class="subnote">${icon("info")}<span>เมื่อเลือกหลายอาการ งานจะใช้ระดับความเร่งด่วนสูงสุดของอาการที่เลือก<br>การตั้งค่านี้ใช้กับงานที่แจ้งใหม่ งานเดิมคงระดับที่ได้รับไว้</span></div></div></div>`;
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").innerHTML = `${icon("check")}<span class="toast-message">${esc(message)}</span>`;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3800);
}

let modalCleanup = null, modalOrigin = null;
function closeModal() { $("#modal").close(); }
function openModal(title, subtitle, body, footer = "", setup) {
  const modal = $("#modal");
  if (modal.open) { modalCleanup?.(); modalCleanup = null; }
  else modalOrigin = document.activeElement;
  modal.innerHTML = `<div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${iconAction("close-modal", "ปิดหน้าต่าง", "", "close")}</div>${body}${footer ? `<div class="modal-footer">${footer}</div>` : ""}`;
  if (!modal.open) modal.showModal();
  setup?.(modal);
  const focusTarget = $('[autofocus]', modal) || $('input:not([type="hidden"]),select,button', modal);
  focusTarget?.focus();
}
$("#modal").addEventListener("close", () => { modalCleanup?.(); modalCleanup = null; if (modalOrigin?.isConnected) modalOrigin.focus(); });

function confirm(title, body, onConfirm, label = "ยืนยัน", danger = false) {
  openModal(title, "", `<div class="modal-body">${body}</div>`, action("ยกเลิก", "close-modal") + `<button class="button ${danger ? "danger" : "primary"}" id="confirm-action">${label}</button>`, (modal) => { $("#confirm-action", modal).onclick = () => { closeModal(); onConfirm(); }; });
}

function guardedNavigate(next) {
  if (!changes().length) { next(); return; }
  confirm("ออกโดยไม่บันทึก?", `<p class="small muted">มีการเปลี่ยนสิทธิ์ ${changes().length} รายการที่ยังไม่บันทึก</p>`, () => { matrix = { ...savedMatrix }; next(); }, "ออกโดยไม่บันทึก", true);
}

function navigate(page) {
  if (state.page === page) return;
  guardedNavigate(() => { state.page = page; history.replaceState(null, "", `#${page}`); closeNav(); render(); window.scrollTo({ top: 0 }); $("#main").focus(); });
}
function syncNavAccessibility() {
  const mobile = window.matchMedia("(max-width:1023px)").matches;
  const open = mobile && document.body.classList.contains("nav-open");
  const sidebar = $("#sidebar");
  sidebar.inert = mobile && !open;
  if (mobile && !open) sidebar.setAttribute("aria-hidden", "true");
  else sidebar.removeAttribute("aria-hidden");
  $(".workspace").inert = open;
  document.body.style.overflow = open ? "hidden" : "";
  $("#nav-overlay").hidden = !open;
  $('[data-action="open-nav"]')?.setAttribute("aria-expanded", String(open));
}
function closeNav() { document.body.classList.remove("nav-open"); syncNavAccessibility(); }
function openNav() { document.body.classList.add("nav-open"); syncNavAccessibility(); ($("#sidebar .nav-link.active") || $("#sidebar .nav-link"))?.focus(); }

function userRoleDialog(user) {
  if (!canAccess("users") || user.locked || user.id === currentUser().id) return;
  const choices = roles.map((role) => `<label class="role-choice"><input type="radio" name="new-role" value="${role.id}" ${user.role === role.id ? "checked" : ""}><span>${esc(role.name)}</span>${user.role === role.id ? "<small>ปัจจุบัน</small>" : ""}</label>`).join("");
  openModal("เปลี่ยน Role", "กำหนดบทบาทให้เหมาะกับหน้าที่ของผู้ใช้", `<div class="modal-body"><div class="modal-person">${avatar(user.name)}<div><strong>${esc(user.name)}</strong><small>${user.code} · ${esc(user.department)}</small></div></div><span class="field-label">Role ใหม่ <span class="required">*</span></span><div class="role-choices">${choices}</div><div id="role-warning" class="warning-box" hidden>ผู้ใช้นี้จะตั้งค่าระบบและเปลี่ยนสิทธิ์ของทุกคนได้</div><div class="confirmation-line" id="role-confirmation">Role ปัจจุบัน: <strong>${esc(roleName(user.role))}</strong></div></div>`, action("ยกเลิก", "close-modal") + '<button class="button primary" id="save-user-role" disabled>ยืนยันเปลี่ยน Role</button>', (modal) => {
    modal.onchange = () => {
      const next = $('input[name="new-role"]:checked', modal).value;
      $("#save-user-role", modal).disabled = next === user.role;
      $("#role-warning", modal).hidden = next !== "super_admin" || next === user.role;
      $("#role-confirmation", modal).innerHTML = `เปลี่ยน <strong>${esc(user.name)}</strong><br>จาก <strong>${esc(roleName(user.role))}</strong> ${icon("arrow", "small")} <strong>${esc(roleName(next))}</strong>`;
    };
    modalCleanup = () => { modal.onchange = null; };
    $("#save-user-role", modal).onclick = () => {
      const next = $('input[name="new-role"]:checked', modal).value, previous = user.role;
      user.role = next; user.history = user.history || [];
      user.history.unshift({ previous, next });
      closeModal(); render(); toast(`เปลี่ยน Role ของ ${user.name} เป็น ${roleName(next)} แล้ว`);
    };
  });
}

function userDetail(user) {
  if (!canAccess("users")) return;
  openModal("ข้อมูลผู้ใช้", "ข้อมูลพนักงานจาก RMC SSO", `<div class="modal-body"><div class="modal-person">${avatar(user.name, "large")}<div><strong>${esc(user.name)}</strong><small>${esc(roleName(user.role))}${user.locked ? " · กำหนดโดยระบบ" : ""}</small></div></div><dl class="detail-grid"><dt>รหัสพนักงาน</dt><dd class="mono">${user.code}</dd><dt>อีเมล</dt><dd>${esc(user.email)}</dd><dt>แผนก</dt><dd>${esc(user.department)}</dd><dt>ตำแหน่ง</dt><dd>${esc(user.position)}</dd><dt>เข้าใช้ล่าสุด</dt><dd>${user.last}</dd></dl><div class="detail-section"><h3>ประวัติ Role</h3>${(user.history || []).map((entry) => `<div class="history-line"><strong>${esc(roleName(entry.previous))} → ${esc(roleName(entry.next))}</strong><br>26 ต.ค. 2569 · โดย ${esc(currentUser().name)}</div>`).join("")}<div class="history-line"><strong>เข้าใช้ครั้งแรก · ${esc(roleName(user.history?.length ? user.history.at(-1).previous : user.role))}</strong><br>16 ต.ค. 2569 · ข้อมูลตัวอย่าง</div></div>${user.locked ? `<div class="subnote">${icon("lock")}Role นี้กำหนดโดยระบบ จึงแก้ไขจากหน้านี้ไม่ได้</div>` : ""}</div>`, action("ปิด", "close-modal") + (user.locked || user.id === currentUser().id ? "" : action("เปลี่ยน Role", "change-user-role", `data-id="${user.id}"`, "primary")));
}

function roleDialog(existing) {
  if (!canAccess("roles")) return;
  openModal(existing ? "แก้ไข Role" : "เพิ่ม Role", "ตั้งชื่อบทบาทตามหน้าที่ของทีม", `<form id="role-form"><div class="modal-body"><p class="form-error" id="form-error" role="alert" hidden></p><div class="field"><label for="role-name">ชื่อ Role <span class="required">*</span></label><input id="role-name" name="name" required maxlength="50" value="${esc(existing?.name || "")}" placeholder="เช่น หัวหน้าช่าง" autofocus></div><div class="field"><label for="role-description">คำอธิบาย</label><textarea id="role-description" name="description" maxlength="200" placeholder="Role นี้ใช้กับใคร">${esc(existing?.description || "")}</textarea></div>${existing ? "" : `<div class="field"><label for="copy-role">เริ่มต้นสิทธิ์</label><select id="copy-role" name="copy"><option value="">สิทธิ์พื้นฐานเท่านั้น</option>${roles.filter((role) => role.id !== "super_admin").map((role) => `<option value="${role.id}">คัดลอกจาก ${esc(role.name)}</option>`).join("")}</select><p class="field-hint">คัดลอกเฉพาะสิทธิ์งานซ่อม สิทธิ์ตั้งค่าระบบสงวนตามบทบาทผู้ดูแล</p></div>`}</div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">${existing ? "บันทึก" : "เพิ่ม Role"}</button></div></form>`, "", (modal) => { $("#role-form", modal).onsubmit = (event) => { event.preventDefault(); const data = new FormData(event.target), name = data.get("name").trim(); if (!name) return showError("กรุณากรอกชื่อ Role"); if (roles.some((role) => role.id !== existing?.id && role.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError("ชื่อนี้มีอยู่แล้ว"); if (existing) { existing.name = name; existing.description = data.get("description").trim(); } else { const role = { id: uid(), name, description: data.get("description").trim() }; roles.push(role); for (const group of permissionGroups) for (const permission of group.actions) { const key = `${role.id}:${permission.id}`; const value = !group.fixed && data.get("copy") ? !!savedMatrix[`${data.get("copy")}:${permission.id}`] : false; matrix[key] = value; savedMatrix[key] = value; } } state.preview = "normal"; closeModal(); render(); toast(existing ? "บันทึก Role แล้ว" : `เพิ่ม Role “${name}” แล้ว`); }; });
}

function showError(message) { const node = $("#form-error"); node.textContent = message; node.hidden = false; node.scrollIntoView({ block: "nearest" }); }

function assetDialog(existing) {
  const location = existing ? allLocations().find((item) => item.room.id === existing.room) : { building: selectedBuilding(), floor: selectedFloor(), room: selectedRoom() };
  openModal(existing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์", "ข้อมูลอุปกรณ์และตำแหน่งที่ติดตั้ง", `<form id="asset-form"><div class="modal-body"><p class="form-error" id="form-error" role="alert" hidden></p><div class="form-grid"><div class="field"><label for="asset-building">อาคาร <span class="required">*</span></label><select id="asset-building" name="building">${renderOptions(buildings, location.building.id)}</select></div><div class="field"><label for="asset-floor">ชั้น <span class="required">*</span></label><select id="asset-floor" name="floor">${renderOptions(location.building.floors, location.floor.id)}</select></div></div><div class="field"><label for="asset-room">ห้อง / พื้นที่ <span class="required">*</span></label><select id="asset-room" name="room">${renderOptions(location.floor.rooms, location.room.id)}</select></div><div class="field"><div class="field-label-row"><label for="asset-type">ประเภทอุปกรณ์ <span class="required">*</span></label><button type="button" class="text-button" data-action="toggle-inline-type" aria-expanded="false" aria-controls="inline-type-editor">${icon("plus")}เพิ่มประเภทใหม่</button></div><select id="asset-type" name="type">${renderOptions(assetTypes, existing?.type || "aircon")}</select><div id="inline-type-editor" class="inline-editor" hidden><label for="inline-type-name">ชื่อประเภทใหม่</label><input id="inline-type-name" maxlength="100" placeholder="เช่น เครื่องพิมพ์"><p id="inline-type-error" class="form-error" role="alert" hidden></p><div class="inline-actions">${action("ยกเลิก", "cancel-inline-type", "", "small")}${action("เพิ่มประเภท", "save-inline-type", "", "primary small")}</div></div></div><div class="field"><label for="asset-code">รหัสอุปกรณ์ <span class="required">*</span></label><input id="asset-code" name="code" maxlength="100" required value="${esc(existing?.code || "")}" placeholder="เช่น AC-1-003"><p class="field-hint">รหัสต้องไม่ซ้ำกับอุปกรณ์อื่นในระบบ</p></div><div class="field"><label for="asset-name">ชื่ออุปกรณ์ <span class="required">*</span></label><input id="asset-name" name="name" maxlength="100" required value="${esc(existing?.name || "")}" placeholder="เช่น แอร์ห้องประชุม 1A ตัวซ้าย"></div></div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">${existing ? "บันทึก" : "เพิ่มอุปกรณ์"}</button></div></form>`, "", (modal) => {
    $("#asset-building", modal).onchange = (event) => { const building = buildings.find((item) => item.id === event.target.value); $("#asset-floor", modal).innerHTML = renderOptions(building.floors, building.floors[0].id); $("#asset-floor", modal).dispatchEvent(new Event("change")); };
    $("#asset-floor", modal).onchange = (event) => { const building = buildings.find((item) => item.id === $("#asset-building", modal).value), floor = building.floors.find((item) => item.id === event.target.value); $("#asset-room", modal).innerHTML = renderOptions(floor.rooms, floor.rooms[0].id); };
    $("#asset-form", modal).onsubmit = (event) => { event.preventDefault(); const data = new FormData(event.target), code = data.get("code").trim(), name = data.get("name").trim(); if (!code || !name) return showError("กรุณากรอกรหัสและชื่ออุปกรณ์"); if (assets.some((asset) => asset.id !== existing?.id && asset.code.toLocaleLowerCase() === code.toLocaleLowerCase())) return showError("รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น"); const record = { room: data.get("room"), type: data.get("type"), code, name }; if (existing) Object.assign(existing, record); else assets.push({ id: uid(), ...record, active: true }); state.building = data.get("building"); state.floor = data.get("floor"); state.room = data.get("room"); state.assetQuery = ""; state.assetFilter = ""; state.preview = "normal"; closeModal(); render(); toast(existing ? "บันทึกอุปกรณ์แล้ว" : "เพิ่มอุปกรณ์แล้ว"); };
  });
}

function renameLocation(kind) {
  if (!["building", "room"].includes(kind)) return;
  const existing = kind === "building" ? selectedBuilding() : selectedRoom();
  const label = kind === "building" ? "อาคาร" : "ห้อง / พื้นที่";
  openModal(`แก้ไขชื่อ${label}`, kind === "room" ? `${selectedBuilding().name} · ${selectedFloor().name}` : "ชื่อที่ใช้แสดงในระบบ", `<form id="location-form"><div class="modal-body"><p id="form-error" class="form-error" role="alert" hidden></p><div class="field"><label for="location-name">ชื่อ${label} <span class="required">*</span></label><input id="location-name" name="name" maxlength="100" value="${esc(existing.name)}" required autofocus></div><p class="field-hint">เปลี่ยนชื่อที่แสดง โดยตำแหน่งในผังและอุปกรณ์ยังอยู่ที่เดิม</p></div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">บันทึกชื่อ</button></div></form>`, "", (modal) => {
    $("#location-form", modal).onsubmit = (event) => {
      event.preventDefault();
      const name = new FormData(event.target).get("name").trim();
      const list = kind === "building" ? buildings : selectedFloor().rooms;
      if (!name) return showError("กรุณากรอกชื่อ");
      if (list.some((item) => item.id !== existing.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError("ชื่อนี้มีอยู่แล้ว");
      existing.name = name;
      closeModal(); render(); toast("บันทึกชื่อแล้ว");
    };
  });
}

function assetTypeDialog(existing) {
  const glyphs = { box: "อุปกรณ์ทั่วไป", aircon: "เครื่องปรับอากาศ", mic: "ไมโครโฟน", speaker: "ลำโพง", monitor: "จอภาพ", plug: "อุปกรณ์ไฟฟ้า", drop: "ระบบน้ำ", chair: "เฟอร์นิเจอร์" };
  openModal(existing ? "แก้ไขประเภทอุปกรณ์" : "เพิ่มประเภทอุปกรณ์", "ประเภทนี้เลือกใช้ได้กับอุปกรณ์ในทุกอาคาร", `<form id="asset-type-form"><div class="modal-body"><p id="form-error" class="form-error" role="alert" hidden></p><div class="field"><label for="asset-type-name">ชื่อประเภทอุปกรณ์ <span class="required">*</span></label><input id="asset-type-name" name="name" required maxlength="100" value="${esc(existing?.name || "")}" placeholder="เช่น เครื่องพิมพ์" autofocus></div><div class="field"><span class="field-label">ไอคอน</span><div class="icon-picker">${Object.entries(glyphs).map(([key, label]) => `<label title="${label}"><input type="radio" name="icon" value="${key}" aria-label="${label}" ${key === (existing?.icon || "box") ? "checked" : ""}>${icon(key)}</label>`).join("")}</div></div></div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">${existing ? "บันทึก" : "เพิ่มประเภทอุปกรณ์"}</button></div></form>`, "", (modal) => {
    $("#asset-type-form", modal).onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target), name = data.get("name").trim();
      if (!name) return showError("กรุณากรอกชื่อประเภทอุปกรณ์");
      if (assetTypes.some((type) => type.id !== existing?.id && type.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError("ประเภทอุปกรณ์นี้มีอยู่แล้ว");
      if (existing) { existing.name = name; existing.icon = data.get("icon"); }
      else assetTypes.push({ id: uid(), name, icon: data.get("icon"), prefix: "" });
      state.preview = "normal"; closeModal(); render(); toast(existing ? "บันทึกประเภทอุปกรณ์แล้ว" : "เพิ่มประเภทอุปกรณ์แล้ว");
    };
  });
}

function addInlineAssetType() {
  const input = $("#inline-type-name"), name = input.value.trim(), error = $("#inline-type-error");
  const message = !name ? "กรุณากรอกชื่อประเภทอุปกรณ์" : assetTypes.some((type) => type.name.toLocaleLowerCase() === name.toLocaleLowerCase()) ? "ประเภทอุปกรณ์นี้มีอยู่แล้ว" : "";
  error.textContent = message; error.hidden = !message;
  if (message) { input.focus(); return; }
  const type = { id: uid(), name, icon: "box", prefix: "" };
  assetTypes.push(type);
  $("#asset-type").innerHTML = renderOptions(assetTypes, type.id);
  $("#inline-type-editor").hidden = true;
  $('[data-action="toggle-inline-type"]').setAttribute("aria-expanded", "false");
  input.value = "";
  $("#asset-type").focus();
  render();
  toast("เพิ่มประเภทอุปกรณ์แล้ว");
}

function categoryDialog(existing) {
  const glyphs = { wrench: "ทั่วไป", snow: "ปรับอากาศ", zap: "ไฟฟ้า", plug: "ปลั๊ก", drop: "น้ำ", shower: "สุขภัณฑ์", chair: "เฟอร์นิเจอร์", room: "ประตู / อาคาร", clean: "ความสะอาด", trash: "ขยะ", monitor: "โสตทัศนูปกรณ์", building: "อาคาร" };
  openModal(existing ? "แก้ไขหมวดงาน" : "เพิ่มหมวดงาน", "หมวดงานที่พนักงานเลือกตอนแจ้งซ่อม", `<form id="category-form"><div class="modal-body"><p id="form-error" class="form-error" role="alert" hidden></p><div class="field"><label for="category-name">ชื่อหมวดงาน <span class="required">*</span></label><input id="category-name" name="name" required maxlength="100" value="${esc(existing?.name || "")}" placeholder="เช่น ระบบปรับอากาศ" autofocus></div><div class="field"><span class="field-label">ไอคอน <span class="required">*</span></span><div class="icon-picker">${Object.entries(glyphs).map(([key, label]) => `<label title="${label}"><input type="radio" name="icon" value="${key}" aria-label="${label}" ${key === (existing?.icon || "wrench") ? "checked" : ""}>${icon(key)}</label>`).join("")}</div></div><div class="field"><label for="category-priority">ความเร่งด่วนตั้งต้น <span class="required">*</span></label><select id="category-priority" name="priority">${priorityOptions(existing?.priority || "medium")}</select><p class="field-hint">ใช้เมื่อผู้แจ้งเลือกแค่ “อาการอื่น ๆ”</p></div></div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">${existing ? "บันทึก" : "เพิ่มหมวดงาน"}</button></div></form>`, "", (modal) => { $("#category-form", modal).onsubmit = (event) => { event.preventDefault(); const data = new FormData(event.target), name = data.get("name").trim(); if (!name) return showError("กรุณากรอกชื่อหมวดงาน"); if (categories.some((category) => category.id !== existing?.id && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError("ชื่อนี้มีอยู่แล้ว"); const fields = { name, icon: data.get("icon"), priority: data.get("priority") }; if (existing) Object.assign(existing, fields); else { const id = uid(); categories.push({ id, ...fields, active: true, symptoms: [] }); state.category = id; } state.preview = "normal"; closeModal(); render(); toast(existing ? "บันทึกหมวดงานแล้ว" : "เพิ่มหมวดงานแล้ว"); }; });
}

function symptomDialog(existing) {
  const category = selectedCategory();
  openModal(existing ? "แก้ไขอาการ" : "เพิ่มอาการ", category.name, `<form id="symptom-form"><div class="modal-body"><p id="form-error" class="form-error" role="alert" hidden></p><div class="field"><label for="symptom-name">ชื่ออาการ <span class="required">*</span></label><input id="symptom-name" name="name" required maxlength="100" value="${esc(existing?.name || "")}" placeholder="เช่น แอร์ไม่เย็น" autofocus></div><div class="field"><label for="symptom-priority">ความเร่งด่วน <span class="required">*</span></label><select id="symptom-priority" name="priority">${priorityOptions(existing?.priority || category.priority)}</select><p class="field-hint">งานจะได้ระดับสูงสุดของอาการที่เลือก · ใช้กับการแจ้งงานใหม่</p></div></div><div class="modal-footer">${action("ยกเลิก", "close-modal")}<button type="submit" class="button primary">${existing ? "บันทึก" : "เพิ่มอาการ"}</button></div></form>`, "", (modal) => { $("#symptom-form", modal).onsubmit = (event) => { event.preventDefault(); const data = new FormData(event.target), name = data.get("name").trim(); if (!name) return showError("กรุณากรอกชื่ออาการ"); if (category.symptoms.some((symptom) => symptom.id !== existing?.id && symptom.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError("ชื่อนี้มีอยู่แล้วในหมวดนี้"); if (existing) { existing.name = name; existing.priority = data.get("priority"); } else category.symptoms.push({ id: uid(), name, priority: data.get("priority"), active: true }); closeModal(); render(); toast(existing ? "บันทึกอาการแล้ว" : "เพิ่มอาการแล้ว"); }; });
}

function menu(title, items) {
  openModal(title, "", `<div class="modal-body action-list">${items.map((item, index) => `<button id="menu-action-${index}" class="${item.danger ? "destructive" : ""}">${icon(item.icon || "edit")}${item.label}</button>`).join("")}</div>`, "", (modal) => items.forEach((item, index) => { $(`#menu-action-${index}`, modal).onclick = () => { closeModal(); item.run(); }; }));
}

function activationDialog(item, label, extra = "") {
  if (!item.active) { item.active = true; render(); toast(`เปิดใช้งาน “${item.name}” แล้ว`); return; }
  confirm(`ปิดใช้งาน “${esc(item.name)}”?`, `<p class="small muted" style="line-height:1.9">${label}นี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง${extra ? `<br><br>${extra}` : ""}</p>`, () => { item.active = false; if (categories.includes(item) && !state.showInactiveCategories) { const first = categories.find((category) => category.active); if (first) state.category = first.id; else state.showInactiveCategories = true; } render(); toast(`ปิดใช้งาน “${item.name}” แล้ว`); }, "ปิดใช้งาน", true);
}

function savePermissions() {
  const pending = changes();
  const summary = roles.map((role) => { const items = pending.filter((key) => key.startsWith(`${role.id}:`)); if (!items.length) return ""; const labelFor = (key) => permissionGroups.flatMap((group) => group.actions).find((permission) => permission.id === key.slice(key.indexOf(":") + 1)).label; const added = items.filter((key) => matrix[key]).map(labelFor), removed = items.filter((key) => !matrix[key]).map(labelFor); return `<div class="change-summary"><strong>${esc(role.name)}</strong> <span class="muted">· ผู้ใช้ ${roleCount(role.id)} คน</span>${added.length ? `<p class="added">เพิ่ม: ${added.join(" · ")}</p>` : ""}${removed.length ? `<p class="removed">ถอด: ${removed.join(" · ")}</p>` : ""}</div>`; }).join("");
  confirm("บันทึกการเปลี่ยนสิทธิ์?", summary + '<p class="field-hint" style="margin-top:14px">มีผลในการใช้งานครั้งถัดไป โดยไม่ต้องออกจากระบบ</p>', () => { savedMatrix = { ...matrix }; render(); toast("บันทึกสิทธิ์แล้ว"); }, "บันทึกสิทธิ์");
}

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (link && titles[link.hash.slice(1)]) { event.preventDefault(); navigate(link.hash.slice(1)); return; }
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const id = target.dataset.id;
  const handlers = {
    "open-nav": openNav, "close-nav": closeNav, "close-modal": closeModal,
    "go-places": () => { state.preview = "normal"; navigate("places"); if (state.page === "places") render(); },
    retry: () => { state.preview = "normal"; render(); },
    "clear-users": () => { state.userQuery = ""; state.roleFilter = ""; state.userPage = 1; render(); },
    "user-page": () => { state.userPage = Number(target.dataset.page); render(); },
    "user-detail": () => userDetail(users.find((user) => user.id === id)),
    "change-user-role": () => userRoleDialog(users.find((user) => user.id === id)),
    "role-tab": () => { state.roleTab = target.dataset.tab; render(); },
    "add-role": () => roleDialog(),
    "reset-permissions": () => { matrix = { ...savedMatrix }; render(); toast("ยกเลิกการเปลี่ยนแปลงแล้ว"); },
    "save-permissions": savePermissions,
    "role-users": () => { state.roleFilter = id; state.userPage = 1; navigate("users"); },
    "role-menu": () => { const role = roles.find((item) => item.id === id); menu(role.name, [ { label: "แก้ไข Role", run: () => roleDialog(role) }, ...(!role.system ? [{ label: "ลบ Role", icon: "trash", danger: true, run: () => { if (roleCount(id)) { openModal("ลบ Role นี้ไม่ได้", "", `<div class="modal-body"><p class="small">มีผู้ใช้ ${roleCount(id)} คนใน Role นี้ ย้ายไป Role อื่นก่อน</p></div>`, action("ปิด", "close-modal") + action("ดูผู้ใช้", "role-users", `data-id="${id}"`, "primary")); } else confirm(`ลบ Role “${esc(role.name)}”?`, '<p class="small muted">ลบถาวร กู้คืนไม่ได้</p>', () => { const keys = Object.keys(matrix).filter((key) => key.startsWith(`${id}:`)); keys.forEach((key) => { delete matrix[key]; delete savedMatrix[key]; }); roles.splice(roles.indexOf(role), 1); if (state.mobileRole === id) state.mobileRole = "technician"; render(); toast("ลบ Role แล้ว"); }, "ลบ Role", true); } }] : []) ]); },
    "select-floor": () => { state.floor = id; state.room = selectedFloor().rooms[0].id; state.assetQuery = ""; state.assetFilter = ""; render(); },
    "select-room": () => { state.room = id; state.assetQuery = ""; state.assetFilter = ""; render(); },
    "clear-assets": () => { state.assetQuery = ""; state.assetFilter = ""; render(); },
    "add-asset": () => assetDialog(),
    "place-tab": () => { state.placeTab = target.dataset.tab; render(); },
    "add-asset-type": () => assetTypeDialog(),
    "edit-asset-type": () => assetTypeDialog(assetTypes.find((type) => type.id === id)),
    "rename-building": () => renameLocation("building"),
    "rename-room": () => renameLocation("room"),
    "toggle-inline-type": () => { const editor = $("#inline-type-editor"); editor.hidden = !editor.hidden; target.setAttribute("aria-expanded", String(!editor.hidden)); if (!editor.hidden) $("#inline-type-name").focus(); },
    "cancel-inline-type": () => { $("#inline-type-editor").hidden = true; $('[data-action="toggle-inline-type"]').setAttribute("aria-expanded", "false"); $('[data-action="toggle-inline-type"]').focus(); },
    "save-inline-type": addInlineAssetType,
    "asset-menu": () => { const asset = assets.find((item) => item.id === id); menu(asset.name, [ { label: "แก้ไข / ย้ายห้อง", run: () => assetDialog(asset) }, { label: asset.active ? "ปิดใช้งาน" : "เปิดใช้งาน", icon: asset.active ? "lock" : "refresh", danger: asset.active, run: () => activationDialog(asset, "อุปกรณ์") } ]); },
    "select-category": () => { state.category = id; render(); },
    "add-category": () => categoryDialog(),
    "add-symptom": () => symptomDialog(),
    "category-menu": () => { const category = selectedCategory(); menu(category.name, [ { label: "แก้ไขหมวดงาน", run: () => categoryDialog(category) }, { label: category.active ? "ปิดใช้งาน" : "เปิดใช้งาน", icon: category.active ? "lock" : "refresh", danger: category.active, run: () => activationDialog(category, "หมวดงาน", "อาการทั้งหมดในหมวดนี้จะไม่แสดงในแบบฟอร์มด้วย") } ]); },
    "symptom-menu": () => { const category = selectedCategory(), symptom = category.symptoms.find((item) => item.id === id); menu(symptom.name, [ { label: "แก้ไขอาการและความเร่งด่วน", run: () => symptomDialog(symptom) }, { label: symptom.active ? "ปิดใช้งาน" : "เปิดใช้งาน", icon: symptom.active ? "lock" : "refresh", danger: symptom.active, run: () => activationDialog(symptom, "อาการ", category.symptoms.filter((item) => item.active).length === 1 ? "นี่คืออาการสุดท้ายที่เปิดใช้งาน หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม" : "") } ]); },
  };
  handlers[target.dataset.action]?.();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-permission]")) {
    const key = target.dataset.permission, split = key.indexOf(":"), roleId = key.slice(0, split), permissionId = key.slice(split + 1);
    if (state.viewer !== "super_admin" || roleId === "super_admin" || permissionGroups.find((group) => group.actions.some((item) => item.id === permissionId)).fixed) return;
    matrix[key] = target.checked;
    const active = target.className.includes("switch") ? ".switch" : ".permission-check";
    render();
    [...document.querySelectorAll(`${active}[data-permission]`)].find((node) => node.dataset.permission === key)?.focus();
  }
  if (target.id === "viewer") {
    const next = target.value;
    target.value = state.viewer;
    guardedNavigate(() => { state.viewer = next; if (!canAccess(state.page)) state.page = "places"; state.preview = "normal"; history.replaceState(null, "", `?viewer=${next}#${state.page}`); closeNav(); render(); });
  }
  if (target.id === "preview-state") { state.preview = target.value; render(); }
  if (target.id === "user-role-filter") { state.roleFilter = target.value; state.userPage = 1; render(); }
  if (target.id === "mobile-role") { state.mobileRole = target.value; render(); }
  if (target.id === "building-select") { state.building = target.value; state.floor = selectedBuilding().floors[0].id; state.room = selectedFloor().rooms[0].id; state.assetQuery = ""; state.assetFilter = ""; render(); }
  if (target.id === "asset-type-filter") { state.assetFilter = target.value; render(); }
  if (target.id === "inactive-assets") { state.showInactiveAssets = target.checked; render(); }
  if (target.id === "inactive-categories") { state.showInactiveCategories = target.checked; if (!state.showInactiveCategories && !selectedCategory().active) { const first = categories.find((category) => category.active); if (first) state.category = first.id; else state.showInactiveCategories = true; } render(); }
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (!["user-search", "asset-search"].includes(target.id)) return;
  const position = target.selectionStart;
  if (target.id === "user-search") { state.userQuery = target.value; state.userPage = 1; } else state.assetQuery = target.value;
  render();
  const next = document.getElementById(target.id); next.focus(); next.setSelectionRange(position, position);
});
$("#nav-overlay").addEventListener("click", closeNav);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.id === "inline-type-name") { event.preventDefault(); addInlineAssetType(); return; }
  if (event.key === "Escape" && !$("#modal").open) { closeNav(); $('[data-action="open-nav"]')?.focus(); }
  if (event.key === "Tab" && document.body.classList.contains("nav-open")) {
    const focusable = [...$("#sidebar").querySelectorAll("a,button,summary,select")].filter((node) => node.getClientRects().length), first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.addEventListener("hashchange", () => { const next = location.hash.slice(1); if (titles[next] && next !== state.page) { const current = state.page; history.replaceState(null, "", `#${current}`); navigate(next); } });
window.addEventListener("beforeunload", (event) => { if (changes().length) { event.preventDefault(); event.returnValue = ""; } });
window.matchMedia("(max-width:1023px)").addEventListener("change", () => { closeNav(); });
render();
