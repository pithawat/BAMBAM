import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bg, leafClusters, merged, mesh, planeUV, rng, worldUV, type Textures } from "./kit";

// อาคาร 1 from the owner's model `แผนผังงานซ่อมอาคาร.html` (section 4, D-082): ground floor with posters,
// entrance canopy and steps, 5 balcony floors, roof with railing, planters and the CPAC billboard, plus
// the site in front of it. Other buildings of the model are not used. Origin = footprint centre, Y up,
// metres; plan coordinates (top-left origin) map to x - W/2, z - D/2.
// CR-017: the number of floors and the footprint come from the API (#27); B1 keeps only the model's own
// shape (floor height, balcony overhang, colours, structural grid, core, entrance).

export const B1 = {
  floorHeight: 3.5,
  overhang: 1.2,
  cladding: 0xf1efe8,
  frame: 0x3a4047,
  rows: [6, 3, 6],
  bay: 4,
  /** Toilets, stairs, A.H.U. and lift — the same on every floor (plan coordinates). */
  core: [
    { label: "ห้องน้ำ", x: 12.6, z: 0.4, w: 3.6, d: 5.2, kind: "tile" },
    { label: "บันได", x: 16.6, z: 0.4, w: 3.4, d: 4.8, kind: "stairs" },
    { label: "A.H.U.", x: 20.4, z: 0.4, w: 3.2, d: 2.6, kind: "plain" },
    { label: "ลิฟต์", x: 30.2, z: 6.3, w: 1.8, d: 2.4, kind: "lift" },
  ],
  /** Floor 1 only: entrance gap in the front facade and the information counter. */
  entrance: { x: 14, w: 6 },
  reception: { x: 14.6, z: 10.4, w: 4.4, d: 0.8 },
} as const;

/** The model shape + the building data from #27 (floors, footprint in metres). */
export type BuildingSpec = typeof B1 & { floors: number; width: number; depth: number };

type Parts = { C: THREE.BufferGeometry[]; G: THREE.BufferGeometry[]; T: THREE.BufferGeometry[]; L: THREE.BufferGeometry[] };

export type FloorEntry = {
  level: number;
  group: THREE.Group;
  /** Concrete material: its emissive shows the floor's priority colour. */
  glowMat: THREE.MeshStandardMaterial;
  /** Invisible pick box + outline used for hover / priority highlight. */
  shell: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
};

function floorMats(tex: Textures) {
  return {
    c: new THREE.MeshStandardMaterial({ map: tex.concrete, color: B1.cladding, roughness: 0.93, envMapIntensity: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ map: tex.interior, roughness: 0.05, metalness: 0.25, envMapIntensity: 1.4 }),
    metal: new THREE.MeshStandardMaterial({ color: B1.frame, metalness: 0.75, roughness: 0.35, envMapIntensity: 0.9 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd2d5d3, metalness: 0.3, roughness: 0.55, envMapIntensity: 0.7 }),
  };
}

function glassBox(W: number, D: number, y: number, h: number, inset: number, list: THREE.BufferGeometry[], uOff: number) {
  list.push(planeUV(W, h, W / 16, 1, uOff).translate(0, y + h / 2, D / 2 + inset));
  list.push(planeUV(W, h, W / 16, 1, uOff + 0.31).rotateY(Math.PI).translate(0, y + h / 2, -D / 2 - inset));
  list.push(planeUV(D, h, D / 16, 1, uOff + 0.57).rotateY(Math.PI / 2).translate(W / 2 + inset, y + h / 2, 0));
  list.push(planeUV(D, h, D / 16, 1, uOff + 0.83).rotateY(-Math.PI / 2).translate(-W / 2 - inset, y + h / 2, 0));
}

