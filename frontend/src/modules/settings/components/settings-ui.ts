import { ApiError } from "@/lib/http";
import type { SettingsErrorCode } from "../types";

// Small helpers shared by the settings screens (settings _common.md §5–§6).

export const GENERIC_ERROR = "ทำรายการไม่สำเร็จ ลองอีกครั้ง";

/** The error code of an `ApiError` (`NETWORK` / `UNKNOWN` included); undefined for anything else. */
export function errorCode(err: unknown): SettingsErrorCode | (string & {}) | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/** `VALIDATION_FAILED` field codes (`REQUIRED`, `TOO_LONG`, `INVALID`, …). */
export function errorFields(err: unknown): Record<string, string> {
  return err instanceof ApiError && err.code === "VALIDATION_FAILED" ? err.fields : {};
}

/** Dialog / AlertDialog content: a bottom sheet on phones, a centred dialog from `lg` (CR-001 design). */
export const sheetOnMobile =
  "top-auto bottom-0 max-h-11/12 w-full max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-5 data-[size=default]:max-w-none data-[size=default]:sm:max-w-none lg:top-1/2 lg:bottom-auto lg:max-w-lg lg:-translate-y-1/2 lg:rounded-xl data-[size=default]:lg:max-w-lg";

/** White bordered panel on the gray canvas. */
export const panelClass = "rounded-xl border bg-card shadow-card";
