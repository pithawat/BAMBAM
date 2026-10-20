import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AreaType, FloorPlan, PlanRoom, PlanShape } from "../../../types";
import { shapeArea } from "../../../plan-geometry";
import { B1 } from "./building-one";
import { bg, leafClusters, merged, mesh, rng, worldUV, type Textures } from "./kit";

// Floor plan cutaway (owner's model `buildPlan`, section 5, D-082): floor slab + tiles, low walls cut at
// 1.2 m with door gaps, core, facade sill + glass, columns on the grid, CAD-like dimensions, desks and
// plants. Rooms come from #30 outlines (polygons) instead of the model's floor-1 zones.

export type PlanLabel = { pos: THREE.Vector3; kind: "room" | "core" | "dim" | "note"; text: string; sub?: string };

export type BuiltPlan = {
  group: THREE.Group;
  labels: PlanLabel[];
  /** Invisible fill per room (also common area / restroom) — shown while dragging equipment over it. */
  highlights: Map<string, THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>>;
  /** Floor outline, turned red when a drop is refused. */
  outline: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  width: number;
  depth: number;
};

/** Room tile tints by area type (S29 modern mockup; no purple, D-070). */
const TINT: Partial<Record<AreaType, number>> = { office: 0xdce3ff, meeting_room: 0xd9f0e4, pantry: 0xfde5d4, other: 0xfde5d4, parking: 0xe5e8ef };
const CUT = 1.2;

const areaText = (a: number) => (Number.isInteger(Math.round(a * 100) / 100) ? String(Math.round(a)) : a.toFixed(2));

function isRect(s: PlanShape) {
  if (s.length !== 4) return false;
  const xs = new Set(s.map((p) => p[0]));
  const zs = new Set(s.map((p) => p[1]));
  return xs.size === 2 && zs.size === 2;
}

function bbox(s: PlanShape) {
  const xs = s.map((p) => p[0]);
  const zs = s.map((p) => p[1]);
  const x = Math.min(...xs), z = Math.min(...zs);
  return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z };
}

