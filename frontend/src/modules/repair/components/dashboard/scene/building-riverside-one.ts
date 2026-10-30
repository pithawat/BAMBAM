import * as THREE from "three";
import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคาร Riverside 1 (CR-031) from `7-อาคาร Riverside 1.pdf`: two storeys, white walls with window bands, a pale pitched roof and the green canopy walkway along the front; 24 × 8.5 m on 3 m bays (rows 2.5 + 3.5 + 2.5). Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 3.6, overhang: 0.9, cladding: 0xf3f3ef, frame: 0x2e3a33,
  roof: { kind: "gable", rise: 1.6, color: 0x9fb4bf, metal: true },
  band: { y: 1.0, h: 1.6 },
  accent: 0x2f7d4f,
  trees: [[-16, 6, 1], [16, 7, 1.1], [0, -9, 1]],
  extra: (s, p, accent) => {
    accent.push(new THREE.BoxGeometry(s.width + 2, 0.2, 2.6).translate(0, 2.9, s.depth / 2 + 1.5));
    for (let x = -s.width / 2; x <= s.width / 2 + 1e-3; x += 4) p.T.push(new THREE.BoxGeometry(0.15, 2.8, 0.15).translate(x, 1.4, s.depth / 2 + 2.6));
  },
};

/** CR-031 registry entry `b7`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 3, rows: [2.5, 3.5, 2.5], core: () => [{ label: "บันได", x: 0.2, z: 0.2, w: 2.6, d: 4, kind: "stairs" }], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
