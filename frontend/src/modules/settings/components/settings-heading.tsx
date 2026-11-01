"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { settingsMascot } from "../nav";

// Page heading (settings _common.md §1, CR-002 / CR-003): H1 + one-line muted subtitle ·
// role mascot beside the title (decorative) · the page's primary action on the same row.

type Props = { title: string; subtitle: string; action?: ReactNode };

export function SettingsHeading({ title, subtitle, action }: Props) {
  const me = useCurrentUser();
  const mascot = settingsMascot(me);
  return (
    <div className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3 lg:mb-7 lg:flex-nowrap lg:items-center">
      <div className="flex min-w-0 flex-1 basis-full items-start gap-2 lg:basis-auto lg:gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold lg:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        <span aria-hidden="true" data-mascot="settings" data-surface={me.role === "super_admin" ? "blue" : "sage"} className="mascot-frame relative size-18 shrink-0 lg:size-28">
          <Image src={mascot.src} alt={mascot.alt} width={112} height={112} className="mascot-image relative size-full object-contain" />
        </span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
