import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./kit";

// S29 site view ground (CR-032): roads with kerbs and a dashed centre line, walkways and parking lots with
// stall lines and parked cars, traced from `Cpac map.png` (pixels; 50 m = 96 px, origin = อาคาร 1 at
// px 830 / 171, like the site blocks — D-126). Lots and walkways are placed by Claude where the map
// shows open ground. Budget (D-130): everything flat is ONE vertex-coloured mesh, the cars ONE instanced
// mesh — two draw calls and a few thousand triangles per side, no textures, no shadows, nothing animated.

type Px = readonly (readonly [number, number])[];
type Lot = { at: readonly [number, number]; w: number; d: number; rotDeg: number };
type Ground = { roads: { line: Px; w: number }[]; paths: Px[]; lots: Lot[] };

const S = 50 / 96;
const toM = ([px, py]: readonly [number, number]) => new THREE.Vector3((px - 830) * S, 0, (py - 171) * S);

const GROUND: Ground = {
  roads: [
    // ฝั่งสำนักงานใหญ่: highway 306, the road under อาคาร 1–4, the loop by อาคาร 5, the spurs to อาคาร 1 / 2
    { line: [[600, 250], [700, 284], [770, 315], [830, 355]], w: 18 },
    { line: [[790, 232], [870, 240], [980, 252], [1025, 262]], w: 7 },
    { line: [[872, 240], [870, 180], [874, 135], [893, 108], [930, 100], [962, 108], [980, 128], [983, 190], [982, 252]], w: 6 },
    { line: [[782, 285], [786, 225], [800, 208], [850, 214], [871, 222]], w: 6 },
    { line: [[735, 282], [738, 228], [728, 197], [708, 186], [684, 192], [669, 215], [668, 270]], w: 6 },
    // ฝั่ง Riverside: along Warehouse 1 towards CCTC, past Riverside 1 to the car park (ที่จอดรถ CPAC)
    { line: [[600, 300], [530, 338], [470, 370], [415, 402], [360, 428]], w: 7 },
    { line: [[458, 330], [458, 430], [475, 470], [470, 520], [452, 575], [470, 610], [530, 617], [620, 600], [700, 575]], w: 7 },
  ],
  paths: [
    [[752, 178], [772, 190], [800, 196]],
    [[740, 205], [762, 201], [786, 205]],
    [[920, 268], [921, 252]],
    [[1022, 244], [1016, 258]],
    [[505, 452], [512, 424], [520, 398]],
    [[522, 372], [556, 384], [582, 404]],
    [[488, 437], [466, 440]],
  ],
  lots: [
    { at: [928, 176], w: 40, d: 32, rotDeg: 0 },
    { at: [997, 214], w: 22, d: 6, rotDeg: 90 },
    { at: [866, 283], w: 16, d: 16, rotDeg: 7 },
    { at: [680, 545], w: 100, d: 26, rotDeg: 90 },
    { at: [565, 445], w: 30, d: 16, rotDeg: -28 },
  ],
};

const C = { kerb: 0xcdcfca, road: 0x83898f, line: 0xf4f3ee, path: 0xd6cbb6, lot: 0x959ba0 };
// heights keep the flat layers apart without z-fighting from far away
const Y = { kerb: 0.05, path: 0.08, road: 0.12, lot: 0.12, line: 0.2 };

const STALL = { w: 2.5, d: 5, aisle: 6 };

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

function paint(g: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g.index ? g.toNonIndexed() : g;
}

/** One stall row: lines across, a back line; returns the stall centres (lot-local, x along the row). */
function stallRow(len: number, z: number, facing: 1 | -1, lines: THREE.BufferGeometry[], at: THREE.Matrix4) {
  const n = Math.floor(len / STALL.w), x0 = -(n * STALL.w) / 2, spots: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) lines.push(quad(0.15, STALL.d, x0 + i * STALL.w, z + (facing * STALL.d) / 2, Y.line).applyMatrix4(at));
  lines.push(quad(n * STALL.w, 0.15, 0, z + facing * STALL.d, Y.line).applyMatrix4(at));
  for (let i = 0; i < n; i++) spots.push(new THREE.Vector3(x0 + (i + 0.5) * STALL.w, 0, z + (facing * STALL.d) / 2).applyMatrix4(at));
  return spots;
}

/** Builds the ground of the side whose blocks lie inside `area` (the side's bounds). */
export function buildGround(area: THREE.Box3) {
  const near = area.clone().expandByScalar(60);
  const inside = (pts: THREE.Vector3[]) => pts.some((p) => near.containsPoint(p.clone().setY(area.min.y)));
  const flat: THREE.BufferGeometry[] = [];
  const spots: { p: THREE.Vector3; rot: number }[] = [];

  for (const r of GROUND.roads) {
    const pts = r.line.map(toM);
    if (!inside(pts)) continue;
    flat.push(paint(ribbon(pts, r.w + 3, Y.kerb).geo, C.kerb));
    const { geo, curve, len } = ribbon(pts, r.w, Y.road);
    flat.push(paint(geo, C.road));
    for (let s = 3; s < len - 3; s += 8) { // dashed centre line
      const p = curve.getPointAt(s / len), t = curve.getTangentAt(s / len);
      flat.push(paint(quad(0.18, 3, p.x, p.z, Y.line, Math.atan2(t.x, t.z)), C.line));
    }
  }
  for (const line of GROUND.paths) {
    const pts = line.map(toM);
    if (inside(pts)) flat.push(paint(ribbon(pts, 2.2, Y.path).geo, C.path));
  }
  const rnd = rng(7);
  for (const l of GROUND.lots) {
    const c = toM(l.at);
    if (!inside([c])) continue;
    const rot = (-l.rotDeg * Math.PI) / 180;
    const at = new THREE.Matrix4().makeRotationY(rot).setPosition(c.x, 0, c.z);
    flat.push(paint(quad(l.w + 2, l.d + 2, 0, 0, Y.kerb).applyMatrix4(at), C.kerb), paint(quad(l.w, l.d, 0, 0, Y.lot).applyMatrix4(at), C.lot));
    const lines: THREE.BufferGeometry[] = [];
    let rowSpots: THREE.Vector3[] = [];
    if (l.d < 2 * STALL.d + STALL.aisle) rowSpots = stallRow(l.w - 1, -l.d / 2, 1, lines, at);
    else {
      // double rows back to back, an aisle on each side of them
      const pairs = Math.max(1, Math.floor((l.d - STALL.aisle) / (2 * STALL.d + STALL.aisle)));
      const step = l.d / pairs;
      for (let k = 0; k < pairs; k++) {
        const z = -l.d / 2 + step * (k + 0.5);
        rowSpots.push(...stallRow(l.w - 2, z, -1, lines, at), ...stallRow(l.w - 2, z, 1, lines, at));
      }
    }
    for (const g of lines) flat.push(paint(g, C.line));
    for (const p of rowSpots) if (rnd() < 0.55) spots.push({ p, rot: rot + Math.PI / 2 });
  }

  const group = new THREE.Group();
  if (flat.length) {
    const g = mergeGeometries(flat);
    for (const f of flat) f.dispose();
    // all flat: unlit (cheapest, and no dark faces whatever the winding), still fogged like the rest
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  if (spots.length) group.add(cars(spots, rnd));
  return group;
}

/** Parked cars: a body and a darker cabin, one instanced mesh with a colour per car. */
function cars(spots: { p: THREE.Vector3; rot: number }[], rnd: () => number) {
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
