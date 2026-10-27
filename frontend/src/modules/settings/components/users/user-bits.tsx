"use client";

import { Lock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Small pieces shared by S25 (and S26 actors): initials avatar, last-login lines, role-lock copy.

/** First letter of the first and last name (Thai as written), e.g. "ณัฐพล อินทรวงศ์" → "ณอ". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Initials({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground",
        size === "lg" ? "size-14 text-base" : "size-10 text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}

/** "26 ต.ค. 2569" and "09:12" (list date format, repair _common.md §3); null → "—". */
export function dateAndTime(iso: string | null): [string, string] | null {
  if (!iso) return null;
  const s = formatDateTime(iso);
  const i = s.lastIndexOf(" ");
  return [s.slice(0, i), s.slice(i + 1)];
}

export const LOCK_COPY = {
  SELF: "เปลี่ยน Role ของตัวเองไม่ได้",
  LOCKED_BY_ENV: "Role นี้กำหนดโดยระบบ (ตั้งค่าใน server)",
} as const;

export function FixedRoleNote({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Lock className="size-3" aria-hidden />
      กำหนดโดยระบบ
    </span>
  );
}
