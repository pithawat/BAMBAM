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
 * Mobile header for a service screen (design-system.md, CR-008): white bar with the service
 * icon in a soft tint, title + subtitle, optional action and a slot below (search, tabs).
 */
export function ServiceHeader({ service, title, subtitle, top, action, children, className }: ServiceHeaderProps) {
  const { icon: Icon, color } = SERVICES[service];
  return (
    <header
      style={{ "--c": color } as CSSProperties}
      className={cn("border-b bg-card px-4 pt-3 pb-4", className)}
    >
      {top && <div className="mb-2">{top}</div>}
      <div className="flex items-center gap-3">
        <span className="ic3d grid size-11 shrink-0 place-items-center rounded-lg">
          <Icon className="size-5.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-8 font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
