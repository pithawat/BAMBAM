import * as THREE from "three";
import { bg, merged, mesh, planeUV, worldUV, type Textures } from "./kit";
import type { BuildingSize, FloorEntry } from "./model";
import { finishFloor, floorMats, newParts, trees, type Parts } from "./parts";

// Pieces shared by the low-rise office-side shapes (CR-030: อาคาร 3, 4, TrialMix, โรงอาหาร, ห้องประชุม 60 ปี):
// gable and hipped roofs, glass panes on one face, roller doors, wall AC units, angled wall pieces.
// Origin = footprint centre, Y up, metres; front = +z.

export function lowMats(tex: Textures) {
  return {
    roofMetal: new THREE.MeshStandardMaterial({ color: 0x8d989f, metalness: 0.55, roughness: 0.45, envMapIntensity: 0.8 }),
    roofTile: new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x6a7076, roughness: 0.8, envMapIntensity: 0.4 }),
    blue: new THREE.MeshStandardMaterial({ map: tex.concrete, color: 0x2f6fb5, roughness: 0.6, envMapIntensity: 0.6 }),
    door: new THREE.MeshStandardMaterial({ color: 0xb9bec2, metalness: 0.5, roughness: 0.5, envMapIntensity: 0.7 }),
  };
}

/** Gable roof with its ridge along x: two sloped sheets over W × D (+ overhang), bottom of the eaves at y. */
export function gableRoof(W: number, D: number, y: number, rise: number, oh: number, list: THREE.BufferGeometry[]) {
  const a = Math.atan(rise / (D / 2)), run = D / 2 + oh, L = run / Math.cos(a);
  for (const side of [1, -1]) {
    list.push(new THREE.BoxGeometry(W + 2 * oh, 0.12, L).rotateX(side * a)
      .translate(0, y + rise - (Math.tan(a) * run) / 2, (side * run) / 2));
  }
}

/** The triangular gable walls under a gableRoof (ridge along x), at both ends. */
export function gableEnds(W: number, D: number, y: number, rise: number, list: THREE.BufferGeometry[]) {
  const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
  for (const x of [-W / 2, W / 2 - 0.2]) {
    list.push(worldUV(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(x, y, 0)));
  }
}

/** Hipped roof over W × D (+ overhang), eaves at y, ridge `rise` higher along the long (x) side. */
export function hipRoof(W: number, D: number, y: number, rise: number, oh: number) {
  const ew = W / 2 + oh, ed = D / 2 + oh, rx = Math.max(0, ew - ed);
  const p = (x: number, yy: number, z: number) => [x, yy, z];
  const A = p(-ew, y, ed), B = p(ew, y, ed), C = p(ew, y, -ed), Dd = p(-ew, y, -ed), R1 = p(-rx, y + rise, 0), R2 = p(rx, y + rise, 0);
  const tris = [A, B, R2, A, R2, R1, C, Dd, R1, C, R1, R2, B, C, R2, Dd, A, R1].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((tris.length / 3) * 2).fill(0), 2));
  g.computeVertexNormals();
  return worldUV(g);
}

export type Face = "front" | "back" | "left" | "right";

/** A glass pane on one face of a W × D box, from a to b along that face (centred coordinates). */
export function pane(W: number, D: number, face: Face, a: number, b: number, y: number, h: number, list: THREE.BufferGeometry[], out = 0.03) {
  const len = b - a, m = (a + b) / 2, g = planeUV(len, h, Math.max(1, len / 16), 1, m * 0.07);
  if (face === "front") list.push(g.translate(m, y + h / 2, D / 2 + out));
  else if (face === "back") list.push(g.rotateY(Math.PI).translate(m, y + h / 2, -D / 2 - out));
  else if (face === "right") list.push(g.rotateY(Math.PI / 2).translate(W / 2 + out, y + h / 2, m));
  else list.push(g.rotateY(-Math.PI / 2).translate(-W / 2 - out, y + h / 2, m));
}

/** A roller door (slats as one box with a top housing) on the front or back face, centred at x. */
export function rollerDoor(D: number, face: "front" | "back", x: number, w: number, h: number, list: THREE.BufferGeometry[]) {
  const z = face === "front" ? D / 2 + 0.06 : -D / 2 - 0.06;
  list.push(bg(w, h, 0.08, x, 0, z), bg(w + 0.3, 0.4, 0.35, x, h, z));
}

