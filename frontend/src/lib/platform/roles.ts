/** Initials for the avatar: first character of the first two name parts. Role labels come from `Me.roleName`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? "")
    .join("");
}
