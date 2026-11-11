import type * as THREE from "three";
import type { PlanShape } from "../../../types";
import type { Textures } from "./kit";

// CR-027: what the engine needs from a building shape. Each shape lives in its own file and is loaded
// with import() through `registry.ts`, so only the building on screen is downloaded and built.

/** Toilets, stairs, A.H.U., lift drawn on the floor plan (plan coordinates, metres, top-left origin). */
export type CoreItem = { label: string; x: number; z: number; w: number; d: number; kind: "tile" | "stairs" | "plain" | "lift" };

/** Floor-plan furniture of a shape: structural grid, core per floor, ground-floor entrance and counter. */
export type PlanSpec = {
  /** Column spacing along the width (m). */
  bay: number;
  /** Row depths front to back (m), e.g. 6 + 3 + 6. */
  rows: readonly number[];
  core: (level: number) => readonly CoreItem[];
  /** Gap in the front facade of the ground floor. */
  entrance: { x: number; w: number } | null;
  reception: { x: number; z: number; w: number; d: number } | null;
  /** Potted plants (plan coordinates). */
  plants: readonly (readonly [number, number])[];
  /** CR-030: footprint polygons of the floor when it is not the whole W × D box (canteen, TrialMix + lab). */
  outline?: (level: number) => readonly PlanShape[];
};

/** Size from #27 (floors, plan footprint in metres). */
export type BuildingSize = { floors: number; width: number; depth: number };

export type FloorEntry = {
  level: number;
  group: THREE.Group;
  /** Concrete material: its emissive shows the floor's step colour. */
  glowMat: THREE.MeshStandardMaterial;
  /** Invisible pick box + outline used for hover / step highlight. */
  shell: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
};

export type BuiltBuilding = { root: THREE.Group; floors: FloorEntry[]; roof: THREE.Group };

export type BuildingModel = {
  floorHeight: number;
  /** How far balconies / fins stand out of the footprint (pick boxes, floor badges, camera fit). */
  overhang: number;
  plan: PlanSpec;
  /** `surroundings: false` (CR-028 site view) leaves out the ground, parking, cars and trees around it. */
  build: (tex: Textures, size: BuildingSize, opts?: { surroundings?: boolean }) => BuiltBuilding;
};
