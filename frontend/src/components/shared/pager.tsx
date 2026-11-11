"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-side list paging (repair S06, S09 / S18 since CR-042): page numbers around the current page (first and last
 * always, "…" for gaps) with previous / next. The caller fetches the page from the API; this only picks the number.
 */
export function Pager({ page, pages, onPage, className }: { page: number; pages: number; onPage: (p: number) => void; className?: string }) {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const cell = "grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30";
  return <nav aria-label="เลือกหน้า" className={cn("flex items-center gap-1", className)}>
    {pages > 1 && <button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(cell, "text-muted-foreground hover:bg-muted disabled:opacity-40")}><ChevronLeft className="size-4" aria-hidden /></button>}
    {shown.map((p, i) => <span key={p} className="flex items-center gap-1">
      {i > 0 && p - shown[i - 1] > 1 && <span aria-hidden className="px-1 text-muted-foreground">…</span>}
      <button type="button" aria-current={p === page ? "page" : undefined} aria-label={`หน้า ${p}`} onClick={() => onPage(p)}
        className={cn(cell, p === page ? "border border-primary/30 bg-secondary font-semibold text-secondary-foreground" : "hover:bg-muted")}>{p}</button>
    </span>)}
    {pages > 1 && <button type="button" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(cell, "text-muted-foreground hover:bg-muted disabled:opacity-40")}><ChevronRight className="size-4" aria-hidden /></button>}
  </nav>;
}

/** "แสดง 6–10 จาก 23 {unit}" for a 1-based page. */
export function pageRange(page: number, pageSize: number, total: number, unit: string) {
  return `แสดง ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} จาก ${total} ${unit}`;
}
