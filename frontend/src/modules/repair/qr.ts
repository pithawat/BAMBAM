"use client";

import { useSyncExternalStore } from "react";

// Stage 5 QR (F13-B, CR-036 / D-140). A printed label holds `{FRONTEND_URL}/q/{code}` only; the app
// route `/q/{code}` redirects to the report form `/repair/new?asset={code}`, which looks the asset up (#25).

const QR_PATH = /^\/q\/([^/]+)\/?$/;
const ASSET_CODE = /^[A-Za-z0-9_-]{1,50}$/;

/** The report form prefilled from an asset (S16 after a scan or a found manual code; `/q` redirects here). */
export const assetFormPath = (code: string) => `/repair/new?asset=${encodeURIComponent(code)}`;

/**
 * The asset code in a scanned QR, or `null` when the QR is not a BAMBAM asset label for this
 * environment (S16 → toast "QR นี้ไม่ใช่ของ BAMBAM", keep scanning): same origin, path `/q/{code}`,
 * a code of letters, digits, `-` and `_` (BR-F31-1). Query and hash are ignored.
 */
export function assetCodeFromQr(text: string, origin: string = window.location.origin): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const m = QR_PATH.exec(url.pathname);
  if (!m) return null;
  let code: string;
  try {
    code = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return ASSET_CODE.test(code) ? code : null;
}

/**
 * BR-F13B-4: the in-app scan button shows on phones only — a coarse pointer (touch screen) and a camera
 * API. The camera itself also needs a secure context (HTTPS; localhost on dev). Desktop gets the
 * S16 manual-code card instead.
 */
export function canScanInApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function subscribePointer(callback: () => void) {
  const media = window.matchMedia("(pointer: coarse)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** `canScanInApp()` for components (S06 report card, Home repair card). Server render and first paint: `false` (hidden). */
export function useCanScanInApp(): boolean {
  return useSyncExternalStore(subscribePointer, canScanInApp, () => false);
}

// ---- decoder: BarcodeDetector where the browser has it (Android Chrome), jsQR otherwise (iOS Safari) ----

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
};

/** Reads one frame of a playing `<video>` and returns the QR text in it, or `null` when none is found. */
export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>;

/**
 * Creates the decoder once per scan session (S16 `QrScanner`): call it about every 200 ms while the
 * camera plays and stop when it returns a value or the page unmounts. Pass the text to `assetCodeFromQr`.
 */
export async function createQrDecoder(): Promise<QrDecoder> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Detector) {
    try {
      if ((await Detector.getSupportedFormats()).includes("qr_code")) {
        const detector = new Detector({ formats: ["qr_code"] });
        return async (video) => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
          const found = await detector.detect(video);
          return found[0]?.rawValue ?? null;
        };
      }
    } catch {
      // fall back to jsQR
    }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null;
    // decode a scaled frame (long edge ≤ 640 px): fast enough on older phones, sharp enough for a 40 mm label
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
