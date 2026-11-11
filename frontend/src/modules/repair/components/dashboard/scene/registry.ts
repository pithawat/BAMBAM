import type { BuildingModel } from "./model";

// CR-027 (D-124): `platform.buildings.model_key` → the procedural shape. Each shape is its own lazy
// chunk, downloaded only when that building is opened.

const MODELS: Record<string, () => Promise<BuildingModel>> = {
  b1: () => import("./building-one").then((m) => m.model),
  b2: () => import("./building-two").then((m) => m.model),
  // CR-030: the office-side buildings
  b3: () => import("./building-three").then((m) => m.model),
  b4: () => import("./building-four").then((m) => m.model),
  b5: () => import("./building-trialmix").then((m) => m.model),
  b16: () => import("./building-canteen").then((m) => m.model),
  b17: () => import("./building-hall60").then((m) => m.model),
  // CR-031: the Riverside buildings
  b6: () => import("./building-riverside-hall").then((m) => m.model),
  b7: () => import("./building-riverside-one").then((m) => m.model),
  b8: () => import("./building-riverside-two").then((m) => m.model),
  b9: () => import("./building-riverside-three").then((m) => m.model),
  b10: () => import("./building-cctc").then((m) => m.model),
  b11: () => import("./building-warehouse-one").then((m) => m.model),
  b12: () => import("./building-warehouse-two").then((m) => m.model),
  b13: () => import("./building-warehouse-three").then((m) => m.model),
  b18: () => import("./building-greenhouse").then((m) => m.model),
};

export const hasShape = (key: string | null | undefined): key is string => !!key && key in MODELS;

export function loadModel(key: string): Promise<BuildingModel> {
  const load = MODELS[key];
  if (!load) return Promise.reject(new Error(`no 3D shape "${key}"`));
  return load();
}
