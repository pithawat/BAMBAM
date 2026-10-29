import Image from "next/image";
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
  /** Flat contrasting backdrop; use none when the surrounding hero already provides contrast. */
  surface?: "blue" | "sage" | "warm" | "none";
};

/** Decorative BAM mascot (`aria-hidden`). */
export function Mascot({ pose = "welcome", size = 120, className, priority, surface = "blue" }: MascotProps) {
  const s = SOURCES[pose];
  const width = Math.round((s.width / s.height) * size);
  return (
    <span
      aria-hidden="true"
      data-mascot={pose}
      data-surface={surface}
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
