import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// White BAM tiger (CR-029): PNG masters and matching WebP exports in public/brand.
// White-specific filenames also refresh previously optimised orange-tiger images.
const SOURCES = {
  welcome: { src: "/brand/bam-mascot-welcome-white.webp", width: 493, height: 560 },
  guide: { src: "/brand/bam-mascot-guide-white.webp", width: 514, height: 560 },
  review: { src: "/brand/bam-mascot-review-white.webp", width: 469, height: 560 },
  tracking: { src: "/brand/bam-mascot-tracking-white.webp", width: 397, height: 560 },
  loading: { src: "/brand/bam-mascot-loading-white.webp", width: 428, height: 560 },
  // S01 login (CR-019 follow-up, bam-workplace-login-v7.html): presenting, with the staff badge.
  login: { src: "/brand/bam-mascot-login-white.webp", width: 631, height: 640 },
} as const;

export type MascotPose = keyof typeof SOURCES;

type MascotProps = {
  pose?: MascotPose;
  /** Rendered height in px; width follows the image ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Decorative BAM mascot (`aria-hidden`). CR-035: always shown on a solid primary surface (`MascotPanel`). */
export function Mascot({ pose = "welcome", size = 120, className, priority }: MascotProps) {
  const s = SOURCES[pose];
  const width = Math.round((s.width / s.height) * size);
  return (
    <span
      aria-hidden="true"
      data-mascot={pose}
      className={cn("mascot-frame pointer-events-none relative inline-block shrink-0 select-none align-middle", className)}
      style={{ width, height: size }}
    >
      <Image
        src={s.src}
        alt=""
        aria-hidden="true"
        width={width}
        height={size}
        priority={priority}
        className="mascot-image relative size-full object-contain"
      />
    </span>
  );
}

type MascotPanelProps = Omit<ComponentProps<"section">, "children" | "ref"> & {
  /** Tag of the panel: `header` for page headings, `section` / `div` elsewhere. */
  as?: "header" | "section" | "div";
  pose?: MascotPose;
  /** Mascot height in px: [phone, sm and up]. */
  size?: [number, number];
  /** Replaces the pose image (settings role mascots). */
  art?: ReactNode;
  priority?: boolean;
  /** Content after the heading block (pickers, actions); wraps under it on narrow screens. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * CR-035 — the S06 tracking treatment used wherever the mascot appears: the white tiger on a solid primary panel,
 * beside white heading copy. Buttons inside flip to the panel (globals.css `.mascot-panel`).
 */
export function MascotPanel({ as: Tag = "section", pose = "welcome", size = [80, 120], art, priority, aside, className, children, ...props }: MascotPanelProps) {
  return (
    <Tag {...props} className={cn("mascot-panel flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-primary px-5 py-5 text-primary-foreground sm:px-7 sm:py-6", className)}>
      <div className="flex min-w-60 flex-1 basis-80 items-center gap-4 sm:gap-6">
        {art ?? <>
          <Mascot pose={pose} size={size[0]} priority={priority} className="sm:hidden" />
          <Mascot pose={pose} size={size[1]} priority={priority} className="hidden sm:inline-block" />
        </>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {aside && <div className="w-full sm:w-auto">{aside}</div>}
    </Tag>
  );
}
