import Image from "next/image";
import { cn } from "@/lib/utils";

// The BAM tiger (D-094, CR-019): five poses, masters in public/brand/bam-mascot-*.png, served as trimmed
// WebP exports. Never stretch, recolor or redraw it.
const SOURCES = {
  welcome: { src: "/brand/bam-mascot-welcome.webp", width: 493, height: 560 },
  guide: { src: "/brand/bam-mascot-guide.webp", width: 514, height: 560 },
  review: { src: "/brand/bam-mascot-review.webp", width: 469, height: 560 },
  tracking: { src: "/brand/bam-mascot-tracking.webp", width: 397, height: 560 },
  loading: { src: "/brand/bam-mascot-loading.webp", width: 428, height: 560 },
  // S01 login (CR-019 follow-up, bam-workplace-login-v7.html): presenting, with the staff badge.
  login: { src: "/brand/bam-mascot-login.webp", width: 631, height: 640 }, // untrimmed, as the prototype frames it
} as const;

export type MascotPose = keyof typeof SOURCES;

type MascotProps = {
  pose?: MascotPose;
  /** Rendered height in px; width follows the image ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
};

/** Decorative BAM mascot (`aria-hidden`). */
export function Mascot({ pose = "welcome", size = 120, className, priority }: MascotProps) {
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
