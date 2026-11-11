import * as THREE from "three";
import { bg, merged, type Textures } from "./kit";
import type { BuildingModel, BuildingSize } from "./model";
import { apron, gableEnds, gableRoof, lowMats, pane, rollerDoor } from "./lowrise";
import { finishFloor, floorMats, newParts } from "./parts";

// อาคาร TrialMix และห้องทดสอบหินทราย (CR-030) from `attachments/building plan/5-…pdf`: an open steel shed
// (43.5 × 10 m + a 3.7 m side strip) under a metal gable roof on columns, low walls with a closed back,
// and the small concrete-lab building (8.1 × 4.1 m, flat roof) 3 m to the east. The plan box is 54.6 ×
// 13.705 m (both buildings); x from the west end, z from the north (back).

const B5 = { floorHeight: 6.5, overhang: 0.8, rise: 1.4, cladding: 0xe9e8e2, frame: 0x50575d } as const;
const SHED = { w: 43.5, d: 13.705 } as const;
const LAB = { x: 46.5, z: 9.605, w: 8.1, d: 4.1, h: 3.2 } as const;

type Spec = typeof B5 & BuildingSize;

function buildTrialMix(tex: Textures, s: Spec, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, rise } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, [[-W / 2 - 5, -4, 1.1], [W / 2 + 4, -6, 1], [W / 2 + 3, 9, 0.9]]));

  const M = floorMats(tex, B5.cladding, B5.frame), L = lowMats(tex), g = new THREE.Group();
  const parts = newParts(), doors: THREE.BufferGeometry[] = [];
  const sx = SHED.w / 2 - W / 2, sw = SHED.w, sd = SHED.d;
  parts.C.push(bg(sw + 0.4, 0.25, sd + 0.4, sx, 0, 0));
  parts.C.push(bg(sw, FH - 0.3, 0.25, sx, 0.25, -sd / 2 + 0.12)); // closed back wall
  parts.C.push(bg(sw, 1.2, 0.2, sx, 0.25, sd / 2 - 0.1), bg(0.2, 1.2, sd, sx - sw / 2 + 0.1, 0.25, 0), bg(0.2, 1.2, sd, sx + sw / 2 - 0.1, 0.25, 0));
  // inside: sorting bays (plan x 18–31) and stacked material, seen through the open sides
  parts.C.push(bg(13, 2.2, 9.6, sx - sw / 2 + 24.5, 0.25, -sd / 2 + 5));
  for (let x = sx - sw / 2; x <= sx + sw / 2 + 1e-3; x += sw / 10) parts.T.push(bg(0.3, FH, 0.3, x, 0, sd / 2 - 0.15), bg(0.3, FH, 0.3, x, 0, -sd / 2 + 0.15));
  parts.T.push(bg(sw, 0.4, 0.3, sx, FH - 0.4, sd / 2 - 0.15));

  // the lab: concrete box with windows, a door and a flat roof
  const lx = LAB.x + LAB.w / 2 - W / 2, lz = LAB.z + LAB.d / 2 - D / 2;
  parts.C.push(bg(LAB.w, LAB.h, LAB.d, lx, 0, lz), bg(LAB.w + 0.8, 0.25, LAB.d + 0.8, lx, LAB.h, lz));
  pane(LAB.w, LAB.d, "front", -LAB.w / 2 + 3, LAB.w / 2 - 0.8, 1.0, 1.3, parts.G);
  for (const gg of parts.G.slice(-1)) gg.translate(lx, 0, lz);
  rollerDoor(LAB.d, "front", lx - LAB.w / 2 + 1.5, 1.6, 2.3, doors);
  for (const d of doors) d.translate(0, 0, lz);
  g.add(merged(doors, L.door));
  const floor = finishFloor(s, 1, 0, g, M, parts);
  root.add(floor.group);

  const roof = new THREE.Group(), sheets: THREE.BufferGeometry[] = [], ends: THREE.BufferGeometry[] = [];
  gableRoof(sw, sd, FH, rise, OH, sheets);
  gableEnds(sw, sd, FH, rise, ends);
  for (const x of [...sheets, ...ends]) x.translate(sx, 0, 0);
  roof.add(merged(sheets, L.roofMetal), merged(ends, L.roofMetal));
  root.add(roof);
  return { root, floors: [floor], roof };
}

/** CR-030 registry entry `b5`. */
export const model: BuildingModel = {
  floorHeight: B5.floorHeight,
  overhang: B5.overhang,
  plan: {
    bay: 4.35,
    rows: [10, 3.705],
    core: () => [],
    entrance: null,
    reception: null,
    plants: [],
    outline: () => [
      [[0, 0], [SHED.w, 0], [SHED.w, SHED.d], [0, SHED.d]],
      [[LAB.x, LAB.z], [LAB.x + LAB.w, LAB.z], [LAB.x + LAB.w, LAB.z + LAB.d], [LAB.x, LAB.z + LAB.d]],
    ],
  },
  build: (tex, size, opts) => buildTrialMix(tex, { ...B5, ...size }, opts?.surroundings ?? true),
};
