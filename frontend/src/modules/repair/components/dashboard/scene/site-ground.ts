import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./kit";

// S29 site view ground (CR-033, re-traced from CR-032): per side the paved site, roads with kerbs (the main
// road with a dashed centre line), parking stall rows with parked cars, landscape, trees and the small
// structures that are not site blocks (store, food courts, shops). Decorative only: no business data.
//
// - ฝั่งสำนักงานใหญ่ from the site plan `attachments/building plan/5-อาคารTrialmix และ ห้องทดสอบหินทราย.pdf` p.4
//   (MAR 2025, A3 1:750), in pixels of that page rendered at 200 dpi and turned north up (2339 × 1653);
//   site metres = 0.1625 · R(−8.13°) · (px − อาคาร 1 at (1144, 499.9)) — the fit of migration 20261101000001.
// - ฝั่ง Riverside from OpenStreetMap (© OpenStreetMap contributors, ODbL — openstreetmap.org/copyright): the
//   CPAC landuse outline, roads, the parking lot and its aisles, already in site metres (fitted on the office
//   blocks 1–3, then shifted so OSM's Warehouse 1 lies on its block — same size and angle). Simplified to 1 m.
//
// Budget (D-130): everything flat is ONE unlit vertex-coloured mesh; cars, trees and the small structures are
// one mesh each (instanced where repeated) — four draw calls and a few thousand triangles per side, no
// textures, no shadows, nothing animated.

type Pt = readonly [number, number];
type Line = readonly Pt[];
/** A row of stalls along a → b; `side` 1 = right of a → b (seen from above, north up), −1 = left. */
type Row = { a: Pt; b: Pt; side: 1 | -1; deg: number };
type Shed = { at: Pt; w: number; d: number; deg: number; h: number };
type Ground = {
  property: Line;
  green: Line[];
  roads: { line: Line; w: number; main?: boolean }[];
  /** Parking aisles: a stall row on both sides. */
  aisles: Line[];
  lots: Line[];
  rows: Row[];
  trees: Pt[];
  sheds: Shed[];
};

export type SideCrossing = { at: Pt; to: 1 | 2; road: string };

const PLAN = { s: 0.1625, ox: 1144, oy: 499.9, c: Math.cos((-8.13 * Math.PI) / 180), n: Math.sin((-8.13 * Math.PI) / 180) };
/** Plan page px → site metres (office side). */
const plan = ([px, py]: Pt): Pt => {
  const dx = px - PLAN.ox, dy = py - PLAN.oy;
  return [PLAN.s * (PLAN.c * dx - PLAN.n * dy), PLAN.s * (PLAN.n * dx + PLAN.c * dy)];
};
const planLine = (l: Line): Line => l.map(plan);
/** A plan angle (degrees, px space) as a site rotation. */
const planDeg = (deg: number) => deg - 8.13;

