"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { MascotPanel } from "@/components/shared/mascot";
import { useCurrentUser } from "@/components/shared/me-provider";
import { settingsMascot } from "../nav";

// Page heading (settings _common.md §1, CR-002 / CR-003): H1 + one-line subtitle · role mascot beside the title
// (decorative) · the page's primary action on the same row — all on the primary mascot panel (repair CR-035).

type Props = { title: string; subtitle: string; action?: ReactNode };

export function SettingsHeading({ title, subtitle, action }: Props) {
  const me = useCurrentUser();
  const mascot = settingsMascot(me);
  return (
    <MascotPanel as="header" className="mb-5 lg:mb-7" aside={action && <div className="shrink-0">{action}</div>}
      art={<span aria-hidden="true" data-mascot="settings" className="mascot-frame relative size-18 shrink-0 lg:size-26">
        <Image src={mascot.src} alt={mascot.alt} width={112} height={112} className="mascot-image relative size-full object-contain" />
      </span>}>
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight lg:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[13.5px] text-primary-foreground/88">{subtitle}</p>}
    </MascotPanel>
  );
}
