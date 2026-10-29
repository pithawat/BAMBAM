import type { BuildingModel } from "./model";

// CR-027 (D-124): `platform.buildings.model_key` → the procedural shape. Each shape is its own lazy
// chunk, downloaded only when that building is opened.

const MODELS: Record<string, () => Promise<BuildingModel>> = {
  b1: () => import("./building-one").then((m) => m.model),
  b2: () => import("./building-two").then((m) => m.model),
};

export const hasShape = (key: string | null | undefined): key is string => !!key && key in MODELS;

export function loadModel(key: string): Promise<BuildingModel> {
  const load = MODELS[key];
  if (!load) return Promise.reject(new Error(`no 3D shape "${key}"`));
  return load();
}