const OFFICE: Ground = {
  property: planLine([[540, 595], [577, 500], [1000, 318], [1280, 432], [1382, 215], [1897, 420], [1752, 1055], [1340, 960], [1050, 842]]),
  green: [
    // landscape strips along Phiboonsongkram Road and between อาคาร 1 and the food courts
    planLine([[560, 600], [1050, 842], [1060, 822], [575, 585]]),
    planLine([[1000, 650], [1200, 705], [1205, 690], [1005, 636]]),
  ],
  roads: [
    // Phiboonsongkram Road (to Nonthaburi) curving south at the junction, and the branch along the shops
    { line: planLine([[60, 578], [400, 660], [650, 728], [830, 790], [925, 860], [975, 960], [992, 1100], [985, 1300]]), w: 20, main: true },
    { line: planLine([[930, 865], [1080, 962], [1230, 1088], [1420, 1190], [1560, 1260]]), w: 10 },
  ],
  aisles: [],
  lots: [],
  rows: [
    // the five islands of the main car park (stalls on their south side)
    { a: plan([1405, 382]), b: plan([1655, 435]), side: 1, deg: 60 },
    { a: plan([1365, 452]), b: plan([1580, 512]), side: 1, deg: 60 },
    { a: plan([1330, 540]), b: plan([1560, 603]), side: 1, deg: 60 },
    { a: plan([1282, 622]), b: plan([1540, 685]), side: 1, deg: 60 },
    { a: plan([1262, 715]), b: plan([1530, 770]), side: 1, deg: 60 },
    // double row west of อาคาร 4, the column east of อาคาร 1, the row above the tree strip
    { a: plan([1676, 605]), b: plan([1612, 830]), side: 1, deg: 60 },
    { a: plan([1676, 605]), b: plan([1612, 830]), side: -1, deg: 60 },
    { a: plan([1258, 488]), b: plan([1278, 612]), side: -1, deg: 90 },
    { a: plan([1005, 640]), b: plan([1195, 690]), side: -1, deg: 90 },
    // around อาคาร 2 and along the west fence
    { a: plan([790, 478]), b: plan([905, 530]), side: -1, deg: 60 },
    { a: plan([700, 465]), b: plan([655, 600]), side: 1, deg: 60 },
    { a: plan([925, 540]), b: plan([905, 625]), side: 1, deg: 60 },
    { a: plan([885, 612]), b: plan([860, 725]), side: 1, deg: 60 },
    { a: plan([580, 505]), b: plan([548, 590]), side: -1, deg: 90 },
  ],
  trees: [
    [800, 700], [822, 706], [845, 712], [868, 720], [972, 775], [995, 785], [1018, 795], [1040, 805], [1062, 812],
    [1030, 668], [1060, 676], [1090, 684], [1120, 692], [1150, 700], [1180, 707], [1065, 770], [1095, 778],
  ].map((p) => plan(p as unknown as Pt)),
  sheds: [
    { at: plan([918, 708]), w: 11, d: 5.5, deg: planDeg(107), h: 3.5 }, // guard house 1-SC-F
    { at: plan([1152, 795]), w: 17, d: 5.5, deg: planDeg(12), h: 3.5 }, // PAYTONG COURT
    { at: plan([1150, 830]), w: 17, d: 5.5, deg: planDeg(12), h: 3.5 },
    { at: plan([1292, 855]), w: 14, d: 11, deg: planDeg(12), h: 4 }, // STORE
    { at: plan([1185, 918]), w: 13, d: 7, deg: planDeg(37), h: 3.5 }, // shops outside the fence: food, book (3), Soonchai (4), S.Kitchen (3)
    { at: plan([1257, 958]), w: 13, d: 7, deg: planDeg(37), h: 10.5 },
    { at: plan([1325, 1015]), w: 13, d: 7, deg: planDeg(37), h: 14 },
    { at: plan([1392, 1068]), w: 13, d: 7, deg: planDeg(37), h: 10.5 },
    { at: plan([1797, 548]), w: 16, d: 15, deg: planDeg(12), h: 7 }, // building by the steel tower
  ],
};

