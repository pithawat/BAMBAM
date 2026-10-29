"use client";

import { Select as SelectPrimitive } from "radix-ui";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuContent, MenuItem, type PickerOption } from "./picker";

type FilterPillProps = {
  /** Filter name shown in the pill: "{label}: {value}". */
  label: string;
  value: string;
  /** The "ทั้งหมด…" value; any other value marks the pill active. */
  defaultValue: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  icon?: LucideIcon;
  size?: "default" | "sm";
  className?: string;
};

/** Dropdown filter (design-system "Pickers" → FilterPill, CR-002). */
export function FilterPill({ label, value, defaultValue, options, onValueChange, icon: Icon, size = "default", className }: FilterPillProps) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = value !== defaultValue;
  return <div className={cn(
    "inline-flex shrink-0 items-center rounded-full border transition-colors has-aria-expanded:border-ring has-aria-expanded:ring-3 has-aria-expanded:ring-ring/20",
    active ? "border-primary/40 bg-secondary text-secondary-foreground" : "border-input bg-card",
    size === "sm" ? "h-10" : "h-11", className,
  )}>
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger aria-label={`${label}: ${current?.label ?? ""}`}
        className={cn("group flex h-full items-center gap-2 rounded-full pl-3.5 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/30", active ? "pr-2" : "pr-3")}>
        {Icon && <Icon aria-hidden className={cn("size-4 shrink-0", !active && "text-muted-foreground")} />}
        <span className={active ? "opacity-80" : "text-muted-foreground"}>{label}:</span>
        <span className="font-semibold"><SelectPrimitive.Value>{current?.label}</SelectPrimitive.Value></span>
        {!active && <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180 group-aria-expanded:text-primary" />}
      </SelectPrimitive.Trigger>
      <MenuContent className="min-w-56">{options.map((o) => <MenuItem key={o.value} option={o} />)}</MenuContent>
    </SelectPrimitive.Root>
    {active && <button type="button" onClick={() => onValueChange(defaultValue)} aria-label={`ล้างตัวกรอง${label}`}
      className="mr-2 grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 outline-none hover:bg-primary/25 focus-visible:ring-3 focus-visible:ring-ring/30">
      <X aria-hidden className="size-3.5" />
    </button>}
  </div>;
}
