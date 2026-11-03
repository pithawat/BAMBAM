"use client";
/* eslint-disable @next/next/no-img-element -- print sheet: a plain image keeps its mm size and loads before window.print(). */

import { memo, useMemo } from "react";
import QRCode from "qrcode";
import { labelQrUrl, LABELS_PER_PAGE, shortLocation } from "../../labels";
import type { LabelAsset } from "../../types";

// S30 label pages (CR-007, repair BR-F13A-1; look = CR-037 v7, output/qr-login-redesign/label-v7.html): A4 portrait,
// 3 × 4 cells of 70 × 74.25 mm. Blue card, the mascot peeking over a white 42 mm card holding the 40 mm QR (error
// correction M, quiet zone 4 modules), "สแกนแจ้งปัญหา" + logo top left, curved arrow, dark footer with code / name /
// short location on one line each. `.qr-mono` = the black-on-white option. The same markup is the on-screen preview
// (scaled) and the print sheet (`@media print` in LABEL_PRINT_CSS).

const BOARD = "url('/brand/bam-qr-mascot-board.webp')";

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
  font-family: var(--font-sans, "Anuphan", sans-serif);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.qr-page:last-child { break-after: auto; page-break-after: auto; }
.qr-cell {
  position: relative; box-sizing: border-box; width: 70mm; height: 74.25mm; overflow: hidden; isolation: isolate;
  background: #086cf8; color: #fff; text-align: center; outline: 0.2mm solid #aab0ba; outline-offset: -0.2mm;
}
.qr-cell::before {
  content: ""; position: absolute; inset: 46mm -3mm -2mm; z-index: -1; background: #10131c;
  border-radius: 45% 30% 0 0 / 12% 15% 0 0; transform: rotate(-4deg);
}
.qr-head {
  position: absolute; top: 2mm; left: 3mm; z-index: 1; display: flex; flex-direction: column-reverse; align-items: flex-start; gap: 1.5mm;
}
.qr-head strong { font-size: 9pt; line-height: 1.2; font-weight: 700; white-space: nowrap; }
.qr-brand { display: inline-flex; background: #fff; border-radius: 1mm; padding: 1mm 1.5mm; }
.qr-brand img { display: block; width: 12mm; height: auto; }
.qr-mascot { position: absolute; top: 0; left: 25mm; width: 40mm; height: 16mm; background: ${BOARD} top center / 40mm auto no-repeat; transform: scaleX(-1); }
.qr-card { position: absolute; top: 14.5mm; left: 14mm; box-sizing: border-box; width: 42mm; height: 42mm; padding: 1mm; background: #fff; border-radius: 3mm; outline: 0.3mm solid #10131c; }
.qr-card svg { display: block; width: 40mm; height: 40mm; }
.qr-paw { position: absolute; top: 15.5mm; width: 5.32mm; height: 7.6mm; background-image: ${BOARD}; background-size: 38mm auto; background-repeat: no-repeat; }
.qr-paw.left { left: 11mm; background-position: 0 -19mm; }
.qr-paw.right { right: 11mm; background-position: -32.68mm -19mm; }
.qr-cue { position: absolute; left: 2.5mm; top: 19mm; width: 9mm; height: 12mm; color: #ffdb4e; }
.qr-cue svg { display: block; width: 100%; height: 100%; }
.qr-foot {
  position: absolute; top: 57.5mm; left: 0; right: 0; bottom: 0; box-sizing: border-box; background: #10131c;
  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.5mm; padding: 1mm 2mm;
}
.qr-code, .qr-name, .qr-loc { display: block; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.qr-code { font: 700 10pt/1.2 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: 0.03em; }
.qr-name { font-size: 9pt; }
.qr-loc { font-size: 8pt; }
.qr-mono .qr-cell { background: #fff; color: #000; }
.qr-mono .qr-cell::before { display: none; }
.qr-mono .qr-foot { background: #fff; color: #000; border-top: 0.2mm solid #000; }
.qr-mono .qr-brand { padding: 0; }
.qr-mono .qr-brand img, .qr-mono .qr-mascot, .qr-mono .qr-paw { filter: grayscale(1); }
.qr-mono .qr-cue { color: #000; }
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
      <div className="qr-head"><strong>สแกนแจ้งปัญหา</strong><span className="qr-brand"><img src="/brand/bam-logo.webp" alt="BAM" /></span></div>
      <div className="qr-mascot" aria-hidden />
      <div className="qr-card"><QrSvg text={labelQrUrl(origin, asset.code)} /></div>
      <div className="qr-paw left" aria-hidden />
      <div className="qr-paw right" aria-hidden />
      <div className="qr-cue" aria-hidden>
        <svg viewBox="0 0 32 40" fill="none"><path d="M6 5v11c0 6 3 9 9 9h11m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="qr-foot">
        <div className="qr-code">{asset.code}</div>
        <div className="qr-name">{asset.name}</div>
        <div className="qr-loc">{shortLocation(asset)}</div>
      </div>
    </div>
  );
}

/** A4 pages in list order (a new room does not start a new page). */
export function LabelPages({ assets, origin, mono = false, pageClassName }: {
  assets: LabelAsset[];
  origin: string;
  mono?: boolean;
  pageClassName?: string;
}) {
  const pages: LabelAsset[][] = [];
  for (let i = 0; i < assets.length; i += LABELS_PER_PAGE) pages.push(assets.slice(i, i + LABELS_PER_PAGE));
  return (
    <>
      {pages.map((page, i) => (
        <section key={i} className={["qr-page", mono && "qr-mono", pageClassName].filter(Boolean).join(" ")} aria-label={`หน้า ${i + 1} จาก ${pages.length}`} data-testid="qr-page">
          {page.map((a) => <LabelCell key={a.id} asset={a} origin={origin} />)}
        </section>
      ))}
    </>
  );
}
