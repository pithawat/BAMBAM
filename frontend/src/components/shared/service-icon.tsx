import { Car, Presentation, Wrench, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type Service = "repair" | "car" | "room";

export const SERVICES: Record<Service, { label: string; icon: LucideIcon; color: string }> = {
  repair: { label: "แจ้งซ่อม", icon: Wrench, color: "var(--svc-repair)" },
  car: { label: "จองรถ", icon: Car, color: "var(--svc-car)" },
  room: { label: "จองห้องประชุม", icon: Presentation, color: "var(--svc-room)" },
};

type ServiceIconProps = {
  service: Service;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
};

/** 52px soft 3D circle in the service color with a white lucide icon (design-system.md). */
export function ServiceIcon({ service, disabled, size = "md", className }: ServiceIconProps) {
  const { icon: Icon, color } = SERVICES[service];
  return (
    <span
      aria-hidden="true"
      style={{ "--c": color } as CSSProperties}
      className={cn(
        "ic3d grid shrink-0 place-items-center rounded-full text-white",
        size === "md" ? "size-13" : "size-10",
        disabled && "opacity-70 saturate-25",
        className,
      )}
    >
      <Icon className={size === "md" ? "size-6.5" : "size-5"} strokeWidth={2} />
    </span>
  );
}

/** "เร็วๆ นี้" chip for services that are not live yet. */
export function SoonChip({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground", className)}>
      เร็วๆ นี้
    </span>
  );
}
