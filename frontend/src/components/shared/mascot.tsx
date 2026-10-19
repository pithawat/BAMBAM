import Image from "next/image";
import { cn } from "@/lib/utils";

// One source image (docs/shared/style/references/mascot-bambam-leopard.png),
// exported as crops in public/brand. Never stretch, recolor or redraw it.
const SOURCES = {
  full: { src: "/brand/mascot-full.webp", width: 640, height: 633 },
  bust: { src: "/brand/mascot-bust.webp", width: 480, height: 480 },
  face: { src: "/brand/mascot-face.webp", width: 320, height: 320 },
  // White leopard bust (CR-010 asset, master PNG in the same folder); S06 heading only (CR-011).
  leopard: { src: "/brand/mascot-leopard-bust.webp", width: 320, height: 320 },
} as const;

export type MascotPose = keyof typeof SOURCES;

type MascotProps = {
  pose?: MascotPose;
  /** Rendered height in px; width follows the image ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Decorative BAMBAM mascot (`aria-hidden`). */
export function Mascot({ pose = "full", size = 120, className, priority }: MascotProps) {
  const s = SOURCES[pose];
  const width = Math.round((s.width / s.height) * size);
  return (
    <Image
      src={s.src}
      alt=""
      aria-hidden="true"
      width={width}
      height={size}
      priority={priority}
      className={cn("pointer-events-none select-none object-contain", className)}
      style={{ width, height: size }}
    />
  );
}
