import type { PlanPoint, PlanRoom, PlanShape } from "./types";

// Floor plan geometry (CR-016) — the same rules as the backend (rules.go `roomAt`, BR-F31-3), so the
// UI highlights the room the server will accept. Metres, origin = plan top-left, x right, z down.

/** Ray casting; a point on an edge counts as inside. */
export function pointInShape(x: number, z: number, shape: PlanShape): boolean {
  const eps = 1e-9;
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, zi] = shape[i];
    const [xj, zj] = shape[j];
    const cross = (x - xj) * (zi - zj) - (z - zj) * (xi - xj);
    if (Math.abs(cross) < eps && x >= Math.min(xi, xj) - eps && x <= Math.max(xi, xj) + eps
      && z >= Math.min(zi, zj) - eps && z <= Math.max(zi, zj) + eps) return true;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Shoelace area in m². */
export function shapeArea(shape: PlanShape): number {
  let sum = 0;
  for (let i = 0; i < shape.length; i++) {
    const [x1, z1] = shape[i];
    const [x2, z2] = shape[(i + 1) % shape.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

/** The smallest room whose outline contains the point (ห้องน้ำ wins over the common area around it); null outside every room. */
export function roomAt<R extends Pick<PlanRoom, "shape">>(x: number, z: number, rooms: R[]): R | null {
  let best: R | null = null;
  let bestArea = Infinity;
  for (const r of rooms) {
    if (!r.shape || r.shape.length < 3 || !pointInShape(x, z, r.shape)) continue;
    const a = shapeArea(r.shape);
    if (a < bestArea) {
      best = r;
      bestArea = a;
    }
  }
  return best;
}

/**
 * A point well inside the room (label, pin, default asset position when the room is picked from a list).
 * The centroid for convex rooms; for L-shaped ones (common areas) the grid point farthest from the edges
 * that the room really owns (not inside a smaller room).
 */
export function roomCenter(room: Pick<PlanRoom, "shape">, rooms: Pick<PlanRoom, "shape">[] = []): PlanPoint | null {
  const shape = room.shape;
  if (!shape || shape.length < 3) return null;
  const owns = (x: number, z: number) => pointInShape(x, z, shape) && roomAt(x, z, [room, ...rooms]) === room;
  const others = rooms.filter((r) => r !== room && r.shape && r.shape.length >= 3).map((r) => r.shape!);
  const clearance = (p: PlanPoint) => Math.min(edgeDistance(p, shape), ...others.map((s) => edgeDistance(p, s)));
  const c = centroid(shape);
  if (owns(c[0], c[1]) && clearance(c) >= 0.5) return c;
  const xs = shape.map((p) => p[0]);
  const zs = shape.map((p) => p[1]);
  let best: PlanPoint | null = null;
  let bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) {
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.25) {
      if (!owns(x, z)) continue;
      const d = clearance([x, z]);
      if (d > bestD) {
        bestD = d;
        best = [x, z];
      }
    }
  }
  return best ?? c;
}

function centroid(shape: PlanShape): PlanPoint {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < shape.length; i++) {
    const [x1, z1] = shape[i];
    const [x2, z2] = shape[(i + 1) % shape.length];
    const f = x1 * z2 - x2 * z1;
    a += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  if (Math.abs(a) < 1e-9) return shape[0];
  return [cx / (3 * a), cz / (3 * a)];
}

function edgeDistance([x, z]: PlanPoint, shape: PlanShape): number {
  let d = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const [x1, z1] = shape[i];
    const [x2, z2] = shape[(i + 1) % shape.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = dx * dx + dz * dz;
    const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len)) : 0;
    d = Math.min(d, Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)));
  }
  return d;
}
