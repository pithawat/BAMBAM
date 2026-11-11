import * as THREE from "three";
import { bg, leafClusters, merged, planeUV, worldUV, type Textures } from "./kit";
import type { FloorEntry } from "./model";

// Pieces shared by the building shapes (moved out of building-one.ts for CR-027): floor materials, glass
// bands with mullions, the floor pick shell, merged floor groups and trees.

export type Parts = { C: THREE.BufferGeometry[]; G: THREE.BufferGeometry[]; T: THREE.BufferGeometry[]; L: THREE.BufferGeometry[] };

export const newParts = (): Parts => ({ C: [], G: [], T: [], L: [] });

/** Concrete (C), glass (G), frame metal (T), light metal (L) of one floor; the concrete one glows per step. */
export function floorMats(tex: Textures, cladding: number, frame: number) {
  return {
    c: new THREE.MeshStandardMaterial({ map: tex.concrete, color: cladding, roughness: 0.93, envMapIntensity: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ map: tex.interior, roughness: 0.05, metalness: 0.25, envMapIntensity: 1.4 }),
    metal: new THREE.MeshStandardMaterial({ color: frame, metalness: 0.75, roughness: 0.35, envMapIntensity: 0.9 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd2d5d3, metalness: 0.3, roughness: 0.55, envMapIntensity: 0.7 }),
  };
}

export type FloorMats = ReturnType<typeof floorMats>;

export function glassBox(W: number, D: number, y: number, h: number, inset: number, list: THREE.BufferGeometry[], uOff: number) {
  list.push(planeUV(W, h, W / 16, 1, uOff).translate(0, y + h / 2, D / 2 + inset));
  list.push(planeUV(W, h, W / 16, 1, uOff + 0.31).rotateY(Math.PI).translate(0, y + h / 2, -D / 2 - inset));
  list.push(planeUV(D, h, D / 16, 1, uOff + 0.57).rotateY(Math.PI / 2).translate(W / 2 + inset, y + h / 2, 0));
  list.push(planeUV(D, h, D / 16, 1, uOff + 0.83).rotateY(-Math.PI / 2).translate(-W / 2 - inset, y + h / 2, 0));
}

export function mullionGrid(W: number, D: number, y: number, h: number, step: number, list: THREE.BufferGeometry[], out = 0.05) {
  const dpt = 0.1;
  for (let x = -W / 2; x <= W / 2 + 1e-3; x += step) list.push(bg(0.07, h, dpt, x, y, D / 2 + out), bg(0.07, h, dpt, x, y, -D / 2 - out));
  for (let z = -D / 2 + step; z < D / 2 - 1e-3; z += step) list.push(bg(dpt, h, 0.07, W / 2 + out, y, z), bg(dpt, h, 0.07, -W / 2 - out, y, z));
  for (const yy of [y, y + h * 0.68, y + h - 0.06]) {
    list.push(bg(W, 0.06, dpt, 0, yy, D / 2 + out), bg(W, 0.06, dpt, 0, yy, -D / 2 - out));
    list.push(bg(dpt, 0.06, D, W / 2 + out, yy, 0), bg(dpt, 0.06, D, -W / 2 - out, yy, 0));
  }
}

type ShellSize = { width: number; depth: number; floorHeight: number; overhang: number };

function makeShell(s: ShellSize, level: number, y0: number) {
  const OH = s.overhang;
  const geo = new THREE.BoxGeometry(s.width + 2 * OH + 0.5, s.floorHeight - 0.04, s.depth + 2 * OH + 0.5);
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  shell.position.set(0, y0 + s.floorHeight / 2, 0);
  shell.userData = { level, noFade: true }; // keeps its own opacity while the floor fades
  shell.renderOrder = 5;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  edges.position.copy(shell.position);
  edges.renderOrder = 6;
  edges.visible = false;
  return { shell, edges };
}

/** Merges the floor's parts (one draw call per material) and adds its pick shell. */
export function finishFloor(s: ShellSize, level: number, y0: number, g: THREE.Group, M: FloorMats, parts: Parts): FloorEntry {
  if (parts.C.length) g.add(merged(parts.C.map((x) => worldUV(x)), M.c));
  if (parts.G.length) g.add(merged(parts.G, M.glass, false, true));
  if (parts.T.length) g.add(merged(parts.T, M.metal));
  if (parts.L.length) g.add(merged(parts.L, M.light));
  const { shell, edges } = makeShell(s, level, y0);
  g.add(shell, edges);
  return { level, group: g, glowMat: M.c, shell, edges };
}

export function trees(parent: THREE.Object3D, tex: Textures, list: [number, number, number][]) {
  const trunks: THREE.BufferGeometry[] = [];
  const crowns: [number, number, number, number, number][] = [];
  const bark = new THREE.MeshStandardMaterial({ color: 0x5d5044, roughness: 0.95 });
  for (const [x, z, s] of list) {
    trunks.push(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 3.4 * s, 7).translate(x, 1.7 * s, z));
    crowns.push([x, 4.4 * s, z, 2.6 * s, 34], [x + 0.9 * s, 3.6 * s, z + 0.4 * s, 1.7 * s, 16], [x - 0.8 * s, 3.8 * s, z - 0.5 * s, 1.8 * s, 16]);
  }
  parent.add(merged(trunks, bark));
  leafClusters(parent, tex, crowns);
}
