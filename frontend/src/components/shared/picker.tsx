"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown, ChevronUp, Search, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "./use-media-query";

// Pickers (design-system.md → Patterns → Pickers, CR-002). Always use these instead of
// components/ui/select: the shadcn default opens "item-aligned" over the field.

export type PickerOption = { value: string; label: string; description?: ReactNode; disabled?: boolean };

/** More options than this → a search field in the menu / sheet. */
export const SEARCH_THRESHOLD = 10;

const optionClass =
  "relative flex w-full cursor-default items-center gap-2.5 rounded-sm px-3 text-left text-base outline-none select-none " +
  "data-disabled:pointer-events-none data-disabled:opacity-50";
const highlightedClass = "bg-muted";
const selectedClass = "bg-secondary font-semibold text-secondary-foreground";

export const triggerClass =
  "group flex h-13 w-full min-w-0 items-center gap-2.5 rounded-sm border border-input bg-card px-4 text-left text-base outline-none transition-colors " +
  "hover:border-foreground/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 " +
  "aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/20 " +
  "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 " +
  "data-placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground";

export function PickerChevron() {
  return <ChevronDown aria-hidden className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180 group-aria-expanded:text-primary" />;
}

/** Radix Select menu that opens under its trigger at the trigger's width. */
export function MenuContent({ children, className }: { children: ReactNode; className?: string }) {
  return <SelectPrimitive.Portal>
    <SelectPrimitive.Content position="popper" side="bottom" align="start" sideOffset={6} collisionPadding={12}
      className={cn("z-50 max-h-64 min-w-(--radix-select-trigger-width) overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-float data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0", className)}>
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-muted-foreground"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-muted-foreground"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>;
}

export function MenuItem({ option }: { option: PickerOption }) {
  return <SelectPrimitive.Item value={option.value} disabled={option.disabled}
    className={cn(optionClass, option.description ? "min-h-14 py-2" : "min-h-11", "data-highlighted:bg-muted data-[state=checked]:bg-secondary data-[state=checked]:font-semibold data-[state=checked]:text-secondary-foreground")}>
    <span className="min-w-0 flex-1"><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      {option.description && <span className="block text-xs font-normal text-muted-foreground">{option.description}</span>}</span>
    <SelectPrimitive.ItemIndicator className="shrink-0 text-primary"><Check className="size-5" aria-hidden /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}

export type PickerProps = {
  id?: string;
  /** "" = nothing picked. */
  value: string;
  onValueChange: (value: string) => void;
  options: PickerOption[];
  placeholder: string;
  /** Field label — the sheet title on mobile. */
  title: string;
  /** Context under the sheet title, e.g. the building of a floor list. */
  context?: string;
  icon?: LucideIcon;
  invalid?: boolean;
  disabled?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Trigger content for the picked option (default: its label). */
  renderValue?: (option: PickerOption) => ReactNode;
  searchPlaceholder?: string;
  /** "ไม่พบ{ชื่อช่อง}ที่ค้นหา" */
  emptyText?: string;
};

/** Form picker: desktop menu under the field (search when long) · mobile bottom sheet. */
export function Picker(props: PickerProps) {
  const desktop = useIsDesktop();
  const searchable = props.options.length > SEARCH_THRESHOLD;
  return desktop && !searchable ? <SelectPicker {...props} /> : <ListPicker {...props} desktop={desktop} searchable={searchable} />;
}

