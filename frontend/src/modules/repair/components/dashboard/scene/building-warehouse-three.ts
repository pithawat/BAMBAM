import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// CPAC Warehouse 3 (CR-031) from `13-อาคาร CPAC Warehouse 3.pdf`: a big twin-gable shed with loading doors on the front; 80 × 40 m on 10 m bays (owner: plan size, D-131). Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 8, overhang: 1.0, cladding: 0xe6e4dc, frame: 0x4b5258,
  roof: { kind: "twin", rise: 2.4, color: 0x8d989f, metal: true },
  band: { y: 6, h: 1.0 },
  doors: [-30, -10, 15, 32].map((x) => ({ face: "front" as const, x, w: 6, h: 6 })),
  trees: [[-46, 10, 1.1], [46, -10, 1]],
};

/** CR-031 registry entry `b13`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 10, rows: [10, 10, 10, 10], core: () => [{ label: "ห้องน้ำ", x: 40.2, z: 0.2, w: 9.6, d: 9.6, kind: "tile" }], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
