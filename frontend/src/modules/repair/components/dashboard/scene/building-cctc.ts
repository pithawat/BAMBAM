import * as THREE from "three";
import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคาร CCTC (CR-031) from `10-อาคาร CCTC.pdf`: two storeys of grey walls with window bands under a big dark mono-pitch roof, the red perforated screen at the east end; 48 × 17.7 m on 6 m bays (rows 5.7 + 6.3 + 5.7). Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 4.2, overhang: 1.4, cladding: 0xd9dbdc, frame: 0x2f3439,
  roof: { kind: "mono", rise: 3.2, color: 0x33383d },
  band: { y: 1.1, h: 1.8 },
  accent: 0xb1332e,
  trees: [[-30, 6, 1.1], [30, -6, 1], [-8, 15, 1]],
  extra: (s, _p, accent) => {
    accent.push(new THREE.BoxGeometry(0.3, s.floors * s.floorHeight - 0.4, s.depth * 0.7).translate(s.width / 2 + 0.3, (s.floors * s.floorHeight) / 2, 0));
  },
};

/** CR-031 registry entry `b10`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 6, rows: [5.7, 6.3, 5.7], core: () => [{ label: "บันได", x: 12.2, z: 12.2, w: 2.6, d: 5.2, kind: "stairs" }], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