/** Split-type AC condensers standing out of a wall at (x, z). */
export function acUnit(x: number, y: number, z: number, list: THREE.BufferGeometry[], alongX = true) {
  list.push(alongX ? bg(0.86, 0.62, 0.32, x, y, z) : bg(0.32, 0.62, 0.86, x, y, z));
}

/** A box piece from (x1, z1) to (x2, z2) at any angle, bottom at y, t thick. */
export function edgeBox(x1: number, z1: number, x2: number, z2: number, y: number, h: number, t: number) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  return new THREE.BoxGeometry(len, h, t).rotateY(-Math.atan2(z2 - z1, x2 - x1)).translate((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2);
}

/** Outward side of an outline's edges for edgePane: −1 when the shoelace sum (x right, z down) is positive. */
export const outward = (o: readonly (readonly [number, number])[]) =>
  o.reduce((a, [x, z], i) => a + x * o[(i + 1) % o.length][1] - o[(i + 1) % o.length][0] * z, 0) > 0 ? -1 : 1;

/** A glass pane from (x1, z1) to (x2, z2), `out` metres to the outside (`side` from `outward`). */
export function edgePane(x1: number, z1: number, x2: number, z2: number, y: number, h: number, out: number, side: number, list: THREE.BufferGeometry[]) {
  const len = Math.hypot(x2 - x1, z2 - z1), dx = (x2 - x1) / len, dz = (z2 - z1) / len;
  const th = -Math.atan2(dz, dx) + (side < 0 ? Math.PI : 0);
  const g = planeUV(len, h, Math.max(1, len / 16), 1, x1 * 0.05).rotateY(th);
  list.push(g.translate((x1 + x2) / 2 - dz * out * side, y + h / 2, (z1 + z2) / 2 + dx * out * side));
}

/** Ground, an asphalt apron around the footprint and a few trees (left out on the site view). */
export function apron(tex: Textures, W: number, D: number, treeAt: [number, number, number][]) {
  const g = new THREE.Group();
  g.add(mesh(planeUV(400, 400, 100, 100).rotateX(-Math.PI / 2).translate(0, -0.02, 0),
    new THREE.MeshStandardMaterial({ map: tex.grass, color: 0xa3ab97, roughness: 0.97, envMapIntensity: 0.25 }), false, true));
  const aw = W + 24, ad = D + 24;
  g.add(mesh(planeUV(aw, ad, aw / 6, ad / 6).rotateX(-Math.PI / 2).translate(0, 0, 3),
    new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.95, envMapIntensity: 0.3 }), false, true));
  trees(g, tex, treeAt);
  return g;
}

// ---- CR-031: one configurable low-rise shape for the Riverside buildings ----

export type LowRoof = { kind: "flat" | "gable" | "hip" | "mono" | "twin"; rise: number; color: number; metal?: boolean };

export type LowSpec = {
  floorHeight: number;
  overhang: number;
  cladding: number;
  frame: number;
  roof: LowRoof;
  /** Window band on every floor (height from the floor), or none for closed sheds. */
  band: { y: number; h: number } | null;
  /** Ground floor glazed across the front between these x (centred coordinates). */
  glassFront?: readonly [number, number];
  /** Floors above the first are this wide (centred), e.g. Riverside 3. */
  upperWidth?: number;
  /** Roller / plain doors on the ground floor. */
  doors?: readonly { face: "front" | "back"; x: number; w: number; h: number }[];
  /** Accent colour for `extra` pieces (canopies, screens, frames). */
  accent?: number;
  trees: [number, number, number][];
  /** Extra ground-floor pieces: `accent` gets the accent colour, `parts` the floor materials. */
  extra?: (s: LowSpec & BuildingSize, parts: Parts, accent: THREE.BufferGeometry[]) => void;
};

