import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// CPAC Warehouse 2 (CR-031) from `12-อาคาร CPAC Warehouse 2.pdf` (photo shared with Warehouse 3): a gable shed with a large roller door; 40 × 15 m on 5 m bays. Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 7, overhang: 0.8, cladding: 0xe9e7df, frame: 0x4b5258,
  roof: { kind: "gable", rise: 1.8, color: 0x8d989f, metal: true },
  band: { y: 5.2, h: 0.9 },
  doors: [{ face: "front", x: 6, w: 6, h: 5.5 }],
  trees: [[-25, 4, 1], [25, -4, 1]],
};

/** CR-031 registry entry `b12`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 5, rows: [5, 5, 5], core: () => [], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
