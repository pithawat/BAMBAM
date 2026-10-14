import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SERVICES, type Service } from "./service-icon";

type ServiceHeaderProps = {
  service: Service;
  title: string;
  subtitle?: ReactNode;
  /** Slot above the title, e.g. the role switcher pill. */
  top?: ReactNode;
  /** Right side action (bell, filter …). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Mobile header for a service screen: service-color gradient with a curved
 * bottom edge and a white icon circle (design-system.md ServiceHeader).
 */
export function ServiceHeader({ service, title, subtitle, top, action, children, className }: ServiceHeaderProps) {
  const { icon: Icon, color } = SERVICES[service];
  return (
    <header
      style={{ "--c": color } as CSSProperties}
      className={cn(
        "relative overflow-hidden rounded-b-[34px] bg-service px-4 pt-3 pb-16 text-white",
        className,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-24 size-64 rounded-full bg-white/15" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full bg-white/10" />
      {top && <div className="relative mb-2">{top}</div>}
      <div className="relative flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-(--c) shadow-card">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="text-[13.5px] text-white/90">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children && <div className="relative mt-3">{children}</div>}
    </header>
  );
}
