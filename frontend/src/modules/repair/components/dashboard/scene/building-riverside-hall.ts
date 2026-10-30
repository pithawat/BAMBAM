import * as THREE from "three";
import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคาร Riverside อเนกประสงค์ (CR-031) from `6-อาคาร Riverside อเนกประสงค์.pdf`: single storey, flat roof with a green fascia, glazed front to the meeting rooms; 32 × 20 m on 8 m bays (rows 10 + 2 + 8). Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 4.2, overhang: 0.8, cladding: 0xf2f1ec, frame: 0x30363c,
  roof: { kind: "flat", rise: 0, color: 0x5c8f58 },
  band: { y: 1.0, h: 2.0 }, glassFront: [-15, -1],
  accent: 0x5c8f58,
  trees: [[-21, 4, 1.1], [21, 6, 1], [-6, 15, 1], [9, 15, 1.1]],
  extra: (s, _p, accent) => {
    for (const z of [s.depth / 2 + 0.85, -s.depth / 2 - 0.85]) accent.push(new THREE.BoxGeometry(s.width + 1.7, 0.6, 0.1).translate(0, s.floorHeight + 0.3, z));
  },
};

/** CR-031 registry entry `b6`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 8, rows: [10, 2, 8], core: () => [{ label: "ห้องน้ำ", x: 24.2, z: 10.2, w: 7.6, d: 9.6, kind: "tile" }], entrance: { x: 13, w: 3 }, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