function mullionGrid(W: number, D: number, y: number, h: number, step: number, list: THREE.BufferGeometry[], out = 0.05) {
  const dpt = 0.1;
  for (let x = -W / 2; x <= W / 2 + 1e-3; x += step) list.push(bg(0.07, h, dpt, x, y, D / 2 + out), bg(0.07, h, dpt, x, y, -D / 2 - out));
  for (let z = -D / 2 + step; z < D / 2 - 1e-3; z += step) list.push(bg(dpt, h, 0.07, W / 2 + out, y, z), bg(dpt, h, 0.07, -W / 2 - out, y, z));
  for (const yy of [y, y + h * 0.68, y + h - 0.06]) {
    list.push(bg(W, 0.06, dpt, 0, yy, D / 2 + out), bg(W, 0.06, dpt, 0, yy, -D / 2 - out));
    list.push(bg(dpt, 0.06, D, W / 2 + out, yy, 0), bg(dpt, 0.06, D, -W / 2 - out, yy, 0));
  }
}

function makeShell(s: BuildingSpec, level: number, y0: number) {
  const OH = s.overhang;
  const geo = new THREE.BoxGeometry(s.width + 2 * OH + 0.5, s.floorHeight - 0.04, s.depth + 2 * OH + 0.5);
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  shell.position.set(0, y0 + s.floorHeight / 2, 0);
  shell.userData = { level, noFade: true }; // keeps its own opacity while the floor fades
  shell.renderOrder = 5;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  edges.position.copy(shell.position);
  edges.renderOrder = 6;
  edges.visible = false;
  return { shell, edges };
}

function finishFloor(s: BuildingSpec, level: number, y0: number, g: THREE.Group, M: ReturnType<typeof floorMats>, parts: Parts): FloorEntry {
  if (parts.C.length) g.add(merged(parts.C.map((x) => worldUV(x)), M.c));
  if (parts.G.length) g.add(merged(parts.G, M.glass, false, true));
  if (parts.T.length) g.add(merged(parts.T, M.metal));
  if (parts.L.length) g.add(merged(parts.L, M.light));
  const { shell, edges } = makeShell(s, level, y0);
  g.add(shell, edges);
  return { level, group: g, glowMat: M.c, shell, edges };
}

function groundFloor(tex: Textures, s: BuildingSpec): FloorEntry {
  const { width: W, depth: D, floorHeight: FH } = s;
  const M = floorMats(tex), g = new THREE.Group();
  const parts: Parts = { C: [], G: [], T: [], L: [] };
  const stone = new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x8f918e, roughness: 0.85, envMapIntensity: 0.4 });
  const P = 0.6;
  g.add(merged([worldUV(bg(W + 1.0, P, D + 1.0, 0, 0, 0))], stone));

  // CPAC-style: solid ground floor with posters, recessed entrance, canopy and portrait
  parts.C.push(bg(W, FH - P, D, 0, P, 0));
  const bandH = 1.7, bandY = P + 0.6;
  parts.G.push(planeUV(W - 1, bandH, (W - 1) / 16, 1, 0.2).rotateY(Math.PI).translate(0, bandY + bandH / 2, -D / 2 - 0.02));
  parts.G.push(planeUV(D - 1, bandH, (D - 1) / 16, 1, 0.5).rotateY(Math.PI / 2).translate(W / 2 + 0.02, bandY + bandH / 2, 0));
  parts.G.push(planeUV(D - 1, bandH, (D - 1) / 16, 1, 0.7).rotateY(-Math.PI / 2).translate(-W / 2 - 0.02, bandY + bandH / 2, 0));
  parts.G.push(planeUV(5, 2.5, 5 / 16, 1, 0.1).translate(0, P + 1.25, D / 2 + 0.02));
  for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) parts.T.push(bg(0.07, 2.5, 0.1, x, P, D / 2 + 0.05));
  parts.T.push(bg(5.1, 0.08, 0.1, 0, P + 2.46, D / 2 + 0.05));
  const posterMat = new THREE.MeshStandardMaterial({ map: tex.poster, roughness: 0.45, envMapIntensity: 0.6 });
  const posters: THREE.BufferGeometry[] = [];
  for (const x of [-14, -10.4, -6.8, 6.8, 10.4, 14]) {
    posters.push(new THREE.PlaneGeometry(3.3, 2.1).translate(x, P + 1.3, D / 2 + 0.06));
    parts.T.push(bg(3.42, 0.06, 0.08, x, P + 0.22, D / 2 + 0.04), bg(3.42, 0.06, 0.08, x, P + 2.32, D / 2 + 0.04),
      bg(0.06, 2.16, 0.08, x - 1.68, P + 0.22, D / 2 + 0.04), bg(0.06, 2.16, 0.08, x + 1.68, P + 0.22, D / 2 + 0.04));
  }
  g.add(merged(posters, posterMat, false, true));
  parts.C.push(bg(7.4, 0.3, 3.6, 0, 2.95, D / 2 + 1.8), bg(0.3, 2.35, 0.3, -3.3, P, D / 2 + 3.3), bg(0.3, 2.35, 0.3, 3.3, P, D / 2 + 3.3));
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) steps.push(worldUV(bg(7.6, P - i * 0.15, 0.42, 0, 0, D / 2 + 0.71 + i * 0.42)));
  g.add(merged(steps, stone));
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.9, roughness: 0.28 });
  g.add(mesh(bg(1.8, 2.4, 0.25, 0, 3.25, D / 2 + 3.2), gold));
  g.add(mesh(new THREE.PlaneGeometry(1.36, 1.96).translate(0, 4.45, D / 2 + 3.33), new THREE.MeshStandardMaterial({ map: tex.portrait, roughness: 0.4 }), false, true));
  return finishFloor(s, 1, 0, g, M, parts);
}