function TriggerContent({ props, selected }: { props: PickerProps; selected?: PickerOption }) {
  const Icon = props.icon;
  return <>
    {Icon && <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
    <span className="min-w-0 flex-1 truncate">{selected ? (props.renderValue?.(selected) ?? selected.label) : props.placeholder}</span>
    <PickerChevron />
  </>;
}

function SelectPicker(props: PickerProps) {
  const selected = props.options.find((o) => o.value === props.value);
  const Icon = props.icon;
  return <SelectPrimitive.Root value={props.value} onValueChange={props.onValueChange} disabled={props.disabled}>
    <SelectPrimitive.Trigger id={props.id} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-invalid={props.invalid || undefined} className={triggerClass}>
      {Icon && <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate"><SelectPrimitive.Value placeholder={props.placeholder}>{selected ? (props.renderValue?.(selected) ?? selected.label) : undefined}</SelectPrimitive.Value></span>
      <PickerChevron />
    </SelectPrimitive.Trigger>
    <MenuContent>{props.options.map((o) => <MenuItem key={o.value} option={o} />)}</MenuContent>
  </SelectPrimitive.Root>;
}

function ListPicker({ desktop, searchable, ...props }: PickerProps & { desktop: boolean; searchable: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = props.options.find((o) => o.value === props.value);
  const pick = (value: string) => { props.onValueChange(value); setOpen(false); };
  const trigger = <button type="button" role="combobox" id={props.id} disabled={props.disabled} aria-haspopup={desktop ? "listbox" : "dialog"} aria-expanded={open} aria-controls={listId}
    aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-invalid={props.invalid || undefined}
    data-placeholder={selected ? undefined : ""} className={triggerClass} onClick={desktop ? undefined : () => setOpen(true)}>
    <TriggerContent props={props} selected={selected} />
  </button>;
  const list = <OptionList listId={listId} options={props.options} value={props.value} onPick={pick} searchable={searchable} size={desktop ? "menu" : "sheet"}
    label={props.title} searchPlaceholder={props.searchPlaceholder} emptyText={props.emptyText} />;
  if (desktop) {
    return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} collisionPadding={12} className="w-(--radix-popover-trigger-width) gap-0 rounded-md border p-1.5 shadow-float ring-0">{list}</PopoverContent>
    </Popover>;
  }
  return <>
    {trigger}
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-5/6 gap-0 rounded-t-3xl px-4 pt-2 pb-8">
        <span aria-hidden className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-input" />
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <div className="min-w-0 flex-1"><SheetTitle className="font-heading text-lg font-semibold">{props.title}</SheetTitle>
            <SheetDescription className={cn("text-xs text-muted-foreground", !props.context && "sr-only")}>{props.context ?? props.title}</SheetDescription></div>
          <SheetClose asChild><Button type="button" variant="secondary" size="icon" aria-label="ปิด" className="bg-muted text-foreground"><X /></Button></SheetClose>
        </div>
        {list}
      </SheetContent>
    </Sheet>
  </>;
}

function nextEnabled(options: PickerOption[], from: number, step: 1 | -1) {
  for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
  return from;
}

/** Listbox with optional search (APG combobox / listbox keyboard model). */
function OptionList({ listId, options, value, onPick, searchable, size, label, searchPlaceholder, emptyText }: {
  listId: string; options: PickerOption[]; value: string; onPick: (value: string) => void; searchable: boolean; size: "menu" | "sheet";
  label: string; searchPlaceholder?: string; emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const current = Math.min(active, Math.max(0, filtered.length - 1));
  const optionId = (i: number) => `${listId}-o${i}`;
  useEffect(() => { document.getElementById(`${listId}-o${current}`)?.scrollIntoView({ block: "nearest" }); }, [current, listId]);
  function onKeyDown(event: KeyboardEvent) {
    if (!filtered.length) return;
    if (event.key === "ArrowDown") setActive(nextEnabled(filtered, current, 1));
    else if (event.key === "ArrowUp") setActive(nextEnabled(filtered, current, -1));
    else if (event.key === "Home") setActive(nextEnabled(filtered, -1, 1));
    else if (event.key === "End") setActive(nextEnabled(filtered, filtered.length, -1));
    else if (event.key === "Enter" || (event.key === " " && !searchable)) { if (!filtered[current].disabled) onPick(filtered[current].value); }
    else return;
    event.preventDefault();
  }
  return <div className="flex min-h-0 flex-col">
    {searchable && <div className="relative mb-1.5 shrink-0">
      <Search aria-hidden className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
      <input type="text" role="combobox" aria-expanded aria-controls={listId} aria-autocomplete="list" aria-activedescendant={filtered.length ? optionId(current) : undefined}
        aria-label={searchPlaceholder ?? label} placeholder={searchPlaceholder} value={query} autoFocus
        onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
        className="h-11 w-full rounded-sm border border-input bg-card pr-3 pl-10 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/20" />
    </div>}
    <div role="listbox" id={listId} aria-label={label} tabIndex={searchable ? -1 : 0} autoFocus={!searchable}
      aria-activedescendant={!searchable && filtered.length ? optionId(current) : undefined} onKeyDown={searchable ? undefined : onKeyDown}
      className={cn("min-h-0 overflow-y-auto outline-none", size === "menu" ? "max-h-60" : "flex-1")}>
      {filtered.map((o, i) => {
        const picked = o.value === value;
        return <div key={o.value} id={optionId(i)} role="option" aria-selected={picked} aria-disabled={o.disabled || undefined} data-disabled={o.disabled ? "" : undefined}
          onClick={() => { if (!o.disabled) onPick(o.value); }} onPointerMove={() => setActive(i)}
          className={cn(optionClass, size === "sheet" ? "min-h-13" : o.description ? "min-h-14 py-2" : "min-h-11", "mt-0.5 first:mt-0", i === current && highlightedClass, picked && selectedClass)}>
          <span className="min-w-0 flex-1">{o.label}{o.description && <span className="block text-xs font-normal text-muted-foreground">{o.description}</span>}</span>
          {picked && <Check aria-hidden className="size-5 shrink-0 text-primary" />}
        </div>;
      })}
      {!filtered.length && <p className="px-3 py-5 text-center text-sm text-muted-foreground">{emptyText}</p>}
    </div>
  </div>;
}