const RIVERSIDE: Ground = {
  roads: [
    { line: [[-53.4, 178.1], [-73.9, 216.7], [-80.9, 234.5], [-86.3, 259.8], [-86.5, 274.2], [-83.3, 297.5], [-79.3, 309.9], [-68.5, 331.5]], w: 9, main: true },
    { line: [[-15.9, 132.2], [-24.3, 130.4], [-49.4, 129.5]], w: 6, main: true },
    { line: [[-35.2, 115.6], [-18.7, 117.6]], w: 6, main: true },
    { line: [[-56.4, 75], [-36, 84.1], [-13.1, 99.5]], w: 6, main: true },
    { line: [[-105.5, -68.4], [-38.2, -41.6], [3.6, -27.8]], w: 5 },
    { line: [[-38.2, -41.6], [-43.9, -31.6], [-59.4, -22.3], [-65.2, -12.6]], w: 5 },
    { line: [[-1.9, 45.3], [-38.8, 33.6], [-53.2, 33.2], [-85.7, 23]], w: 5 },
    { line: [[-6.9, 8.2], [-65.2, -12.6]], w: 5 },
    { line: [[-220.9, 228.9], [-202.2, 180.4], [-269.7, 154.2], [-299.2, 138.9], [-305.4, 138.5], [-309.7, 139.7], [-312.7, 142.6], [-354.2, 212.1], [-361.4, 228.4], [-361.4, 234.3], [-351.9, 247.9], [-340.8, 255.1], [-333.4, 257.3], [-322.6, 257.6]], w: 5 },
    { line: [[-269.7, 154.2], [-266.7, 148.6], [-235.4, 133.8], [-119.1, 66.3]], w: 5 },
    { line: [[-308.4, 4.7], [-423.6, -34.2]], w: 9, main: true },
    { line: [[-32.3, -0.8], [-7.6, -70.4]], w: 5 },
    { line: [[-274.3, 16], [-308.4, 4.7]], w: 9, main: true },
    { line: [[-54, 94.2], [-65.9, 85], [-83.8, 77.5], [-274.3, 16]], w: 9, main: true },
    { line: [[-263.2, 6.3], [-177.2, 33.6]], w: 9, main: true },
    { line: [[-297.7, -4.9], [-263.2, 6.3]], w: 9, main: true },
    { line: [[-235.8, 167.7], [-298.2, 278.9], [-303.3, 284.8], [-308.8, 289], [-318.7, 293.3], [-339, 296.2], [-354.6, 292.8], [-382.8, 282.8]], w: 5 },
    { line: [[-265.4, 155.9], [-319.5, 255.2], [-322.6, 257.6]], w: 5 },
    { line: [[-439.9, 222.8], [-417.8, 241.4]], w: 5 },
    { line: [[-406.8, 180.3], [-382.5, 199.4]], w: 5 },
    { line: [[-332.1, 86.4], [-347.6, 76.7], [-357.4, 77.3], [-400, 104.3]], w: 5 },
    { line: [[-285.9, 30.7], [-430.9, 210.4]], w: 5 },
    { line: [[-420.6, -15.4], [-419.7, -9.7], [-421.6, -3.6]], w: 5 },
    { line: [[-420.6, -15.4], [-417.2, -14.9], [-405.9, -28.6]], w: 5 },
    { line: [[-189.9, 42.4], [-200.3, 54.3], [-204.9, 55.3], [-272.4, 29.1], [-277.9, 28], [-285.9, 30.7]], w: 5 },
    { line: [[-282, 125.4], [-266.7, 148.6]], w: 5 },
    { line: [[-119.1, 249.6], [-121.1, 259.6], [-131.2, 276.1], [-174.9, 309.7], [-204.4, 325.3], [-210.2, 326], [-219.1, 323.2], [-255.1, 301.2], [-298.2, 278.9]], w: 5 },
    { line: [[-142.8, 149.6], [-118.7, 136.6], [-103.6, 133.3], [-91.9, 134.7], [-81.2, 138.5], [-77.2, 142.6], [-77.1, 147.1], [-113.3, 225.3], [-119.1, 249.6]], w: 5 },
    { line: [[-85.7, 23], [-91.5, 27.4], [-94.3, 34.5]], w: 5 },
    { line: [[-94.3, 34.5], [-95.5, 43.2], [-91.7, 47.3], [-72, 53.7], [-66.1, 52.7], [-64.6, 50.5]], w: 5 },
    { line: [[-58.9, 30.8], [-64.6, 50.5]], w: 5 },
    { line: [[-41.9, 60.8], [-48.4, 78.6]], w: 5 },
    { line: [[-98.6, 253], [-119.1, 249.6]], w: 5 },
    { line: [[-88.3, 322.7], [-136, 363.8]], w: 6 },
    { line: [[-202.2, 180.4], [-175.7, 186.7], [-168.6, 189.5], [-165.9, 193.2], [-163.8, 197.8], [-164.2, 203.5], [-171.9, 221.6], [-176.3, 226.9], [-184.5, 232.9], [-196, 235.8], [-204.7, 235.2], [-220.9, 228.9], [-233.2, 226.8], [-254.3, 230.6], [-260, 233.1], [-263.6, 236.8], [-277.2, 264.1]], w: 5 },
    { line: [[-218.2, 174.3], [-240.8, 227.6]], w: 5 },
    { line: [[-131.1, 73.2], [-111.6, 78.6], [-101.8, 83.5], [-97.7, 87.4], [-92, 98.8], [-91.8, 105.2], [-94.7, 114.5]], w: 5 },
    { line: [[-235.4, 133.8], [-219.4, 165], [-218.2, 174.3]], w: 5 },
    { line: [[-297.6, 45.1], [-252.2, 79.9]], w: 5 },
    { line: [[-19.1, 148.2], [-33.8, 154.6], [-53.4, 178.1]], w: 6, main: true },
    { line: [[-420.6, -44.6], [-297.7, -4.9]], w: 9, main: true },
    { line: [[-133.4, 48.7], [-56.4, 75]], w: 9, main: true },
    { line: [[-177.2, 33.6], [-133.4, 48.7]], w: 9, main: true },
    { line: [[-102, 18.1], [-204.9, -22.7]], w: 5 },
    { line: [[-128.3, 36.2], [-204.4, 6.8], [-206.4, 4.7], [-208.6, -3.6], [-219.8, -8.4]], w: 5 },
    { line: [[-11.9, 62], [-41.9, 60.8], [-44.2, 58.8], [-44.4, 50.8], [-38.8, 33.6]], w: 5 },
    { line: [[-184.6, 185.1], [-204.7, 235.2]], w: 5 },
    { line: [[-119.1, 249.6], [-171.9, 221.6]], w: 5 },
    { line: [[-445.5, 147.8], [-406.8, 180.3]], w: 5 },
    { line: [[-77.5, 341], [-88.3, 322.7], [-94.3, 307.7], [-99.5, 271], [-98.6, 253], [-93.3, 229.9], [-70.2, 178.3]], w: 9, main: true },
    { line: [[-56.4, 75], [-42.1, 88.1], [-38, 95.9], [-35.2, 115.6]], w: 9, main: true },
    { line: [[-47.8, 115.3], [-49, 104.4], [-54, 94.2]], w: 9, main: true },
    { line: [[-65.2, -12.6], [-73.2, 1.1], [-124.7, 30.2], [-133.4, 48.7]], w: 5 },
    { line: [[-49.4, 129.5], [-47.8, 115.3]], w: 9, main: true },
    { line: [[-35.2, 115.6], [-38, 139.6], [-53.4, 178.1]], w: 9, main: true },
    { line: [[-70.2, 178.3], [-53.3, 144.7], [-49.4, 129.5]], w: 9, main: true },
    { line: [[-47.8, 115.3], [-35.2, 115.6]], w: 6, main: true },
    { line: [[-380.5, -32], [-378, -37.7], [-332.4, -69.5]], w: 6 },
    { line: [[-326.7, -28.5], [-335.3, -30.2], [-338.5, -35.5], [-337.6, -41.7], [-330.7, -46.5], [-324, -45], [-320.4, -40.1], [-321.9, -31.8], [-326.7, -28.5]], w: 5 },
    { line: [[-326.7, -28.5], [-318.5, -22.9], [-291.2, -14]], w: 5 },
    { line: [[-338.6, -38.7], [-347.7, -32.3], [-352.4, -22.8]], w: 5 },
    { line: [[-332.4, -69.5], [-313, -41.4], [-300.2, -36.8]], w: 5 },
    { line: [[-324.1, -56.9], [-326, -51.1], [-330.7, -46.5]], w: 5 },
    { line: [[-313, -41.4], [-319, -39.8], [-320, -37.2]], w: 5 },
    { line: [[-388.1, -22.5], [-394.7, -13.8], [-421.8, 12.8]], w: 6 },
    { line: [[-392.4, 334.9], [-380.7, 304.7], [-375.5, 297.9], [-363.3, 289.7]], w: 5 },
  ],
  // parking lot by the main road and its aisles
  aisles: [[[-123.9, 190.9], [-136.5, 223.2], [-132.7, 226.8], [-126.5, 228.9], [-123.4, 226.7], [-111.6, 195.7]], [[-103.6, 133.3], [-123.9, 190.9], [-102.4, 199.4]], [[-36.8, 333], [-24.9, 318], [-19.1, 314.1]], [[-30.3, 324.8], [-1.1, 344.8]]],
  lots: [[[-142.2, 230.3], [-98.1, 128.8], [-70.6, 140.6], [-114.7, 242.1]]],
  // CPAC landuse outline
  property: [[-367.4, 305.9], [-377.9, 307.1], [-381.1, 312], [-376.5, 314.3], [-385.4, 341.1], [-399.5, 336.3], [-390.2, 309.3], [-385.4, 311.1], [-383.4, 306.2], [-385.7, 305], [-384.4, 302.8], [-403.4, 293.8], [-310, 136.6], [-296.9, 123], [-171.7, 59.1], [-112.1, 76.6], [-127.6, 80.1], [-222.2, 132.3], [-205.6, 169.7], [-149.1, 151.2], [-103.8, 124.8], [-80.3, 114.2], [-93.5, 85.6], [-72, 92], [-63.6, 95.7], [-57.8, 102.9], [-53.8, 111.1], [-53.9, 120.5], [-56.7, 133.5], [-61.6, 145.4], [-104.3, 232.1], [-108.5, 259.7], [-106.6, 297.3], [-102.4, 307.4], [-171.2, 372.6], [-215.9, 368.7], [-236.3, 363.4], [-238.5, 368.9], [-257.8, 362.6], [-255.1, 356.3], [-266.5, 350.1], [-283.3, 337.3], [-307, 326.1]],
  // the landscape around Riverside 1–3 / อเนกประสงค์ (a hole in the OSM outline)
  green: [[[-112.1, 76.6], [-127.6, 80.1], [-222.2, 132.3], [-205.6, 169.7], [-149.1, 151.2], [-103.8, 124.8], [-80.3, 114.2], [-93.5, 85.6]]],
  rows: [],
  trees: [],
  sheds: [],
};

