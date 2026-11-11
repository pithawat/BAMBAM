import * as THREE from "three";
import type { BuildingModel } from "./model";
import { buildLow, type LowSpec } from "./lowrise";

// อาคารโรงเรือน CPAC (CR-031) from `18-อาคารโรงเรือนซีแพค.pdf`: a long white single-storey shed with a blue steel frame and a light gable roof; 36.1 × 16.5 m. Built by the shared low-rise shape (`lowrise.ts`).

const SPEC: LowSpec = {
  floorHeight: 4.5, overhang: 0.6, cladding: 0xf4f4f1, frame: 0x2f6fb5,
  roof: { kind: "gable", rise: 1.5, color: 0xd9dcdc, metal: true },
  band: { y: 2.6, h: 1.2 },
  accent: 0x2f6fb5,
  trees: [[-22, 4, 1], [22, -5, 1.1]],
  extra: (s, _p, accent) => {
    for (let x = -s.width / 2; x <= s.width / 2 + 1e-3; x += 6) {
      for (const z of [s.depth / 2 + 0.15, -s.depth / 2 - 0.15]) accent.push(new THREE.BoxGeometry(0.25, s.floorHeight, 0.25).translate(x, s.floorHeight / 2, z));
    }
  },
};

/** CR-031 registry entry `b18`. */
export const model: BuildingModel = {
  floorHeight: SPEC.floorHeight,
  overhang: SPEC.overhang,
  plan: { bay: 6.02, rows: [7.2, 4.171, 5.129], core: () => [], entrance: null, reception: null, plants: [] },
  build: (tex, size, opts) => buildLow(tex, { ...SPEC, ...size }, opts?.surroundings ?? true),
};
