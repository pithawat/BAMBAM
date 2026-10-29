"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Picker, type PickerOption, type PickerProps } from "./picker";

/** ≤ this many options → pill radios. */
const PILL_MAX = 5;
/** ≤ this many options → a grid of buttons; more → `Picker`. */
const GRID_MAX = 12;

type ChoiceFieldProps = PickerProps & {
  /** Shown instead of the choices when there are no options yet (e.g. "เลือกอาคารก่อน"). */
  emptyHint?: string;
  /** Short grid label on desktop (e.g. "5" for "ชั้น 5"); the full label stays the accessible name. */
  shortLabel?: (option: PickerOption) => string;
};

/** Picks the control by option count (design-system "Pickers", CR-002). */
export function ChoiceField({ emptyHint, shortLabel, ...props }: ChoiceFieldProps) {
  const { options } = props;
  if (!options.length) {
    return <p id={props.id} aria-describedby={props["aria-describedby"]} className="rounded-sm bg-muted/60 p-4 text-sm text-muted-foreground">{emptyHint}</p>;
  }
  if (options.length > GRID_MAX) return <Picker {...props} />;
  const grid = options.length > PILL_MAX;
  const Icon = props.icon;
  return <RadioGroupPrimitive.Root id={props.id} value={props.value} onValueChange={props.onValueChange} disabled={props.disabled}
    aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-invalid={props.invalid || undefined}
    className={grid
      ? cn("grid grid-cols-4 gap-2", options.length <= 8 ? "lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none" : "lg:grid-cols-6")
      : "flex flex-wrap gap-2"}>
    {options.map((o) => <RadioGroupPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} aria-label={o.label}
      className={cn(
        "inline-flex items-center justify-center gap-2 border bg-card outline-none transition-colors hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
        "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-white",
        grid ? "h-13 rounded-sm px-2 font-heading text-sm font-semibold" : "h-12 rounded-full px-5 text-base font-medium",
        props.invalid ? "border-destructive" : "border-input",
      )}>
      {!grid && Icon && <Icon aria-hidden className="size-4.5 shrink-0" />}
      {grid && shortLabel ? <><span className="lg:hidden">{o.label}</span><span className="hidden lg:inline">{shortLabel(o)}</span></> : o.label}
    </RadioGroupPrimitive.Item>)}
  </RadioGroupPrimitive.Root>;
}
