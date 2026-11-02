"use client";

import { memo, useMemo } from "react";
import QRCode from "qrcode";
import { labelQrUrl, LABELS_PER_PAGE, shortLocation } from "../../labels";
import type { LabelAsset } from "../../types";

// S30 label pages (CR-007, repair BR-F13A-1): A4 portrait, 3 × 4 cells of 70 × 74.25 mm, QR 40 mm (error correction M,
// quiet zone 4 modules), code · name · short location · footer. Black on white only, so any printer works. The same
// markup is the on-screen preview (scaled) and the print sheet (`@media print` in LABEL_PRINT_CSS).

/** Print rules: only `.qr-print-root` prints; the app (and the preview dialog) is hidden on paper. */
export const LABEL_PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
.qr-print-root { display: none; }
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(.qr-print-root) { display: none !important; }
  .qr-print-root { display: block !important; }
  .qr-print-root .qr-page { box-shadow: none !important; margin: 0 !important; }
}
.qr-page {
  width: 210mm; height: 297mm; box-sizing: border-box; background: #fff; color: #000;
  display: grid; grid-template-columns: repeat(3, 70mm); grid-template-rows: repeat(4, 74.25mm);
  break-after: page; page-break-after: always; overflow: hidden;
  font-family: var(--font-sans, "Noto Sans Thai", "Sarabun", sans-serif);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.qr-page:last-child { break-after: auto; page-break-after: auto; }
.qr-cell {
  box-sizing: border-box; border: 0.3mm solid #b5b5b5; margin: -0.15mm; padding: 3.5mm 4mm 2.5mm;
  display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden;
}
.qr-cell svg { width: 40mm; height: 40mm; flex: none; }
.qr-code { margin-top: 1.5mm; font: 700 14pt/1.15 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: 0.02em; word-break: break-all; }
.qr-name, .qr-loc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 100%; overflow-wrap: anywhere; }
.qr-name { margin-top: 1mm; font-size: 10pt; line-height: 1.3; }
.qr-loc { margin-top: 0.8mm; font-size: 9pt; line-height: 1.3; }
.qr-foot { margin-top: auto; padding-top: 0.8mm; font-size: 7pt; line-height: 1.2; color: #555; }
`;

/** The QR of one code as an SVG path (synchronous; `qrcode` builds the matrix). */
const QrSvg = memo(function QrSvg({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const m = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
    const quiet = 4;
    let d = "";
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    return { size: m.size + quiet * 2, path: d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`QR ${text}`} data-qr={text}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
});

export function LabelCell({ asset, origin }: { asset: LabelAsset; origin: string }) {
  return (
    <div className="qr-cell" data-testid="qr-label">
      <QrSvg text={labelQrUrl(origin, asset.code)} />
      <div className="qr-code">{asset.code}</div>
      <div className="qr-name">{asset.name}</div>
      <div className="qr-loc">{shortLocation(asset)}</div>
      <div className="qr-foot">สแกนเพื่อแจ้งซ่อม · BAMBAM</div>
    </div>
  );
}

/** A4 pages in list order (a new room does not start a new page). */
export function LabelPages({ assets, origin, pageClassName }: { assets: LabelAsset[]; origin: string; pageClassName?: string }) {
  const pages: LabelAsset[][] = [];
  for (let i = 0; i < assets.length; i += LABELS_PER_PAGE) pages.push(assets.slice(i, i + LABELS_PER_PAGE));
  return (
    <>
      {pages.map((page, i) => (
        <section key={i} className={pageClassName ? `qr-page ${pageClassName}` : "qr-page"} aria-label={`หน้า ${i + 1} จาก ${pages.length}`} data-testid="qr-page">
          {page.map((a) => <LabelCell key={a.id} asset={a} origin={origin} />)}
        </section>
      ))}
    </>
  );
}
