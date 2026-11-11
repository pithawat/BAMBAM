import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคาร Riverside 3 (CR-031) from `9-อาคาร Riverside 3.pdf`: a pavilion — glass walls in red frames under a dark hipped roof, floor 2 smaller (10 × 10 m) over a 15 × 10 m ground floor. Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 3.6, overhang: 1.0, cladding: 0xeeeeea, frame: 0xa33a33,
  roof: { kind: "hip", rise: 2.2, color: 0x3b4045 },
  band: { y: 0.5, h: 2.6 }, upperWidth: 10,
  trees: [[-11, 4, 1], [11, -3, 1.1]],
};

/** CR-031 registry entry `b9`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 5, rows: [5, 5], core: () => [], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
