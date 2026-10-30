import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// CPAC Warehouse 1 (3D print) (CR-031) from `11-อาคาร CPAC Warehouse 1.pdf`: a long shed with a metal gable roof and roller doors to the loading apron at the front; 68.5 × 15 m on 5 m bays. Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 7, overhang: 0.8, cladding: 0xe7e6e0, frame: 0x4b5258,
  roof: { kind: "gable", rise: 1.6, color: 0x8d989f, metal: true },
  band: { y: 5.2, h: 0.9 },
  doors: [-22, -10, 6, 20].map((x) => ({ face: "front" as const, x, w: 5, h: 5 })),
  trees: [[-40, 4, 1], [40, -4, 1.1]],
};

/** CR-031 registry entry `b11`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 5, rows: [5, 5, 5], core: () => [], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
