"use client";

import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { categoryIconOf } from "@/components/shared/category-icon";
import { cn } from "@/lib/utils";
import type { Category } from "../types";

// The S03 category cards and the category tiles on S06 / S07 (CR-019) draw icons from the shared map that settings
// S22 edits (components/shared/category-icon.ts); tickets carry `category.icon` from the API, so no master request.
export const iconByName = (name?: string): LucideIcon => categoryIconOf(name);
export const categoryIcon = (c?: Category) => iconByName(c?.icon);

/** Soft repair-orange tile with the category icon (decorative; the category name is printed next to it). */
export function CategoryTile({ icon, className, iconClassName }: { icon?: string; className?: string; iconClassName?: string }) {
  return <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-svc-repair/10 text-svc-repair", className)}>
    {createElement(iconByName(icon), { className: cn("size-4.5", iconClassName) })}
  </span>;
}