const GROUNDS: Record<1 | 2, Ground> = { 1: OFFICE, 2: RIVERSIDE };

/** The in-map button of each side (CR-033): a point on Phiboonsongkram Road at the side's edge. */
export const SIDE_CROSSING: Record<1 | 2, SideCrossing> = {
  1: { at: plan([760, 770]), to: 2, road: "ถนนพิบูลสงคราม" },
  2: { at: [-160, 46], to: 1, road: "ถนนพิบูลสงคราม" },
};

const C = { pave: 0xb4b8ba, green: 0xc4d4ad, kerb: 0xd2d3cd, road: 0x7e848a, line: 0xf4f3ee, lot: 0x9da2a6 };
// heights keep the flat layers apart without z-fighting from far away
const Y = { pave: 0.03, green: 0.06, kerb: 0.08, road: 0.12, lot: 0.1, line: 0.18 };
const STALL = { w: 2.5, d: 5 };

const v3 = ([x, z]: Pt) => new THREE.Vector3(x, 0, z);

/** A flat strip of width w along a smoothed polyline (metres), at height y. */
function ribbon(pts: THREE.Vector3[], w: number, y: number) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const n = Math.max(2, Math.ceil(curve.getLength() / 4));
  const p = curve.getSpacedPoints(n);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = p[Math.min(i + 1, n)].clone().sub(p[Math.max(i - 1, 0)]).normalize();
    const nx = -t.z * (w / 2), nz = t.x * (w / 2);
    pos.push(p[i].x + nx, y, p[i].z + nz, p[i].x - nx, y, p[i].z - nz);
    if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return { geo: g, curve, len: curve.getLength() };
}

