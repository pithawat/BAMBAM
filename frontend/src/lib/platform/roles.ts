import type { Role } from "./types";

/** Role labels — docs/modules/repair/ui/screens/_common.md §2 (use exactly). */
export const ROLE_LABELS: Record<Role, string> = {
  employee: "พนักงานทั่วไป",
  housekeeper_lead: "หัวหน้าแม่บ้าน",
  security_lead: "หัวหน้ารปภ.",
  technician: "ช่างเทคนิค",
  admin: "Admin",
  executive: "ผู้บริหาร",
};

/** Initials for the avatar: first character of the first two name parts. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? "")
    .join("");
}