function balconyFloor(tex: Textures, s: BuildingSpec, f: number): FloorEntry {
  const { width: W, depth: D, floorHeight: FH, overhang: OH } = s;
  const M = floorMats(tex), g = new THREE.Group();
  const parts: Parts = { C: [], G: [], T: [], L: [] };
  const r = rng(f * 131 + 7);
  const y0 = (f - 1) * FH, ys = 0.35, ph = 1.0, pt = 0.2, yP = y0 + ys;
  parts.C.push(bg(W + 2 * OH, ys, D + 2 * OH, 0, y0, 0));
  parts.C.push(
    bg(W + 2 * OH, ph, pt, 0, yP, D / 2 + OH - pt / 2), bg(W + 2 * OH, ph, pt, 0, yP, -(D / 2 + OH - pt / 2)),
    bg(pt, ph, D + 2 * OH - 2 * pt, W / 2 + OH - pt / 2, yP, 0), bg(pt, ph, D + 2 * OH - 2 * pt, -(W / 2 + OH - pt / 2), yP, 0));
  parts.C.push(bg(W + 2 * OH + 0.04, 0.06, pt + 0.06, 0, yP + ph, D / 2 + OH - pt / 2), bg(W + 2 * OH + 0.04, 0.06, pt + 0.06, 0, yP + ph, -(D / 2 + OH - pt / 2)));
  const finH = FH - ys - ph - 0.06;
  for (const x of [-(W / 2 + OH - 0.15), -8, 0, 8, W / 2 + OH - 0.15]) {
    for (const s of [1, -1]) parts.C.push(bg(0.2, finH, 0.22, x, yP + ph + 0.06, s * (D / 2 + OH - 0.11)));
  }
  const gh = FH - ys;
  glassBox(W, D, yP, gh, 0, parts.G, r());
  mullionGrid(W, D, yP, gh, 2, parts.T);
  // split AC condensers sitting on the balconies
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 2 + r() * (W - 4), front = r() < 0.6 ? 1 : -1;
    parts.L.push(bg(0.86, 0.62, 0.32, x, yP, front * (D / 2 + 0.45)));
  }
  return finishFloor(s, f, y0, g, M, parts);
}

