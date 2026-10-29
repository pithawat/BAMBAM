import * as THREE from "three";
import { bg, merged, mesh, planeUV, worldUV, type Textures } from "./kit";
import type { BuildingModel, BuildingSize, FloorEntry } from "./model";
import { finishFloor, floorMats, glassBox, mullionGrid, newParts, trees } from "./parts";

// อาคาร 2 (CR-027) from the photo on p.1 of `attachments/building plan/2-อาคาร 2.pdf`: glazed ground floor
// on a stone plinth with white piers, entrance canopy and steps at the front-left; upper floors clad in
// white vertical fins with slit windows; a glazed corner with a ledge on floor 2; the curved LED board
// around the front-right corner of the top two floors; a thin flat roof with a deep overhang.
// Floors 1–4 of 24 × 15 m on a 3 m grid (rows 6 + 3 + 6 m) come from #27 / #30. Origin = footprint
// centre, Y up, metres; front = +z.

const B2 = {
  floorHeight: 3.6,
  /** Fins stand this far out of the footprint. */
  overhang: 0.6,
  roofOverhang: 2.6,
  cladding: 0xf4f3ee,
  frame: 0x30363c,
  plinth: 0.45,
  finStep: 1.2,
  /** Floor 2: glazed corner (front-right) this long on the front and this deep on the side. */
  corner: { front: 10, side: 6 },
} as const;

type Spec = typeof B2 & BuildingSize;

const mats = (tex: Textures) => floorMats(tex, B2.cladding, B2.frame);

function groundFloor(tex: Textures, s: Spec): FloorEntry {
  const { width: W, depth: D, floorHeight: FH, plinth: P } = s;
  const M = mats(tex), g = new THREE.Group();
  const parts = newParts();
  const stone = new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x9a9c98, roughness: 0.85, envMapIntensity: 0.4 });
  g.add(merged([worldUV(bg(W + 0.8, P, D + 0.8, 0, 0, 0))], stone));

  const h = FH - P - 0.3;
  parts.C.push(bg(W - 0.8, h, D - 0.8, 0, P, 0)); // inside, seen through the glass
  glassBox(W - 0.7, D - 0.7, P, h, 0, parts.G, 0.15);
  mullionGrid(W - 0.7, D - 0.7, P, h, 1.5, parts.T, 0.02);
  // white piers between the glazed bays (photo: solid panels at the corners and mid-front)
  for (const x of [-W / 2 + 0.6, -1.5, 6, W / 2 - 0.6]) parts.C.push(bg(1.2, h, 0.5, x, P, D / 2 - 0.2), bg(1.2, h, 0.5, x, P, -D / 2 + 0.2));
  for (const z of [-D / 2 + 0.6, D / 2 - 0.6]) parts.C.push(bg(0.5, h, 1.2, W / 2 - 0.2, P, z), bg(0.5, h, 1.2, -W / 2 + 0.2, P, z));
  parts.C.push(bg(W + 0.3, 0.3, D + 0.3, 0, FH - 0.3, 0));

  // entrance canopy on two dark columns + steps, front-left
  const cx = -W / 2 + 3;
  parts.C.push(bg(7, 0.28, 3.6, cx - 0.5, FH - 0.55, D / 2 + 1.8));
  for (const x of [cx - 3.6, cx + 2.6]) parts.T.push(bg(0.3, FH - 0.55 - P, 0.3, x, P, D / 2 + 3.3));
  const steps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) steps.push(worldUV(bg(6, P - i * 0.15, 0.42, cx, 0, D / 2 + 0.6 + i * 0.42)));
  g.add(merged(steps, stone));
  return finishFloor(s, 1, 0, g, M, parts);
}