export function buildLow(tex: Textures, s: LowSpec & BuildingSize, surroundings = true) {
  const { width: W, depth: D, floorHeight: FH, overhang: OH, floors: NF } = s;
  const root = new THREE.Group();
  if (surroundings) root.add(apron(tex, W, D, s.trees));
  const L = lowMats(tex);
  const floors: FloorEntry[] = [];
  for (let f = 1; f <= NF; f++) {
    const M = floorMats(tex, s.cladding, s.frame), g = new THREE.Group(), parts = newParts();
    const Wf = f > 1 && s.upperWidth ? s.upperWidth : W, y0 = (f - 1) * FH;
    parts.C.push(bg(Wf + 0.3, 0.3, D + 0.3, 0, y0, 0), bg(Wf, FH - 0.3, D, 0, y0 + 0.3, 0));
    if (s.band) {
      const y = y0 + s.band.y, h = s.band.h;
      for (const face of ["front", "back"] as const) pane(Wf, D, face, -Wf / 2 + 0.8, Wf / 2 - 0.8, y, h, parts.G);
      for (const face of ["left", "right"] as const) pane(Wf, D, face, -D / 2 + 0.8, D / 2 - 0.8, y, h, parts.G);
      for (let x = -Wf / 2 + 0.8; x <= Wf / 2 - 0.8 + 1e-3; x += 2.5) parts.T.push(bg(0.07, h, 0.1, x, y, D / 2 + 0.05), bg(0.07, h, 0.1, x, y, -D / 2 - 0.05));
    }
    if (f === 1) {
      if (s.glassFront) {
        const [a, b] = s.glassFront;
        pane(W, D, "front", a, b, 0.4, FH - 1.2, parts.G, 0.06);
        for (let x = a; x <= b + 1e-3; x += 1.5) parts.T.push(bg(0.08, FH - 1.2, 0.1, x, 0.4, D / 2 + 0.07));
      }
      const doors: THREE.BufferGeometry[] = [], accent: THREE.BufferGeometry[] = [];
      for (const d of s.doors ?? []) rollerDoor(D, d.face, d.x, d.w, d.h, doors);
      s.extra?.(s, parts, accent);
      if (doors.length) g.add(merged(doors, L.door));
      if (accent.length) g.add(merged(accent.map((x) => worldUV(x)), new THREE.MeshStandardMaterial({ map: tex.concrete, color: s.accent ?? 0x2f6fb5, roughness: 0.6 })));
    }
    const e = finishFloor({ ...s, width: Wf }, f, y0, g, M, parts);
    floors.push(e);
    root.add(e.group);
  }

  const roof = new THREE.Group(), sheets: THREE.BufferGeometry[] = [], ends: THREE.BufferGeometry[] = [];
  const Wt = NF > 1 && s.upperWidth ? s.upperWidth : W, yR = NF * FH, r = s.roof;
  if (r.kind === "flat") {
    sheets.push(bg(Wt + 2 * OH, 0.35, D + 2 * OH, 0, yR, 0));
    ends.push(bg(Wt + 0.3, 0.7, D + 0.3, 0, yR - 0.2, 0));
  } else if (r.kind === "gable") {
    gableRoof(Wt, D, yR, r.rise, OH, sheets);
    gableEnds(Wt, D, yR, r.rise, ends);
  } else if (r.kind === "twin") {
    for (const z of [-D / 4, D / 4]) {
      const a: THREE.BufferGeometry[] = [], b: THREE.BufferGeometry[] = [];
      gableRoof(Wt, D / 2, yR, r.rise, OH / 2, a);
      gableEnds(Wt, D / 2, yR, r.rise, b);
      for (const x of a) sheets.push(x.translate(0, 0, z));
      for (const x of b) ends.push(x.translate(0, 0, z));
    }
  } else if (r.kind === "hip") {
    sheets.push(hipRoof(Wt, D, yR, r.rise, OH));
  } else {
    // mono-pitch: one sheet rising to the back, filled under with a wedge wall
    const a = Math.atan(r.rise / D), L2 = (D + 2 * OH) / Math.cos(a);
    sheets.push(new THREE.BoxGeometry(Wt + 2 * OH, 0.2, L2).rotateX(a).translate(0, yR + r.rise / 2, 0));
    const wedge = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(D / 2, r.rise)]);
    for (const x of [-Wt / 2, Wt / 2 - 0.2]) ends.push(worldUV(new THREE.ExtrudeGeometry(wedge, { depth: 0.2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(x, yR, 0)));
  }
  const roofMat = new THREE.MeshStandardMaterial({ map: r.metal ? null : tex.concrete, color: r.color, metalness: r.metal ? 0.55 : 0, roughness: r.metal ? 0.45 : 0.8, envMapIntensity: 0.6 });
  roof.add(merged(sheets.map((x) => (x.attributes.uv ? x : worldUV(x))), roofMat));
  if (ends.length) roof.add(merged(ends.map((x) => worldUV(x)), new THREE.MeshStandardMaterial({ map: tex.concrete, color: s.cladding, roughness: 0.93 })));
  root.add(roof);
  return { root, floors, roof };
}
