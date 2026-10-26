"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { settingsMascot } from "../nav";
import { useShellNav } from "./settings-shell";

// Page heading (settings _common.md §1, CR-002 / CR-003): menu button (< 1024px) · H1 + one-line muted subtitle ·
// role mascot beside the title (decorative) · the page's primary action on the same row.

type Props = { title: string; subtitle: string; action?: ReactNode };

export function SettingsHeading({ title, subtitle, action }: Props) {
  const me = useCurrentUser();
  const { openNav, menuButton } = useShellNav();
  const mascot = settingsMascot(me);
  return (
    <div className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3 lg:mb-7 lg:flex-nowrap lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2 lg:gap-3">
        <button
          ref={menuButton}
          type="button"
          aria-label="เปิดเมนูหลัก"
          onClick={openNav}
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 lg:hidden"
        >
          <Menu className="size-5.5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold lg:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        <Image src={mascot.src} alt={mascot.alt} width={112} height={112} className="size-18 shrink-0 object-contain lg:size-28" />
      </div>
      {action && <div className="ml-11 shrink-0 lg:ml-0">{action}</div>}
    </div>
  );
}
