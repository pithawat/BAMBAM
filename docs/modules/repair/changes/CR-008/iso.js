// Mockup helper: isometric drawing on SVG (used by the form floor picker and the dashboard). Mockup only.
const ISO = (() => {
  const C = Math.cos(Math.PI / 6), S = 0.5;
  function make(U) {
    const P = (x, y, z) => [(x - y) * C * U, (x + y) * S * U - z * U];
    const pts = (arr) => arr.map((p) => P(...p).map((n) => n.toFixed(1)).join(",")).join(" ");
    const poly = (arr, fill, attrs = "") => `<polygon points="${pts(arr)}" fill="${fill}" stroke="#98A2B3" stroke-width=".6" stroke-linejoin="round" ${attrs}/>`;
    const flat = (r, z, fill, attrs = "") => poly([[r.x, r.y, z], [r.x + r.w, r.y, z], [r.x + r.w, r.y + r.d, z], [r.x, r.y + r.d, z]], fill, attrs);
    const box = (r, z, h, [top, left, right], attrs = "") => {
      const { x, y, w, d } = r, t = z + h;
      return flat(r, t, top, `class="top" ${attrs}`)
        + poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, t], [x + w, y, t]], right, attrs)
        + poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, t], [x, y + d, t]], left, attrs);
    };
    const text = ([sx, sy], label, size = 12, fill = "#344054", weight = 600) =>
      `<text x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="Anuphan" pointer-events="none">${label}</text>`;
    const pin = ([sx, sy], label, fill, ink = "#fff") => {
      const w = Math.max(20, label.length * 7.2 + 10);
      return `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})" pointer-events="none"><rect x="${-w / 2}" y="-21" width="${w}" height="18" rx="9" fill="${fill}" stroke="#fff" stroke-width="1.5"/><text x="0" y="-8.5" text-anchor="middle" font-size="11" font-weight="700" fill="${ink}" font-family="Anuphan">${label}</text></g>`;
    };
    return { P, poly, flat, box, text, pin };
  }
  /** Rotate an axis-aligned rect by k × 90° around (cx, cy); returns the new axis-aligned rect. */
  function rot(r, cx, cy, k) {
    const turns = ((k % 4) + 4) % 4;
    const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map(([x, y]) => {
      let dx = x - cx, dy = y - cy;
      for (let i = 0; i < turns; i++) [dx, dy] = [-dy, dx];
      return [cx + dx, cy + dy];
    });
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    return { ...r, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
  }
  /** Fit the SVG viewBox to its drawing. */
  function fit(svg, pad = 10) {
    const bb = svg.getBBox();
    svg.setAttribute("viewBox", `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
  }
  return { make, rot, fit };
})();

// Sample buildings shared by the mockups (names from the user, 2026-10-16; floor counts still to confirm).
const SAMPLE_BUILDINGS = [
  { id: "office", letter: "O", name: "อาคารฝั่ง Office", short: "ฝั่ง Office", floors: 7, rooms: { 3: ["3A"], 5: ["5A", "5B"], 7: ["7 ใหญ่"] } },
  { id: "bangson", letter: "B", name: "อาคาร Office โรงงานบางซ่อน", short: "โรงงานบางซ่อน", floors: 2, rooms: { 2: ["B2"] } },
];

/** Rough floor plan, relative 0..1 coordinates: [x, y, w, d, name, kind]. Replaced by real plans later. */
function roughPlan(buildingId, floor) {
  const rooms = (SAMPLE_BUILDINGS.find((b) => b.id === buildingId).rooms[floor] || []);
  const plan = [];
  if (buildingId === "office") {
    plan.push([0, 0.42, 1, 0.16, "ทางเดิน", "corridor"]);
    plan.push([0, 0, 0.42, 0.42, floor === 1 ? "ล็อบบี้" : "สำนักงาน", floor === 1 ? "lobby" : "office"]);
    plan.push([0.42, 0, 0.16, 0.42, "ลิฟต์", "core"]);
    plan.push([0.58, 0, 0.2, 0.42, "ห้องน้ำ", "wc"]);
    plan.push([0.78, 0, 0.22, 0.42, floor === 1 ? "ห้องรปภ." : "แพนทรี", "pantry"]);
    let x = 0;
    rooms.forEach((r) => { plan.push([x, 0.58, 0.22, 0.42, "ห้องประชุม " + r, "meeting"]); x += 0.22; });
    plan.push([x, 0.58, 1 - x, 0.42, floor === 1 ? "ห้องอาหาร" : "พื้นที่ทำงาน", "office"]);
  } else {
    plan.push([0, 0.45, 1, 0.15, "ทางเดิน", "corridor"]);
    plan.push([0, 0, 0.12, 0.45, "บันได", "core"]);
    plan.push([0.12, 0, 0.58, 0.45, floor === 1 ? "สำนักงานฝ่ายผลิต" : "สำนักงาน", "office"]);
    plan.push([0.7, 0, 0.3, 0.45, "ห้องน้ำ", "wc"]);
    let x = 0;
    rooms.forEach((r) => { plan.push([x, 0.6, 0.2, 0.4, "ห้องประชุม " + r, "meeting"]); x += 0.2; });
    plan.push([x, 0.6, 0.6 - x, 0.4, "ห้องเก็บของ", "store"]);
    plan.push([0.6, 0.6, 0.4, 0.4, floor === 1 ? "ห้องควบคุม" : "พื้นที่ทำงาน", "office"]);
  }
  return plan;
}
const PLAN_FILL = { office: "#FFFFFF", lobby: "#F8F9FC", corridor: "#F2F4F7", core: "#D0D5DD", wc: "#E0F2FE", pantry: "#FEF6E7", store: "#F2F4F7", meeting: "#EDE4FF", meetingBusy: "#E4E7EC" };