function roof(tex: Textures, s: BuildingSpec) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, floors: NF } = s;
  const M = floorMats(tex), g = new THREE.Group();
  const C: THREE.BufferGeometry[] = [], T: THREE.BufferGeometry[] = [];
  const yR = NF * FH, top = yR + 0.4;
  C.push(bg(W + 2 * OH + 0.3, 0.4, D + 2 * OH + 0.3, 0, yR, 0));
  C.push(bg(Math.min(8, W * 0.3), 2.8, Math.min(5.5, D * 0.35), 0, top, -D * 0.18));
  const ex = W / 2 + OH, ez = D / 2 + OH;
  for (let x = -ex + 0.1; x <= ex; x += 2) T.push(bg(0.06, 1.1, 0.06, x, top, ez - 0.1), bg(0.06, 1.1, 0.06, x, top, -ez + 0.1));
  for (let z = -ez + 2; z < ez; z += 2) T.push(bg(0.06, 1.1, 0.06, ex - 0.1, top, z), bg(0.06, 1.1, 0.06, -ex + 0.1, top, z));
  for (const h of [0.55, 1.08]) {
    T.push(bg(2 * ex, 0.06, 0.06, 0, top + h, ez - 0.1), bg(2 * ex, 0.06, 0.06, 0, top + h, -ez + 0.1));
    T.push(bg(0.06, 0.06, 2 * ez, ex - 0.1, top + h, 0), bg(0.06, 0.06, 2 * ez, -ex + 0.1, top + h, 0));
  }
  for (const x of [-12, -4, 4, 12]) T.push(bg(0.22, 2.2, 0.22, x, top, ez - 0.75));
  for (let x = -14; x <= 14; x += 4) C.push(bg(2.4, 0.5, 0.7, x, top, ez - 1.5));
  leafClusters(g, tex, [...Array(8)].map((_, i) => [-14 + i * 4, top + 0.8, ez - 1.5, 0.75, 10] as [number, number, number, number, number]));
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d7cc0, roughness: 0.45, envMapIntensity: 0.6 });
  const face = new THREE.MeshStandardMaterial({ map: tex.sign, roughness: 0.4, envMapIntensity: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(30, 2.6, 0.35), [blue, blue, blue, blue, face, blue]);
  board.position.set(0, top + 3.5, ez - 0.55);
  board.castShadow = true;
  g.add(board);
  g.add(merged(C.map((x) => worldUV(x)), M.c));
  g.add(merged(T, M.metal));
  return g;
}

function trees(parent: THREE.Object3D, tex: Textures, list: [number, number, number][]) {
  const trunks: THREE.BufferGeometry[] = [];
  const crowns: [number, number, number, number, number][] = [];
  const bark = new THREE.MeshStandardMaterial({ color: 0x5d5044, roughness: 0.95 });
  for (const [x, z, s] of list) {
    trunks.push(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 3.4 * s, 7).translate(x, 1.7 * s, z));
    crowns.push([x, 4.4 * s, z, 2.6 * s, 34], [x + 0.9 * s, 3.6 * s, z + 0.4 * s, 1.7 * s, 16], [x - 0.8 * s, 3.8 * s, z - 0.5 * s, 1.8 * s, 16]);
  }
  parent.add(merged(trunks, bark));
  leafClusters(parent, tex, crowns);
}

