import type { LabelStatus } from "./types";

// QR labels (settings CR-007, repair CR-036 / F13-A, Stage 5B): the text and link printed on a label, shared by S30 and S20.
// Claude owns this file.

/** S30 route; `?building=&floor=&room=&assets=` preselects (S20 entry points). */
export const LABELS_PATH = "/settings/buildings/labels";

/** S30 heading (screen spec copy). */
export const LABELS_HEADING = { title: "พิมพ์ป้าย QR", subtitle: "เลือกอุปกรณ์ที่ต้องการ แล้วพิมพ์ป้ายลงกระดาษ A4 (12 ดวงต่อแผ่น)" };

/** A4 portrait 3 × 4 (S30). */
export const LABELS_PER_PAGE = 12;

export const pagesFor = (count: number) => Math.ceil(count / LABELS_PER_PAGE);

/**
 * BR-F13A-1 short location: a building name starting with "อาคาร " becomes "อ." + the rest ("อาคาร 1" → "อ.1"), other names
 * stay; then "ชั้น {floor name}" and the room name in full — e.g. `อ.1 · ชั้น 5 · ห้องประชุม 5B`.
 */
export function shortLocation(p: { building: { name: string }; floor: { name: string }; room: { name: string } }): string {
  const b = p.building.name.trim();
  const building = b.startsWith("อาคาร ") ? `อ.${b.slice("อาคาร ".length).trim()}` : b;
  return `${building} · ชั้น ${p.floor.name} · ${p.room.name}`;
}

/** What the QR encodes: `{FRONTEND_URL}/q/{code}` (repair #25 route handler redirects to the prefilled S03). */
export function labelQrUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/q/${encodeURIComponent(code)}`;
}

/** S20 / S30 badge copy per `labelStatus`; `current` has none. */
export const LABEL_BADGE: Record<LabelStatus, { text: string; tone: "warning" | "muted" } | null> = {
  moved: { text: "ย้ายแล้ว ควรพิมพ์ป้ายใหม่", tone: "warning" },
  changed: { text: "ข้อมูลบนป้ายเปลี่ยน ควรพิมพ์ใหม่", tone: "warning" },
  never: { text: "ยังไม่เคยพิมพ์ป้าย", tone: "muted" },
  current: null,
};

/** S30 filter "ควรพิมพ์ใหม่" = the label no longer matches. */
export const needsReprint = (s: LabelStatus) => s === "moved" || s === "changed";

/** S30 link with a preselection (S20 row menu / room heading). */
export function labelsHref(sel: { building?: string; floor?: string; room?: string; assets?: string[] }): string {
  const params = new URLSearchParams();
  if (sel.building) params.set("building", sel.building);
  if (sel.floor) params.set("floor", sel.floor);
  if (sel.room) params.set("room", sel.room);
  if (sel.assets?.length) params.set("assets", sel.assets.join(","));
  return params.size ? `${LABELS_PATH}?${params}` : LABELS_PATH;
}
