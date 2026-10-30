import * as THREE from "three";
import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคาร Riverside 2 (CR-031) from `8-อาคาร Riverside 2.pdf`: two storeys, a low blue pitched roof, glazed entrance porch at the front (plan x 10–13), stairs at grid D (x 16–17.6, z 5.3–8.6) on both floors; 26 × 12.6 m (bays 5 / 5 / 6 / 5 / 5, rows 3.45 + 1.8 + 3.45 + 3.9). Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 3.6, overhang: 1.0, cladding: 0xf1f1ec, frame: 0x2f3439,
  roof: { kind: "gable", rise: 1.4, color: 0x3f6fa8, metal: true },
  band: { y: 1.0, h: 1.6 },
  accent: 0x3f6fa8,
  trees: [[-18, 5, 1], [18, 4, 1.1], [-8, 12, 1], [10, 12, 0.9]],
  extra: (s, p, accent) => {
    const x = 11.5 - s.width / 2;
    p.G.push(new THREE.PlaneGeometry(3, 2.6).translate(x, 1.6, s.depth / 2 + 2.2));
    accent.push(new THREE.BoxGeometry(4, 0.25, 2.6).translate(x, 3.1, s.depth / 2 + 1.1));
  },
};

/** CR-031 registry entry `b8`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 5, rows: [3.45, 1.8, 3.45, 3.9], core: () => [{ label: "บันได", x: 16.1, z: 5.3, w: 1.6, d: 3.3, kind: "stairs" }], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
