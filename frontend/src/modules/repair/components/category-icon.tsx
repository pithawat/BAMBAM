"use client";

import { createElement } from "react";
import {
  Armchair, Building2, Droplets, Ellipsis, Lightbulb, Presentation, Snowflake, Sparkles, SquareParking, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "../types";

// CR-014 master icons + the sample ones older drafts / tickets may still name. Shared by the S03 category cards
// and the category tiles on S06 / S07 (CR-019); tickets carry `category.icon` from the API, so no master request.
const ICONS: Record<string, LucideIcon> = {
  zap: Zap, snowflake: Snowflake, droplets: Droplets, presentation: Presentation, "building-2": Building2,
  "square-parking": SquareParking, ellipsis: Ellipsis, lightbulb: Lightbulb, armchair: Armchair, sparkles: Sparkles,
};

export const iconByName = (name?: string): LucideIcon => (name ? ICONS[name] ?? Wrench : Wrench);
export const categoryIcon = (c?: Category) => iconByName(c?.icon);

/** Soft repair-orange tile with the category icon (decorative; the category name is printed next to it). */
export function CategoryTile({ icon, className, iconClassName }: { icon?: string; className?: string; iconClassName?: string }) {
  return <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-svc-repair/10 text-svc-repair", className)}>
    {createElement(iconByName(icon), { className: cn("size-4.5", iconClassName) })}
  </span>;
}