export function buildFloorPlan(
  plan: FloorPlan,
  tex: Textures,
  center: (room: PlanRoom) => [number, number] | null,
  fallback: { width: number; depth: number },
): BuiltPlan {
  // a floor without a plan is drawn at the building footprint (#27)
  const W = plan.widthM ?? fallback.width;
  const D = plan.depthM ?? fallback.depth;
  const PX = (x: number) => x - W / 2;
  const PZ = (z: number) => z - D / 2;
  const group = new THREE.Group();
  const labels: PlanLabel[] = [];
  const highlights: BuiltPlan["highlights"] = new Map();
  const isGround = plan.floor.level === 1;

  const own = <T extends THREE.Texture>(t: T, rx: number, ry: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(rx, ry);
    c.userData.owned = true;
    return c;
  };

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.85, envMapIntensity: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.8 });
  const colMat = new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0xd9d8d2, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xa9d0e6, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3, depthWrite: false });

  group.add(mesh(worldUV(bg(W + 0.6, 0.35, D + 0.6, 0, -0.35, 0)), new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0xb5b8b8, roughness: 0.9 })));
  group.add(mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate(0, 0.005, 0),
    new THREE.MeshStandardMaterial({ map: own(tex.tile, W / 2.4, D / 2.4), roughness: 0.35, envMapIntensity: 0.6 }), false, true));

  const walls: THREE.BufferGeometry[] = [], caps: THREE.BufferGeometry[] = [];
  const seg = (x1: number, z1: number, x2: number, z2: number, h = CUT, t = 0.12) => {
    const horiz = Math.abs(z1 - z2) < 1e-6;
    const len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    if (len < 0.05) return;
    const cx = PX((x1 + x2) / 2), cz = PZ((z1 + z2) / 2);
    const w = horiz ? len : t, d = horiz ? t : len;
    walls.push(bg(w, h, d, cx, 0, cz));
    caps.push(bg(w + 0.01, 0.025, d + 0.01, cx, h, cz));
  };
  const onEdge = (x1: number, z1: number, x2: number, z2: number) =>
    (Math.abs(z1 - z2) < 1e-6 && (z1 < 0.05 || z1 > D - 0.05)) || (Math.abs(x1 - x2) < 1e-6 && (x1 < 0.05 || x1 > W - 0.05));
  const drawn = new Set<string>();
  const edgeWithDoor = (a: [number, number], b: [number, number]) => {
    const [x1, z1] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a : b;
    const [x2, z2] = x1 === a[0] && z1 === a[1] ? b : a;
    const key = `${x1},${z1},${x2},${z2}`;
    if (drawn.has(key) || onEdge(x1, z1, x2, z2)) return;
    drawn.add(key);
    const horiz = Math.abs(z1 - z2) < 1e-6;
    const vert = Math.abs(x1 - x2) < 1e-6;
    if (!horiz && !vert) return; // outlines are axis-aligned (traced on the 4 m grid)
    const len = horiz ? x2 - x1 : z2 - z1;
    if (len < 2.6) return seg(x1, z1, x2, z2);
    const m = len / 2, gap = 0.5;
    if (horiz) { seg(x1, z1, x1 + m - gap, z1); seg(x1 + m + gap, z1, x2, z2); }
    else { seg(x1, z1, x1, z1 + m - gap); seg(x1, z1 + m + gap, x2, z2); }
  };

  const traced = plan.rooms.filter((r) => r.shape && r.shape.length >= 3);
  const shapeGeo = (s: PlanShape, y: number) => {
    const sh = new THREE.Shape(s.map(([x, z]) => new THREE.Vector2(PX(x), -PZ(z))));
    return new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).translate(0, y, 0);
  };

  for (const room of traced) {
    const s = room.shape!;
    const hl = new THREE.Mesh(shapeGeo(s, 0.03), new THREE.MeshBasicMaterial({ color: 0x2741fa, transparent: true, opacity: 0.22, depthWrite: false }));
    hl.visible = false;
    hl.renderOrder = 3;
    highlights.set(room.id, hl);
    group.add(hl);
    if (room.areaType === "common_area" || room.areaType === "restroom") continue;

    const tint = new THREE.Color(TINT[room.areaType] ?? 0xdce3ff);
    const b = bbox(s);
    group.add(mesh(shapeGeo(s, 0.012), new THREE.MeshStandardMaterial({ map: own(tex.carpet, b.w / 3, b.d / 3), color: tint, roughness: 0.95, envMapIntensity: 0.3 }), false, true));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(s.map(([x, z]) => new THREE.Vector3(PX(x), 0.03, PZ(z)))),
      new THREE.LineBasicMaterial({ color: tint.clone().multiplyScalar(0.8) }));
    group.add(line);
    for (let i = 0; i < s.length; i++) edgeWithDoor(s[i], s[(i + 1) % s.length]);
    const c = center(room);
    if (c) labels.push({ pos: new THREE.Vector3(PX(c[0]), 1.7, PZ(c[1])), kind: "room", text: room.name, sub: `${areaText(shapeArea(s))} ตร.ม.` });
  }
  const common = traced.find((r) => r.areaType === "common_area");
  if (common) {
    const c = center(common);
    if (c) labels.push({ pos: new THREE.Vector3(PX(c[0]), 1.4, PZ(c[1])), kind: "room", text: "พื้นที่ส่วนกลาง", sub: `${areaText(shapeArea(common.shape!))} ตร.ม.` });
  }
  if (!traced.length) labels.push({ pos: new THREE.Vector3(0, 1.6, PZ(D * 0.68)), kind: "note", text: "ยังไม่มีผังห้องของชั้นนี้" });

  // core: toilets, stairs, lift, A.H.U. (the same on every floor)
  const stairs: THREE.BufferGeometry[] = [];
  for (const c of B1.core) {
    const fm = c.kind === "tile"
      ? new THREE.MeshStandardMaterial({ map: own(tex.wetTile, c.w / 1.2, c.d / 1.2), roughness: 0.3, envMapIntensity: 0.7 })
      : new THREE.MeshStandardMaterial({ color: c.kind === "lift" ? 0x9aa1a7 : 0xc6c8c8, roughness: c.kind === "lift" ? 0.3 : 0.85, metalness: c.kind === "lift" ? 0.6 : 0 });
    group.add(mesh(new THREE.PlaneGeometry(c.w - 0.12, c.d - 0.12).rotateX(-Math.PI / 2).translate(PX(c.x + c.w / 2), 0.014, PZ(c.z + c.d / 2)), fm, false, true));
    const corners: [number, number][] = [[c.x, c.z], [c.x + c.w, c.z], [c.x + c.w, c.z + c.d], [c.x, c.z + c.d]];
    for (let i = 0; i < 4; i++) edgeWithDoor(corners[i], corners[(i + 1) % 4]);
    if (c.kind === "stairs") {
      const n = 10, run = (c.w - 0.5) / 2, tread = (c.d - 0.8) / n;
      for (let i = 0; i < n; i++) {
        const z = PZ(c.z + c.d - 0.4 - (i + 0.5) * tread);
        stairs.push(bg(run - 0.06, 0.12 * (i + 1), tread, PX(c.x + 0.2 + run / 2), 0, z));
        stairs.push(bg(run - 0.06, Math.min(CUT, 0.12 * (n + i + 1)), tread, PX(c.x + 0.3 + run * 1.5), 0, z));
      }
    }
    labels.push({ pos: new THREE.Vector3(PX(c.x + c.w / 2), 1.55, PZ(c.z + c.d / 2)), kind: "core", text: c.label });
  }
  if (stairs.length) group.add(merged(stairs.map((s) => worldUV(s)), colMat));

  // facade: sill wall + glass, entrance gap on the ground floor
  const front: [number, number][] = isGround ? [[0, B1.entrance.x], [B1.entrance.x + B1.entrance.w, W]] : [[0, W]];
  for (const [a, c] of front) seg(a, D - 0.1, c, D - 0.1, 0.9, 0.2);
  seg(0, 0.1, W, 0.1, 0.9, 0.2);
  seg(0.1, 0, 0.1, D, 0.9, 0.2);
  seg(W - 0.1, 0, W - 0.1, D, 0.9, 0.2);
  const gl = [bg(W, CUT - 0.9, 0.04, 0, 0.9, PZ(0.1)), bg(0.04, CUT - 0.9, D, PX(0.1), 0.9, 0), bg(0.04, CUT - 0.9, D, PX(W - 0.1), 0.9, 0)];
  for (const [a, c] of front) gl.push(bg(c - a, CUT - 0.9, 0.04, PX((a + c) / 2), 0.9, PZ(D - 0.1)));
  group.add(merged(gl, glassMat, false, false));

  // columns on the structural grid
  const zs = [0];
  B1.rows.forEach((r) => zs.push(zs[zs.length - 1] + r));
  for (let x = 0; x <= W + 1e-3; x += B1.bay) {
    for (const z of zs) {
      walls.push(bg(0.5, CUT, 0.5, PX(x), 0, PZ(z)));
      caps.push(bg(0.51, 0.025, 0.51, PX(x), CUT, PZ(z)));
    }
  }
  group.add(merged(walls.map((w) => worldUV(w)), wallMat), merged(caps, capMat, false, false));

  // dimension ticks + labels (like the CAD drawing)
  const tick: number[] = [];
  for (let x = 0; x <= W + 1e-3; x += B1.bay) tick.push(PX(x), 0.03, PZ(0) - 0.6, PX(x), 0.03, PZ(0) - 2.0);
  for (const z of zs) tick.push(PX(0) - 0.6, 0.03, PZ(z), PX(0) - 2.4, 0.03, PZ(z));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(tick, 3));
  group.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x62657c })));
  for (let x = 0; x + B1.bay <= W + 1e-3; x += B1.bay) labels.push({ pos: new THREE.Vector3(PX(x + B1.bay / 2), 0.05, PZ(0) - 1.3), kind: "dim", text: String(B1.bay * 1000) });
  let acc = 0;
  for (const r of B1.rows) {
    labels.push({ pos: new THREE.Vector3(PX(0) - 1.7, 0.05, PZ(acc + r / 2)), kind: "dim", text: String(r * 1000) });
    acc += r;
  }

  // furniture: instanced desks with monitors + task chairs, in rectangular office / meeting rooms
  const spots: [number, number][] = [];
  for (const room of traced) {
    if (!["office", "meeting_room"].includes(room.areaType) || !isRect(room.shape!)) continue;
    const z = bbox(room.shape!);
    const nx = Math.floor((z.w - 1.0) / 1.9), nz = Math.floor((z.d - 1.2) / 2.2);
    if (nx < 1 || nz < 1) continue;
    const sx = z.x + (z.w - (nx - 1) * 1.9) / 2, sz = z.z + (z.d - (nz - 1) * 2.2) / 2 - 0.35;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) spots.push([PX(sx + i * 1.9), PZ(sz + j * 2.2)]);
  }
  if (spots.length) {
    const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
    const deskGeo = mergeGeometries([
      new THREE.BoxGeometry(1.4, 0.035, 0.7).translate(0, 0.735, 0),
      mergeGeometries([new THREE.BoxGeometry(0.04, 0.72, 0.62).translate(-0.66, 0.36, 0), new THREE.BoxGeometry(0.04, 0.72, 0.62).translate(0.66, 0.36, 0), new THREE.BoxGeometry(1.3, 0.3, 0.02).translate(0, 0.5, -0.3)]),
      mergeGeometries([new THREE.BoxGeometry(0.58, 0.35, 0.03).translate(0, 1.0, -0.22), new THREE.BoxGeometry(0.06, 0.18, 0.06).translate(0, 0.84, -0.25), new THREE.BoxGeometry(0.24, 0.015, 0.18).translate(0, 0.76, -0.25)]),
    ], true);
    const chairGeo = mergeGeometries([
      mergeGeometries([new RoundedBoxGeometry(0.5, 0.08, 0.48, 2, 0.03).translate(0, 0.47, 0.72), new RoundedBoxGeometry(0.46, 0.5, 0.06, 2, 0.03).translate(0, 0.78, 0.96)].map(ni)),
      mergeGeometries([new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6).translate(0, 0.24, 0.72), new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12).translate(0, 0.04, 0.72)].map(ni)),
    ], true);
    const dm = new THREE.InstancedMesh(deskGeo, [
      new THREE.MeshStandardMaterial({ color: 0xe9e3d7, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x5d646a, metalness: 0.6, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.25, metalness: 0.3 }),
    ], spots.length);
    const cm = new THREE.InstancedMesh(chairGeo, [
      new THREE.MeshStandardMaterial({ color: 0x30363c, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x6f767c, metalness: 0.7, roughness: 0.35 }),
    ], spots.length);
    const o = new THREE.Object3D(), r = rng(plan.floor.level * 3 + 1);
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = 0;
      o.updateMatrix();
      dm.setMatrixAt(i, o.matrix);
      o.rotation.y = (r() - 0.5) * 0.6;
      o.updateMatrix();
      cm.setMatrixAt(i, o.matrix);
    });
    dm.castShadow = cm.castShadow = dm.receiveShadow = true;
    group.add(dm, cm);
  }

  if (isGround) {
    const rc = B1.reception;
    group.add(mesh(bg(rc.w, 1.05, rc.d, PX(rc.x + rc.w / 2), 0, PZ(rc.z + rc.d / 2)), new THREE.MeshStandardMaterial({ color: 0x7d5f43, roughness: 0.55 })));
    group.add(mesh(bg(rc.w + 0.1, 0.04, rc.d + 0.15, PX(rc.x + rc.w / 2), 1.05, PZ(rc.z + rc.d / 2)), new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.3 })));
    labels.push({ pos: new THREE.Vector3(PX(rc.x + rc.w / 2), 1.6, PZ(rc.z + rc.d / 2)), kind: "core", text: "Information" });
  }

  // potted plants in the corridor
  const pots: THREE.BufferGeometry[] = [], plants: [number, number, number, number, number][] = [];
  for (const [px, pz] of [[12.6, 6.6], [23.4, 6.6], [12.6, 8.4], [23.4, 8.4]]) {
    pots.push(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 12).translate(PX(px), 0.225, PZ(pz)));
    plants.push([PX(px), 0.95, PZ(pz), 0.55, 12]);
  }
  group.add(merged(pots, new THREE.MeshStandardMaterial({ color: 0x6e6a64, roughness: 0.7 })));
  leafClusters(group, tex, plants);

  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([[0, 0], [W, 0], [W, D], [0, D]].map(([x, z]) => new THREE.Vector3(PX(x), 0.04, PZ(z)))),
    new THREE.LineBasicMaterial({ color: 0xc33432 }),
  );
  outline.visible = false;
  group.add(outline);

  return { group, labels, highlights, outline, width: W, depth: D };
}
