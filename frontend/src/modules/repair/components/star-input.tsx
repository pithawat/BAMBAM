"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { RATING_LABELS } from "./ticket-presentation";

/** 1–5 star radio group. Starts empty unless a score is passed — never preselect (BR-F07-7, CR-008). */
export function StarInput({ id, value, onChange, invalid, describedBy, size = "lg" }: {
  id: string; value: number; onChange: (n: number) => void; invalid?: boolean; describedBy?: string; size?: "lg" | "sm";
}) {
  return <div>
    <div id={id} role="radiogroup" aria-label="คะแนน 1 ถึง 5 ดาว" aria-invalid={invalid} aria-describedby={describedBy} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว · ${RATING_LABELS[n]}`} onClick={() => onChange(n)}
        className={cn("grid place-items-center rounded-sm text-gold outline-none hover:bg-gold/10 focus-visible:ring-2 focus-visible:ring-ring", size === "lg" ? "size-13" : "size-11")}>
        <Star className={cn(size === "lg" ? "size-10" : "size-8", n <= value ? "fill-current" : "text-input")} aria-hidden /></button>)}
    </div>
    <p className="mt-1 min-h-6 text-[15px] font-semibold text-warning" aria-live="polite">{value ? `${value} ดาว · ${RATING_LABELS[value]}` : <span className="font-normal text-muted-foreground">แตะดาวเพื่อประเมิน</span>}</p>
  </div>;
}
