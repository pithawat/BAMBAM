import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildGround } from "./site-ground";

// S29 site view (CR-027, D-124 / D-126, CR-028): the building frames of one side of the campus as
// low-poly boxes, all merged into ONE vertex-coloured mesh (one draw call), no textures, no shadows.
// Blocks with a model shape (อาคาร 1 / 2) are left empty here — the engine places their real model. Picking is analytic (ray vs each block's oriented box), the hover outline is one
// reused line box, and the open-ticket markers are HTML chips placed by the engine.

export type SiteBlockSpec = {
  id: string;
  x: number;
  z: number;
  rotDeg: number;
  width: number;
  depth: number;
  storeys: number;
  /** A registered model shape (`b1`, `b2`): the engine draws the real model instead of a box. */
  modelKey: string | null;
  /** Opens a building (has floors): drawn in the light colour. */
  linked: boolean;
};

export type BuiltSite = {
  group: THREE.Group;
  bounds: THREE.Sphere;
  /** Block under the ray, or null. */
  pick: (ray: THREE.Ray) => string | null;
  /** Outline one block (null hides it). */
  outline: (id: string | null) => void;
};

const STOREY = 3.5;
const COLOR = { linked: 0xf3f1ea, plain: 0xc3c7cc, roof: 0x8d939a };

type Box = { w: number; h: number; d: number; x: number; y: number; z: number; color: number };

/** Boxes in block-local space (origin = footprint centre on the ground, x along the long side). A block
 * with a model shape gets none: the engine places the real model there (CR-028). */
function massing(b: SiteBlockSpec): Box[] {
  if (b.modelKey) return [];
  const h = b.storeys * STOREY, base = b.linked ? COLOR.linked : COLOR.plain;
  return [{ w: b.width, h, d: b.depth, x: 0, y: 0, z: 0, color: base }, { w: b.width + 0.4, h: 0.4, d: b.depth + 0.4, x: 0, y: h, z: 0, color: COLOR.roof }];
}

const height = (b: SiteBlockSpec) => b.storeys * (b.modelKey === "b2" ? 3.6 : STOREY) + (b.modelKey ? 2 : 0.4);

/** World point above a block's roof (its marker chip). */
export const siteAnchor = (b: SiteBlockSpec): [number, number, number] => [b.x, height(b) + 2, b.z];

export function buildSite(blocks: SiteBlockSpec[]): BuiltSite {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const placed = blocks.map((b) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (-b.rotDeg * Math.PI) / 180), new THREE.Vector3(1, 1, 1));
    for (const p of massing(b)) {
      const g = new THREE.BoxGeometry(p.w, p.h, p.d).translate(p.x, p.y + p.h / 2, p.z).applyMatrix4(m);
      col.setHex(p.color);
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      geos.push(g);
    }
    const h = height(b);
    return { b, inv: m.clone().invert(), box: new THREE.Box3(new THREE.Vector3(-b.width / 2 - 1, 0, -b.depth / 2 - 1), new THREE.Vector3(b.width / 2 + 1, h, b.depth / 2 + 1)), m, h };
  });
  if (geos.length) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })));
  }

  const bounds = new THREE.Box3();
  for (const p of placed) bounds.union(p.box.clone().applyMatrix4(p.m));
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 10, 50));
  group.add(buildGround(bounds)); // CR-032: roads, walkways, car parks of this side (2 draw calls)
  const center = bounds.getCenter(new THREE.Vector3());
  group.add(new THREE.Mesh( // far past the view: the fog blends its edge into the background
    new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2).translate(center.x, -0.02, center.z),
    new THREE.MeshStandardMaterial({ color: 0xdde3d6, roughness: 1 }),
  ));

  const unit = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const hover = new THREE.LineSegments(unit, new THREE.LineBasicMaterial({ color: 0x2741fa, depthTest: false, transparent: true }));
  hover.visible = false;
  hover.renderOrder = 5;
  group.add(hover);

  const local = new THREE.Ray(), hit = new THREE.Vector3(), world = new THREE.Vector3();
  return {
    group,
    bounds: bounds.getBoundingSphere(new THREE.Sphere()),
    pick(ray) {
      let best: string | null = null, dist = Infinity;
      for (const p of placed) {
        local.copy(ray).applyMatrix4(p.inv);
        if (!local.intersectBox(p.box, hit)) continue;
        const d = world.copy(hit).applyMatrix4(p.m).distanceTo(ray.origin);
        if (d < dist) { dist = d; best = p.b.id; }
      }
      return best;
    },
    outline(id) {
      const p = placed.find((q) => q.b.id === id);
      hover.visible = !!p;
      if (!p) return;
      hover.position.set(p.b.x, 0, p.b.z);
      hover.rotation.set(0, (-p.b.rotDeg * Math.PI) / 180, 0);
      hover.scale.set(p.b.width + 1, p.h, p.b.depth + 1);
    },
  };
}

/**
 * Light version of a real model for the site view (CR-030 follow-up, owner 2026-10-29): leaf cards dropped,
 * every single-material mesh baked to world space and merged per material look (colour + texture +
 * transparency) — a handful of draw calls per building instead of ~25. Multi-material and instanced meshes
 * stay as they are. The opened building keeps the full version.
 */
export function simplifyForSite(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    drop.push(m);
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!m.visible || mat.alphaTest > 0) return; // hidden pick shells, leaf cards
    const key = [mat.type, mat.color?.getHexString(), mat.map?.uuid, mat.transparent, mat.opacity, mat.emissiveMap?.uuid].join("|");
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) return;
    const g = groups.get(key) ?? { mat, geos: [] };
    g.geos.push(geo);
    groups.set(key, g);
  });
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const o of drop) {
    o.removeFromParent();
    (o as THREE.Mesh).geometry.dispose();
  }
  const usedMats = new Set([...groups.values()].map((g) => g.mat));
  for (const o of drop) {
    const mat = (o as THREE.Mesh).material as THREE.Material;
    if (!usedMats.has(mat)) mat.dispose();
  }
  for (const { mat, geos } of groups.values()) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    root.add(new THREE.Mesh(merged.applyMatrix4(inv), mat));
  }
  // empty groups (floors, roof) and line helpers are left; they draw nothing
  root.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) o.visible = false; });
}