function finFloor(tex: Textures, s: Spec, f: number): FloorEntry {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, finStep, corner } = s;
  const M = mats(tex), g = new THREE.Group();
  const parts = newParts();
  const y0 = (f - 1) * FH, ys = 0.35, h = FH - ys;
  parts.C.push(bg(W + 2 * OH, ys, D + 2 * OH, 0, y0, 0));
  glassBox(W, D, y0 + ys, h, 0, parts.G, f * 0.17);

  // floor 2: the front-right corner is glazed with a ledge (AC units on it), no fins there
  const glazed = f === 2;
  const inCorner = (x: number, z: number) => glazed && x > W / 2 - corner.front && z > D / 2 - corner.side;
  const fin = (x: number, z: number, alongX: boolean) => {
    if (inCorner(x, z)) return;
    parts.C.push(alongX ? bg(0.55, h, OH, x, y0 + ys, z) : bg(OH, h, 0.55, x, y0 + ys, z));
  };
  for (let x = -W / 2 + finStep / 2; x < W / 2; x += finStep) {
    fin(x, D / 2 + OH / 2, true);
    fin(x, -D / 2 - OH / 2, true);
  }
  for (let z = -D / 2 + finStep / 2; z < D / 2; z += finStep) {
    fin(W / 2 + OH / 2, z, false);
    fin(-W / 2 - OH / 2, z, false);
  }
  if (glazed) {
    const fx = W / 2 - corner.front / 2, sz = D / 2 - corner.side / 2;
    for (let x = W / 2 - corner.front; x <= W / 2 + 1e-3; x += 2) parts.T.push(bg(0.07, h, 0.1, x, y0 + ys, D / 2 + 0.05));
    for (let z = D / 2 - corner.side; z < D / 2; z += 2) parts.T.push(bg(0.1, h, 0.07, W / 2 + 0.05, y0 + ys, z));
    parts.T.push(bg(corner.front, 0.06, 0.1, fx, y0 + ys + h * 0.7, D / 2 + 0.05), bg(0.1, 0.06, corner.side, W / 2 + 0.05, y0 + ys + h * 0.7, sz));
    // ledge with a low upstand around the corner
    parts.C.push(bg(corner.front + 1.4, 0.3, 1.4, fx + 0.7, y0, D / 2 + 0.7), bg(1.4, 0.3, corner.side, W / 2 + 0.7, y0, sz));
    parts.C.push(bg(corner.front + 1.4, 0.5, 0.15, fx + 0.7, y0 + 0.3, D / 2 + 1.33), bg(0.15, 0.5, corner.side + 1.4, W / 2 + 1.33, y0 + 0.3, sz + 0.7));
    for (const x of [W / 2 - 8.5, W / 2 - 6.6, W / 2 - 4.7]) parts.L.push(bg(0.86, 0.62, 0.32, x, y0 + 0.3, D / 2 + 0.5));
  }
  return finishFloor(s, f, y0, g, M, parts);
}

function roof(tex: Textures, s: Spec) {
  const { width: W, depth: D, floorHeight: FH, floors: NF, roofOverhang: RO } = s;
  const M = mats(tex), g = new THREE.Group();
  const C: THREE.BufferGeometry[] = [], T: THREE.BufferGeometry[] = [];
  const yR = NF * FH;
  C.push(bg(W + 1.2, 0.9, D + 1.2, 0, yR, 0)); // parapet band over the fins
  C.push(bg(W + 2 * RO, 0.3, D + 2 * RO, 0, yR + 1.3, 0)); // the thin floating roof
  T.push(bg(W + 2 * RO + 0.1, 0.12, 0.08, 0, yR + 1.3, D / 2 + RO), bg(W + 2 * RO + 0.1, 0.12, 0.08, 0, yR + 1.3, -D / 2 - RO),
    bg(0.08, 0.12, D + 2 * RO, W / 2 + RO, yR + 1.3, 0), bg(0.08, 0.12, D + 2 * RO, -W / 2 - RO, yR + 1.3, 0));
  for (const x of [-W / 2 + 1, W / 2 - 1]) for (const z of [-D / 2 + 1, D / 2 - 1]) T.push(bg(0.2, 0.4, 0.2, x, yR + 0.9, z));
  C.push(bg(4, 1.6, 3, -W / 4, yR + 1.6, -D / 4)); // roof plant room
  g.add(merged(C.map((x) => worldUV(x)), M.c), merged(T, M.metal));

  // curved LED board around the front-right corner, over the top two floors
  const levels = Math.min(2, NF - 1);
  if (levels > 0) {
    const r = 1.6, out = 1.0, bh = levels * FH - 0.6, by = yR - levels * FH + 0.3;
    const front = 9, side = 5.5, ez = D / 2 + out, ex = W / 2 + out;
    const led = new THREE.MeshStandardMaterial({ map: tex.poster, emissive: 0xffffff, emissiveMap: tex.poster, emissiveIntensity: 0.55, roughness: 0.35 });
    const board = [
      planeUV(front, bh, 1, 1).translate(ex - r - front / 2, by + bh / 2, ez),
      planeUV(side, bh, 1, 1, 0.4).rotateY(Math.PI / 2).translate(ex, by + bh / 2, ez - r - side / 2),
      new THREE.CylinderGeometry(r, r, bh, 10, 1, true, 0, Math.PI / 2).translate(ex - r, by + bh / 2, ez - r),
    ];
    g.add(merged(board, led, false, false));
    T.length = 0; // the frame under the board (the roof's metal is merged above)
    T.push(bg(front + r, 0.25, 0.3, ex - (front + r) / 2, by - 0.25, ez - 0.15), bg(0.3, 0.25, side + r, ex - 0.15, by - 0.25, ez - (side + r) / 2));
    g.add(merged(T, M.metal));
  }
  return g;
}