const quad = (w: number, d: number, x: number, z: number, y: number, rot = 0) =>
  new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).rotateY(rot).translate(x, y, z);

/** A flat polygon (site metres) at height y. */
const area = (pts: Line, y: number) =>
  new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))).rotateX(-Math.PI / 2).translate(0, y, 0);

function paint(g: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g.index ? g.toNonIndexed() : g;
}

type Spot = { p: THREE.Vector3; rot: number };

/** One stall row: a line per stall edge at `deg` to the row, the row's base line; returns the stall centres. */
function stallRow(a: THREE.Vector3, b: THREE.Vector3, side: 1 | -1, deg: number, lines: THREE.BufferGeometry[]) {
  const len = a.distanceTo(b), t = b.clone().sub(a).normalize();
  const nrm = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(side); // right of a → b with z pointing south
  const al = (deg * Math.PI) / 180, s = t.clone().multiplyScalar(Math.cos(al)).addScaledVector(nrm, Math.sin(al));
  const pitch = STALL.w / Math.sin(al), n = Math.floor((len - 1) / pitch), off = (len - n * pitch) / 2;
  const sRot = Math.atan2(s.x, s.z), spots: Spot[] = [];
  for (let i = 0; i <= n; i++) {
    const p = a.clone().addScaledVector(t, off + i * pitch).addScaledVector(s, STALL.d / 2);
    lines.push(quad(0.15, STALL.d, p.x, p.z, Y.line, sRot));
    if (i < n) spots.push({ p: p.clone().addScaledVector(t, pitch / 2), rot: Math.atan2(-s.z, s.x) });
  }
  const m = a.clone().add(b).multiplyScalar(0.5);
  lines.push(quad(0.15, len, m.x, m.z, Y.line, Math.atan2(t.x, t.z)));
  return spots;
}

