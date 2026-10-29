import * as THREE from "three";
import { bg, merged, type Textures } from "./kit";
import type { BuildingModel, BuildingSize } from "./model";
import { apron, hipRoof, lowMats, pane } from "./lowrise";
import { finishFloor, floorMats, newParts } from "./parts";

// ห้องประชุม 60 ปี (CR-030) from `attachments/building photos/canteen_meeting_building1.png` (centre) and
// p.1 of `17-…pdf`: a single-storey white hall (16 × 5 m + ห้องละมาด 2 × 5 m at the north end) under a
// hipped grey tile roof, window bays along both long sides, a carport roof on posts in front.

const B17 = { floorHeight: 3.4, overhang: 0.8, rise: 1.7, cladding: 0xf6f5f0, frame: 0x353a3f } as const;

type Spec = typeof B17 & BuildingSize;

function buildHall(tex: Textures, s: Spec, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, rise } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, [[-W / 2 - 4, -5, 1], [W / 2 + 4, -4, 1.1]]));

  const M = floorMats(tex, B17.cladding, B17.frame), L = lowMats(tex), g = new THREE.Group();
  const parts = newParts();
  parts.C.push(bg(W + 0.4, 0.3, D + 0.4, 0, 0, 0), bg(W, FH - 0.3, D, 0, 0.3, 0));
  for (let x = -W / 2 + 1.2; x < W / 2 - 3; x += 2.6) {
    pane(W, D, "front", x, x + 1.6, 0.95, 1.6, parts.G);
    pane(W, D, "back", x, x + 1.6, 0.95, 1.6, parts.G);
  }
  parts.T.push(bg(1.8, 2.3, 0.1, W / 2 - 3.6, 0.3, D / 2 + 0.05)); // door
  // carport in front: a thin metal roof on posts
  const cw = 14, cd = 5, cz = D / 2 + 0.6 + cd / 2;
  parts.L.push(bg(cw, 0.15, cd, -1, 2.7, cz));
  for (const x of [-1 - cw / 2 + 0.3, -1, -1 + cw / 2 - 0.3]) parts.T.push(bg(0.15, 2.7, 0.15, x, 0, cz + cd / 2 - 0.3));
  const floor = finishFloor(s, 1, 0, g, M, parts);
  root.add(floor.group);

  const roof = new THREE.Group();
  roof.add(merged([hipRoof(W, D, FH, rise, OH)], L.roofTile));
  root.add(roof);
  return { root, floors: [floor], roof };
}

/** CR-030 registry entry `b17`. */
export const model: BuildingModel = {
  floorHeight: B17.floorHeight,
  overhang: B17.overhang,
  plan: { bay: 4, rows: [5], core: () => [], entrance: { x: 13.5, w: 2 }, reception: null, plants: [] },
  build: (tex, size, opts) => buildHall(tex, { ...B17, ...size }, opts?.surroundings ?? true),
};
