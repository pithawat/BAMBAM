"use client";

import { memo, useMemo } from "react";
import QRCode from "qrcode";

/** A QR of `text` as one SVG path (synchronous; `qrcode` builds the matrix). Used by the settings S30 labels and the repair S07 report. */
export const QrSvg = memo(function QrSvg({ text, className }: { text: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const m = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
    const quiet = 4;
    let d = "";
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    return { size: m.size + quiet * 2, path: d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`QR ${text}`} data-qr={text} className={className}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
});