/** Builds the ground of one side; `blocks` (oriented footprints) keep cars, trees and structures off the buildings. */
export function buildGround(side: 1 | 2, blocks: { x: number; z: number; rotDeg: number; width: number; depth: number }[]) {
  const G = GROUNDS[side];
  const free = (p: THREE.Vector3, pad: number) => blocks.every((b) => {
    const r = (b.rotDeg * Math.PI) / 180, dx = p.x - b.x, dz = p.z - b.z;
    const u = dx * Math.cos(r) + dz * Math.sin(r), v = -dx * Math.sin(r) + dz * Math.cos(r);
    return Math.abs(u) > b.width / 2 + pad || Math.abs(v) > b.depth / 2 + pad;
  });
  const flat: THREE.BufferGeometry[] = [paint(area(G.property, Y.pave), C.pave)];
  for (const g of G.green) flat.push(paint(area(g, Y.green), C.green));
  for (const l of G.lots) flat.push(paint(area(l, Y.lot), C.lot));

  for (const r of G.roads) {
    const pts = r.line.map(v3);
    flat.push(paint(ribbon(pts, r.w + 2.5, Y.kerb).geo, C.kerb));
    const { geo, curve, len } = ribbon(pts, r.w, Y.road);
    flat.push(paint(geo, C.road));
    if (!r.main) continue;
    for (let s = 3; s < len - 3; s += 8) { // dashed centre line
      const p = curve.getPointAt(s / len), t = curve.getTangentAt(s / len);
      flat.push(paint(quad(0.18, 3, p.x, p.z, Y.line, Math.atan2(t.x, t.z)), C.line));
    }
  }

  const lines: THREE.BufferGeometry[] = [];
  const spots: Spot[] = [];
  for (const r of G.rows) spots.push(...stallRow(v3(r.a), v3(r.b), r.side, r.deg, lines));
  for (const aisle of G.aisles) for (let i = 1; i < aisle.length; i++) {
    const a = v3(aisle[i - 1]), b = v3(aisle[i]);
    if (a.distanceTo(b) < 8) continue;
    // stalls start beside the 6 m aisle
    const t = b.clone().sub(a).normalize(), off = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(3);
    spots.push(...stallRow(a.clone().sub(off), b.clone().sub(off), -1, 90, lines), ...stallRow(a.clone().add(off), b.clone().add(off), 1, 90, lines));
  }
  for (const g of lines) flat.push(paint(g, C.line));

  const group = new THREE.Group();
  const g = mergeGeometries(flat);
  for (const f of flat) f.dispose();
  // all flat: unlit (cheapest, and no dark faces whatever the winding), still fogged like the rest
  group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  const rnd = rng(side * 7);
  const parked = spots.filter((s) => free(s.p, 1) && rnd() < 0.55);
  if (parked.length) group.add(cars(parked, rnd));
  const trees = [...G.trees.map(v3), ...edgeTrees(G, rnd)].filter((p) => free(p, 3));
  if (trees.length) group.add(treeMesh(trees, rnd));
  const sheds = G.sheds.filter((s) => free(v3(s.at), 0));
  if (sheds.length) group.add(shedMesh(sheds));
  return group;
}

