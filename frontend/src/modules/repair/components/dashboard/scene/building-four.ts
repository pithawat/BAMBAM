import * as THREE from "three";
import { bg, merged, worldUV, type Textures } from "./kit";
import type { BuildingModel, BuildingSize, FloorEntry } from "./model";
import { acUnit, apron, gableEnds, gableRoof, lowMats, pane } from "./lowrise";
import { finishFloor, floorMats, newParts } from "./parts";

// อาคาร 4 (CR-030) from p.1 of `attachments/building plan/4-อาคาร 4.pdf`: two storeys, white wings with
// window bands and split-type AC units on the walls, a blue entrance block with a flat canopy at the
// lobby / stairs (plan x 15–25), a pitched grey roof. 38 × 10 m (rows 5 + 1 + 4).

const B4 = { floorHeight: 3.6, overhang: 0.9, rise: 1.8, cladding: 0xf4f3ee, frame: 0x30363c } as const;

type Spec = typeof B4 & BuildingSize;

/** Plan x of the blue entrance block (lobby + stairs). */
const ENTRY = { x: 15, w: 10 } as const;

function floor(tex: Textures, s: Spec, f: number): FloorEntry {
  const { width: W, depth: D, floorHeight: FH } = s;
  const M = floorMats(tex, B4.cladding, B4.frame), L = lowMats(tex), g = new THREE.Group();
  const parts = newParts(), blue: THREE.BufferGeometry[] = [];
  const y0 = (f - 1) * FH, ex = ENTRY.x - W / 2 + ENTRY.w / 2;
  parts.C.push(bg(W + 0.3, 0.3, D + 0.3, 0, y0, 0), bg(W, FH - 0.3, D, 0, y0 + 0.3, 0));
  const wy = y0 + 1.1, wh = 1.6;
  pane(W, D, "front", -W / 2 + 0.8, ENTRY.x - W / 2 - 0.3, wy, wh, parts.G);
  pane(W, D, "front", ENTRY.x + ENTRY.w - W / 2 + 0.3, W / 2 - 0.8, wy, wh, parts.G);
  pane(W, D, "back", -W / 2 + 0.8, W / 2 - 0.8, wy, wh, parts.G);
  for (let x = -W / 2 + 0.8; x <= W / 2 - 0.8 + 1e-3; x += 2.5) parts.T.push(bg(0.07, wh, 0.1, x, wy, D / 2 + 0.05), bg(0.07, wh, 0.1, x, wy, -D / 2 - 0.05));
  // blue entrance block standing out of the front, glazed in the middle
  blue.push(bg(ENTRY.w, FH, 1.4, ex, y0, D / 2 + 0.6));
  pane(W, D + 2.8, "front", ex - 2.5, ex + 2.5, y0 + 0.4, FH - 0.9, parts.G, 0.02);
  if (f === 1) {
    parts.C.push(bg(ENTRY.w + 4, 0.25, 3, ex, FH - 0.7, D / 2 + 2.6));
    for (const x of [ex - ENTRY.w / 2 - 1.5, ex + ENTRY.w / 2 + 1.5]) parts.T.push(bg(0.2, FH - 0.7, 0.2, x, 0, D / 2 + 3.9));
  }
  for (const x of [-15, -11, 9, 13, 16]) acUnit(x, y0 + 0.5, -D / 2 - 0.2, parts.L);
  g.add(merged(blue.map((b) => worldUV(b)), L.blue));
  return finishFloor(s, f, y0, g, M, parts);
}

function buildBuildingFour(tex: Textures, s: Spec, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, floors: NF, overhang: OH, rise } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, [[-W / 2 - 5, 9, 1], [W / 2 + 5, 9, 1.1], [W / 2 + 4, -6, 1.2]]));
  const floors: FloorEntry[] = [];
  for (let f = 1; f <= NF; f++) {
    const e = floor(tex, s, f);
    floors.push(e);
    root.add(e.group);
  }
  const L = lowMats(tex), roof = new THREE.Group(), sheets: THREE.BufferGeometry[] = [], ends: THREE.BufferGeometry[] = [];
  gableRoof(W, D, NF * FH, rise, OH, sheets);
  gableEnds(W, D, NF * FH, rise, ends);
  roof.add(merged(sheets, L.roofTile), merged(ends, new THREE.MeshStandardMaterial({ map: tex.concrete, color: B4.cladding, roughness: 0.93 })));
  root.add(roof);
  return { root, floors, roof };
}

const stairs = (x: number) => ({ label: "บันได", x, z: 5.3, w: 2.6, d: 4.4, kind: "stairs" as const });

/** CR-030 registry entry `b4`. Stairs in the lobby (plan floor 1 x 18–25, floor 2 x 15–24). */
export const model: BuildingModel = {
  floorHeight: B4.floorHeight,
  overhang: B4.overhang,
  plan: {
    bay: 5,
    rows: [5, 1, 4],
    core: (level) => [stairs(level === 1 ? 19.5 : 15.6)],
    entrance: { x: 18.5, w: 4 },
    reception: null,
    plants: [[21, 8.6], [24, 8.6]],
  },
  build: (tex, size, opts) => buildBuildingFour(tex, { ...B4, ...size }, opts?.surroundings ?? true),
};