/** Ground, an apron with parking in front and trees around อาคาร 2 (no neighbours; the site view shows those). */
function site(tex: Textures) {
  const g = new THREE.Group();
  g.add(mesh(planeUV(400, 400, 100, 100).rotateX(-Math.PI / 2).translate(0, -0.02, 0),
    new THREE.MeshStandardMaterial({ map: tex.grass, color: 0xa3ab97, roughness: 0.97, envMapIntensity: 0.25 }), false, true));
  g.add(mesh(planeUV(70, 56, 70 / 6, 56 / 6).rotateX(-Math.PI / 2).translate(0, 0, 6),
    new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95, envMapIntensity: 0.3 }), false, true));
  const lines: THREE.BufferGeometry[] = [];
  for (let x = -20; x <= 20 + 1e-3; x += 2.5) lines.push(new THREE.PlaneGeometry(0.12, 5).rotateX(-Math.PI / 2).translate(x, 0.035, 16.5));
  lines.push(new THREE.PlaneGeometry(40, 0.12).rotateX(-Math.PI / 2).translate(0, 0.035, 19));
  g.add(merged(lines, new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.8 }), false, true));
  trees(g, tex, [[-22, 12, 1.1], [22, 13, 1], [-26, -6, 1.2], [25, -3, 1], [-21, 24, 0.9], [23, 25, 1]]);
  return g;
}

function buildBuildingTwo(tex: Textures, s: Spec, surroundings = true) {
  const root = new THREE.Group();
  if (surroundings) root.add(site(tex));
  const floors: FloorEntry[] = [];
  for (let f = 1; f <= s.floors; f++) {
    const e = f === 1 ? groundFloor(tex, s) : finFloor(tex, s, f);
    floors.push(e);
    root.add(e.group);
  }
  const roofGroup = roof(tex, s);
  root.add(roofGroup);
  return { root, floors, roof: roofGroup };
}

const stairsAt = (x: number) => ({ label: "บันได", x: x + 0.2, z: 0.3, w: 2.6, d: 5.4, kind: "stairs" as const });

/** CR-027 registry entry `b2`. Core from the plans: ห้องน้ำ x 6–12 on floor 1, 9–12 above; stairs 12–15. */
export const model: BuildingModel = {
  floorHeight: B2.floorHeight,
  overhang: B2.overhang,
  plan: {
    bay: 3,
    rows: [6, 3, 6],
    core: (level) => level === 1
      ? [{ label: "ห้องน้ำ", x: 6.2, z: 0.3, w: 5.6, d: 5.4, kind: "tile" }, stairsAt(12)]
      : [{ label: "ห้องน้ำ", x: 9.2, z: 0.3, w: 2.6, d: 5.4, kind: "tile" }, stairsAt(12)],
    entrance: null,
    reception: null,
    plants: [[16.5, 6.8], [19.5, 6.8]],
  },
  build: (tex, size, opts) => buildBuildingTwo(tex, { ...B2, ...size }, opts?.surroundings ?? true),
};