/** Trees along the site boundary and on the landscape areas (Riverside, which the OSM data does not list). */
function edgeTrees(G: Ground, rnd: () => number) {
  if (G.trees.length) return [];
  const out: THREE.Vector3[] = [];
  const ring = [...G.property, G.property[0]].map(v3);
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], len = a.distanceTo(b), n = Math.floor(len / 14);
    for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, (k + 0.5) / n));
  }
  for (const g of G.green) {
    const box = new THREE.Box2().setFromPoints(g.map(([x, z]) => new THREE.Vector2(x, z)));
    for (let x = box.min.x + 6; x < box.max.x; x += 16) for (let z = box.min.y + 6; z < box.max.y; z += 16) {
      const p = new THREE.Vector2(x + (rnd() - 0.5) * 8, z + (rnd() - 0.5) * 8);
      if (inside(p, g)) out.push(new THREE.Vector3(p.x, 0, p.y));
    }
  }
  return out;
}

function inside(p: THREE.Vector2, poly: Line) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p.y) !== (zj > p.y) && p.x < ((xj - xi) * (p.y - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Parked cars: a body and a darker cabin, one instanced mesh with a colour per car. */
function cars(spots: Spot[], rnd: () => number) {
  const body = paint(new THREE.BoxGeometry(4.3, 0.75, 1.8).translate(0, 0.55, 0), 0xffffff);
  const cabin = paint(new THREE.BoxGeometry(2.3, 0.6, 1.6).translate(-0.2, 1.2, 0), 0x55595e);
  const geo = mergeGeometries([body, cabin]);
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
  const palette = [0xf2f2f0, 0xf2f2f0, 0xb8bcc0, 0x2d3136, 0x7a1f24, 0x2f4f7a, 0x9a9da0];
  const o = new THREE.Object3D(), col = new THREE.Color();
  spots.forEach(({ p, rot }, i) => {
    o.position.copy(p).setY(Y.lot);
    o.rotation.set(0, rot, 0);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    mesh.setColorAt(i, col.setHex(palette[Math.floor(rnd() * palette.length)]));
  });
  return mesh;
}

/** Low-poly trees: a trunk and a 20-face crown, one instanced mesh. */
function treeMesh(points: THREE.Vector3[], rnd: () => number) {
  const trunk = paint(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 5, 1, true).translate(0, 1.3, 0), 0x6b5843);
  const crown = paint(new THREE.IcosahedronGeometry(2.3, 0).translate(0, 4, 0), 0x6f9150);
  const geo = mergeGeometries([trunk, crown]);
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), points.length);
  const o = new THREE.Object3D();
  points.forEach((p, i) => {
    o.position.copy(p);
    o.rotation.set(0, rnd() * Math.PI, 0);
    o.scale.setScalar(0.8 + rnd() * 0.5);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  return mesh;
}

/** Small structures that are not site blocks: plain boxes with a roof slab, merged. */
function shedMesh(sheds: Shed[]) {
  const geos = sheds.flatMap((s) => {
    const m = new THREE.Matrix4().makeRotationY((-s.deg * Math.PI) / 180).setPosition(s.at[0], 0, s.at[1]);
    return [
      paint(new THREE.BoxGeometry(s.w, s.h, s.d).translate(0, s.h / 2, 0).applyMatrix4(m), 0xe6e3dc),
      paint(new THREE.BoxGeometry(s.w + 0.3, 0.3, s.d + 0.3).translate(0, s.h, 0).applyMatrix4(m), 0x9aa0a6),
    ];
  });
  const geo = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
