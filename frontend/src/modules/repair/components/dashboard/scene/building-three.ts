import * as THREE from "three";
import { bg, merged, worldUV, type Textures } from "./kit";
import type { BuildingModel, BuildingSize } from "./model";
import { apron, gableEnds, gableRoof, lowMats, pane, rollerDoor } from "./lowrise";
import { finishFloor, floorMats, newParts } from "./parts";

// อาคาร 3 (CR-030) from p.1 of `attachments/building plan/3-อาคาร 3.pdf`: a long single-storey shed under a
// low metal gable roof; the east half (WPS / RMC Metro offices on the plan) has a glazed front with a blue
// fascia band, the west half (RMC Excellence workshop) roller doors at the front, offices behind with a
// window band; the WPS store has roller doors at the back. 72 × 17 m on 4.5 m bays (rows 3 + 4 + 5 + 5).

const B3 = { floorHeight: 6, overhang: 0.9, rise: 1.6, cladding: 0xf1f0eb, frame: 0x3a4046 } as const;

type Spec = typeof B3 & BuildingSize;

function buildBuildingThree(tex: Textures, s: Spec, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, rise } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, [[-W / 2 - 6, 8, 1.1], [W / 2 + 5, 6, 1], [-W / 2 - 4, -9, 1.2], [W / 2 + 6, -8, 1]]));

  const M = floorMats(tex, B3.cladding, B3.frame), L = lowMats(tex), g = new THREE.Group();
  const parts = newParts(), blue: THREE.BufferGeometry[] = [], doors: THREE.BufferGeometry[] = [];
  parts.C.push(bg(W + 0.4, 0.3, D + 0.4, 0, 0, 0), bg(W, FH - 0.3, D, 0, 0.3, 0));
  // front: workshop doors on the west half, glazed offices with a blue band on the east half
  for (const x of [-30, -21, -12, -3]) rollerDoor(D, "front", x, 4.6, 4.4, doors);
  pane(W, D, "front", 0.6, W / 2 - 0.6, 0.9, 2.6, parts.G);
  for (let x = 0.6; x <= W / 2 - 0.6 + 1e-3; x += 2.25) parts.T.push(bg(0.08, 2.6, 0.1, x, 0.9, D / 2 + 0.05));
  blue.push(bg(W / 2, 1.4, 0.2, W / 4, FH - 1.6, D / 2 + 0.1), bg(W / 2, 0.6, 0.15, W / 4, 0.3, D / 2 + 0.08));
  // back: office window band on the west half, store doors on the east half
  pane(W, D, "back", -W / 2 + 0.8, -0.8, 1.1, 1.4, parts.G);
  for (const x of [8, 18, 28]) rollerDoor(D, "back", x, 4.6, 4.6, doors);
  // side windows (high strip) and the gutter line
  pane(W, D, "left", -D / 2 + 1, D / 2 - 1, FH - 1.8, 0.9, parts.G);
  pane(W, D, "right", -D / 2 + 1, D / 2 - 1, FH - 1.8, 0.9, parts.G);
  parts.T.push(bg(W + 2 * OH, 0.18, 0.2, 0, FH - 0.1, D / 2 + OH), bg(W + 2 * OH, 0.18, 0.2, 0, FH - 0.1, -D / 2 - OH));
  g.add(merged(blue.map((b) => worldUV(b)), L.blue), merged(doors, L.door));
  const floor = finishFloor(s, 1, 0, g, M, parts);
  root.add(floor.group);

  const roof = new THREE.Group(), sheets: THREE.BufferGeometry[] = [], ends: THREE.BufferGeometry[] = [];
  gableRoof(W, D, FH, rise, OH, sheets);
  gableEnds(W, D, FH, rise, ends);
  roof.add(merged(sheets, L.roofMetal), merged(ends, M.c.clone()));
  root.add(roof);
  return { root, floors: [floor], roof };
}

/** CR-030 registry entry `b3`. */
export const model: BuildingModel = {
  floorHeight: B3.floorHeight,
  overhang: B3.overhang,
  plan: { bay: 4.5, rows: [3, 4, 5, 5], core: () => [], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildBuildingThree(tex, { ...B3, ...size }, opts?.surroundings ?? true),
};
