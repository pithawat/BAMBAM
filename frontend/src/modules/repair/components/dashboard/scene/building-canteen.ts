import * as THREE from "three";
import type { PlanShape } from "../../../types";
import { bg, merged, worldUV, type Textures } from "./kit";
import type { BuildingModel, BuildingSize } from "./model";
import { apron, edgePane, gableRoof, lowMats, outward } from "./lowrise";
import { finishFloor, floorMats, newParts } from "./parts";

// โรงอาหาร (CR-030) from `attachments/building photos/canteen_meeting_building1.png` (left) and p.2 of
// `17-…pdf`: a glazed curtain wall around the irregular dining hall (angled north side, 233.64 m²) under a
// big flat canopy roof tilted up to the south, and a blue annex with a metal roof at the north-east corner.
// The outline is the dining-hall room traced in the CR-030 migration; plan box 16 × 20 m.

const B16 = { floorHeight: 4.6, overhang: 2.2, cladding: 0xf2f1ec, frame: 0x2f3439 } as const;
const OUTLINE: PlanShape = [[0, 10], [7, 4], [12, 0], [16, 0], [16, 6], [14, 7], [14, 18], [13.64, 20], [0, 20]];
const ANNEX = { x: 12, z: 0, w: 4, d: 6 } as const;

type Spec = typeof B16 & BuildingSize;

function buildCanteen(tex: Textures, s: Spec, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, [[-W / 2 - 5, 6, 1.1], [W / 2 + 5, 8, 1], [-W / 2 - 3, -9, 1]]));
  const P = OUTLINE.map(([x, z]) => [x - W / 2, z - D / 2] as const);
  const shape = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
  const prism = (h: number, y: number, sh = shape) => worldUV(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y, 0));

  const M = floorMats(tex, B16.cladding, B16.frame), L = lowMats(tex), g = new THREE.Group();
  const parts = newParts(), blue: THREE.BufferGeometry[] = [], tin: THREE.BufferGeometry[] = [];
  parts.C.push(prism(0.35, 0), prism(0.25, FH - 0.25));
  const side = outward(OUTLINE);
  for (let i = 0; i < P.length; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length];
    edgePane(x1, z1, x2, z2, 0.35, FH - 0.6, 0.02, side, parts.G);
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.6));
    for (let k = 0; k < n; k++) parts.T.push(bg(0.08, FH - 0.6, 0.08, x1 + ((x2 - x1) * k) / n, 0.35, z1 + ((z2 - z1) * k) / n));
  }
  // blue annex (kitchen side) with a small metal roof
  const ax = ANNEX.x + ANNEX.w / 2 - W / 2, az = ANNEX.z + ANNEX.d / 2 - D / 2;
  blue.push(bg(ANNEX.w + 0.1, FH - 0.6, ANNEX.d + 0.1, ax, 0.35, az));
  gableRoof(ANNEX.d, ANNEX.w, FH - 0.25, 0.7, 0.4, tin);
  for (const t of tin) t.rotateY(Math.PI / 2).translate(ax, 0, az);
  g.add(merged(blue.map((b) => worldUV(b)), L.blue), merged(tin, L.roofMetal));
  const floor = finishFloor(s, 1, 0, g, M, parts);
  root.add(floor.group);

  // the canopy: the outline grown by the overhang, tilted up towards the south (front)
  const c = P.reduce((a, [x, z]) => [a[0] + x / P.length, a[1] + z / P.length], [0, 0]);
  const k = 1 + OH / 8;
  const big = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(c[0] + (x - c[0]) * k, -(c[1] + (z - c[1]) * k))));
  const roof = new THREE.Group();
  const slab = prism(0.35, 0, big);
  slab.rotateX(-0.05).translate(0, FH + 0.25, 0);
  roof.add(merged([slab], new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0xeeede8, roughness: 0.8 })));
  for (const [x, z] of [[-5, 8], [5, 8], [-6, -1]] as const) roof.add(merged([bg(0.25, 0.4, 0.25, x, FH, z)], M.metal));
  root.add(roof);
  return { root, floors: [floor], roof };
}

/** CR-030 registry entry `b16`. */
export const model: BuildingModel = {
  floorHeight: B16.floorHeight,
  overhang: B16.overhang,
  plan: { bay: 4, rows: [4, 4, 4, 4, 4], core: () => [], entrance: null, reception: null, plants: [], outline: () => [OUTLINE] },
  build: (tex, size, opts) => buildCanteen(tex, { ...B16, ...size }, opts?.surroundings ?? true),
};