/** Ground, plaza, lawns and hedges, parking with cars and trees around อาคาร 1 (the model's site, other buildings removed). */
function site(tex: Textures) {
  const g = new THREE.Group();
  g.add(mesh(planeUV(400, 400, 100, 100).rotateX(-Math.PI / 2).translate(0, -0.02, 0),
    new THREE.MeshStandardMaterial({ map: tex.grass, color: 0xa3ab97, roughness: 0.97, envMapIntensity: 0.25 }), false, true));
  g.add(mesh(planeUV(90, 70, 90 / 6, 70 / 6).rotateX(-Math.PI / 2).translate(0, 0, 4),
    new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95, envMapIntensity: 0.3 }), false, true));
  g.add(mesh(planeUV(46, 8, 46 / 2.4, 8 / 2.4).rotateX(-Math.PI / 2).translate(0, 0.03, 12),
    new THREE.MeshStandardMaterial({ map: tex.paving, roughness: 0.9 }), false, true));

  const lawns: THREE.BufferGeometry[] = [], hedges: THREE.BufferGeometry[] = [], curbs: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    lawns.push(worldUV(bg(11, 0.12, 2.8, s * 10.6, 0, 9.8), 0.4));
    hedges.push(worldUV(new RoundedBoxGeometry(10.4, 0.8, 0.9, 2, 0.25).translate(s * 10.6, 0.52, 9.1), 0.5));
    curbs.push(worldUV(bg(11, 0.18, 0.24, s * 10.6, 0, 11.3), 1));
  }
  g.add(merged(lawns, new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.95, envMapIntensity: 0.3 }), false, true),
    merged(hedges, new THREE.MeshStandardMaterial({ map: tex.hedge, roughness: 0.9, envMapIntensity: 0.3 })),
    merged(curbs, new THREE.MeshStandardMaterial({ map: tex.curb, roughness: 0.7 })));

  // parking stalls in front of the building
  const lines: THREE.BufferGeometry[] = [];
  for (const row of [[19, 24], [24, 29]]) {
    for (let x = -22.5; x <= 22.5 + 1e-3; x += 2.5) lines.push(new THREE.PlaneGeometry(0.12, 5).rotateX(-Math.PI / 2).translate(x, 0.035, (row[0] + row[1]) / 2));
  }
  lines.push(new THREE.PlaneGeometry(45, 0.12).rotateX(-Math.PI / 2).translate(0, 0.035, 24));
  g.add(merged(lines, new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.8 }), false, true));

  // cars — 3 instanced meshes
  const r = rng(41), spots: [number, number][] = [];
  for (const zc of [21.5, 26.5]) for (let x = -21.25; x < 22; x += 2.5) if (r() < 0.55) spots.push([x, zc]);
  const bodyGeo = new RoundedBoxGeometry(1.84, 0.78, 4.4, 3, 0.26).translate(0, 0.62, 0);
  const cabGeo = new RoundedBoxGeometry(1.62, 0.66, 2.3, 3, 0.22).translate(0, 1.24, 0.2);
  const wheels: THREE.BufferGeometry[] = [];
  for (const sx of [-0.82, 0.82]) for (const sz of [-1.38, 1.38]) wheels.push(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14).rotateZ(Math.PI / 2).translate(sx, 0.34, sz));
  const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ metalness: 0.65, roughness: 0.32, envMapIntensity: 1.2 }), spots.length);
  const cab = new THREE.InstancedMesh(cabGeo, new THREE.MeshStandardMaterial({ color: 0x1b2328, metalness: 0.5, roughness: 0.08, envMapIntensity: 1.4 }), spots.length);
  const whl = new THREE.InstancedMesh(mergeGeometries(wheels), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 }), spots.length);
  const paints = [0xf2f2f0, 0xf2f2f0, 0xb9bdc0, 0x7d8286, 0x23272b, 0x2c3e5c, 0x8e1f22];
  const o = new THREE.Object3D(), col = new THREE.Color();
  spots.forEach(([x, z], i) => {
    o.position.set(x, 0, z);
    o.rotation.y = z < 24 ? Math.PI : 0;
    o.updateMatrix();
    body.setMatrixAt(i, o.matrix);
    cab.setMatrixAt(i, o.matrix);
    whl.setMatrixAt(i, o.matrix);
    body.setColorAt(i, col.setHex(paints[(r() * paints.length) | 0]));
  });
  for (const m of [body, cab, whl]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  trees(g, tex, [[-26, 13, 1.1], [26, 14, 1], [-30, -6, 1.2], [29, -2, 1], [-27, 22, 0.9], [27, 24, 1], [-33, 8, 0.95], [30, 6, 1]]);
  return g;
}

/** Builds อาคาร 1 on its site. `floors[level - 1]` = that floor. */
export function buildBuildingOne(tex: Textures, s: BuildingSpec) {
  const root = new THREE.Group();
  root.add(site(tex));
  const floors: FloorEntry[] = [];
  for (let f = 1; f <= s.floors; f++) {
    const e = f === 1 ? groundFloor(tex, s) : balconyFloor(tex, s, f);
    floors.push(e);
    root.add(e.group);
  }
  const roofGroup = roof(tex, s);
  root.add(roofGroup);
  return { root, floors, roof: roofGroup };
}
