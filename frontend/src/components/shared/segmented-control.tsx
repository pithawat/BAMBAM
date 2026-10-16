"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Accessible name of the group. */
  label: string;
  className?: string;
};

/** ≤ 4 choices in a toolbar or sheet (design-system "Pickers", CR-002). A radio group: arrows move and pick. */
export function SegmentedControl({ value, onValueChange, options, label, className }: SegmentedControlProps) {
  return <RadioGroupPrimitive.Root value={value} onValueChange={onValueChange} aria-label={label} orientation="horizontal"
    className={cn("flex gap-1 rounded-full border bg-card p-1", className)}>
    {options.map((o) => <RadioGroupPrimitive.Item key={o.value} value={o.value}
      className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full px-3 font-heading text-sm font-semibold whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-[state=checked]:bg-foreground data-[state=checked]:text-white">
      {o.label}
    </RadioGroupPrimitive.Item>)}
  </RadioGroupPrimitive.Root>;
}
