import { ApiError } from "@/lib/http";
import type { FieldCode, RepairErrorCode } from "./types";

// Error code → Thai copy, from docs/modules/repair/04-api-contract.md "Error codes"
// and the screen specs. Backend `message` is never shown to users.

export const GENERIC_ERROR = "ทำรายการไม่สำเร็จ ลองอีกครั้ง";

const messages: Partial<Record<RepairErrorCode, string>> = {
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  TICKET_NOT_FOUND: "ไม่พบงานนี้",
  PHOTO_NOT_FOUND: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น",
  PHOTO_TYPE_NOT_ALLOWED: "รองรับเฉพาะไฟล์รูปภาพ",
  PHOTO_TOO_LARGE: "รูปนี้ใหญ่เกิน 10 MB",
  MASTER_DATA_CHANGED: "ข้อมูลบางอย่างเปลี่ยนไป กรุณาเลือกใหม่",
  TEAM_HANDLED_NOT_ALLOWED: "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOT_TECHNICIAN: "เฉพาะช่างเท่านั้นที่ทำรายการนี้ได้",
  NOT_REPORTER: "เฉพาะผู้แจ้งเท่านั้นที่ประเมินตรวจงานได้",
  TICKET_CLOSED: "งานนี้ปิดไปแล้ว",
  INVALID_STATE: "งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว",
  ASSESSMENT_REQUIRED: "กดเริ่มดำเนินการ (กำหนดวันที่คาดว่าจะเสร็จ และใครซ่อม) ก่อนบันทึกผล",
  CONTRACTOR_NOT_FOUND: "ไม่พบช่างภายนอกนี้ หรือถูกปิดใช้งานแล้ว",
  CONTRACTOR_TYPE_NOT_FOUND: "ประเภทช่างบางรายการไม่มีในระบบแล้ว เลือกใหม่อีกครั้ง",
  ALREADY_FOLLOWING: "คุณติดตามเคสนี้อยู่แล้ว",
  NOT_TEAM_HANDLED: "งานนี้มีการเปลี่ยนแปลง โหลดข้อมูลล่าสุดให้แล้ว",
  ASSET_NOT_FOUND: "ไม่พบอุปกรณ์นี้",
};

/** `TICKET_CLOSED` copy depends on where it happens (contract "Error codes"). */
export type TicketClosedContext = "confirm" | "follow" | "resolve" | "assess";

const ticketClosed: Record<TicketClosedContext, string> = {
  confirm: "งานนี้ปิดไปแล้ว",
  follow: "เคสนี้ปิดไปแล้ว",
  resolve: "งานนี้ถูกปิดไปแล้ว",
  assess: "งานนี้ถูกปิดไปแล้ว",
};

/** Thai message for an error from `api.ts` (toast / alert). Unknown errors → GENERIC_ERROR. */
export function errorMessage(err: unknown, ctx?: { ticketClosed?: TicketClosedContext }): string {
  if (!(err instanceof ApiError)) return GENERIC_ERROR;
  if (err.code === "TICKET_CLOSED" && ctx?.ticketClosed) return ticketClosed[ctx.ticketClosed];
  return messages[err.code as RepairErrorCode] ?? GENERIC_ERROR;
}

export function errorCode(err: unknown): RepairErrorCode | undefined {
  return err instanceof ApiError ? (err.code as RepairErrorCode) : undefined;
}

// ---- field errors (VALIDATION_FAILED) ----

/** S03 "Validation" (CR-008, CR-014): `field` + `FieldCode` → message. */
const createTicketFieldMessages: Record<string, Partial<Record<FieldCode, string>>> = {
  categoryId: { REQUIRED: "กรุณาเลือกหมวดงาน", INVALID: "กรุณาเลือกหมวดงาน" },
  categoryOther: { REQUIRED: "ระบุหมวดงาน", TOO_LONG: "ไม่เกิน 100 ตัวอักษร", NOT_ALLOWED: "ระบุชื่อหมวดได้เฉพาะหมวดอื่น ๆ" },
  symptomIds: { MIN_ITEMS: "เลือกอาการอย่างน้อย 1 ข้อ หรือระบุอาการอื่นๆ", INVALID: "เลือกอาการอย่างน้อย 1 ข้อ" },
  symptomOther: { REQUIRED: "ระบุอาการที่พบ", TOO_LONG: "ไม่เกิน 100 ตัวอักษร" },
  buildingId: { REQUIRED: "กรุณาเลือกอาคาร", INVALID: "กรุณาเลือกอาคาร" },
  floorId: { REQUIRED: "กรุณาเลือกชั้น", INVALID: "กรุณาเลือกชั้น" },
  roomId: { REQUIRED: "เลือกห้องหรือจุดที่เกิด", INVALID: "เลือกห้องหรือจุดที่เกิด" },
  locationDetail: { TOO_LONG: "ไม่เกิน 100 ตัวอักษร" },
  photoIds: {
    MIN_ITEMS: "แนบรูปอย่างน้อย 1 รูป",
    MAX_ITEMS: "แนบได้สูงสุด 5 รูป",
    INVALID: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น",
  },
  details: { TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
  "teamHandled.note": { REQUIRED: "กรุณาบอกสิ่งที่ทีมทำ", TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
  "teamHandled.photoIds": { MIN_ITEMS: "แนบรูปหลังทำอย่างน้อย 1 รูป" },
};

/**
 * Field errors of a failed `createTicket` as `{ field: message }` (S03).
 * Empty when the error is not `VALIDATION_FAILED`.
 */
export function createTicketFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_FAILED") return {};
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(err.fields)) {
    out[field] = createTicketFieldMessages[field]?.[code as FieldCode] ?? GENERIC_ERROR;
  }
  return out;
}

type FieldMessages = Record<string, Partial<Record<FieldCode, string>>>;

/** `{ field: message }` for a `VALIDATION_FAILED` error with the given copy; empty otherwise. */
export function fieldErrors(err: unknown, map: FieldMessages): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_FAILED") return {};
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(err.fields)) out[field] = map[field]?.[code as FieldCode] ?? GENERIC_ERROR;
  return out;
}

/** S17 รับเรื่อง / เลื่อนวันเสร็จ. */
export const assessFieldMessages: FieldMessages = {
  expectedDoneOn: { REQUIRED: "เลือกวันที่คาดว่าจะเสร็จ", INVALID: "เลือกวันที่คาดว่าจะเสร็จ", PAST: "เลือกวันนี้หรือหลังจากนี้" },
  workBy: { REQUIRED: "เลือกใครซ่อม", INVALID: "เลือกใครซ่อม" },
  contractorId: { REQUIRED: "เลือกช่างภายนอก", INVALID: "เลือกช่างภายนอก" },
  reason: { TOO_LONG: "ไม่เกิน 100 ตัวอักษร" },
};

/** S10 resolve. */
export const resolveFieldMessages: FieldMessages = {
  note: { REQUIRED: "กรุณาบอกสิ่งที่ทำ", TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
  photoIds: { MIN_ITEMS: "แนบรูปหลังซ่อมอย่างน้อย 1 รูป", MAX_ITEMS: "แนบได้สูงสุด 5 รูป", INVALID: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น" },
  contractorRating: { REQUIRED: "ให้คะแนนช่างภายนอก", INVALID: "ให้คะแนนช่างภายนอก" },
  contractorRatingComment: { TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
};

/** S08 confirm + send back. */
export const reviewFieldMessages: FieldMessages = {
  rating: { REQUIRED: "เลือกคะแนน 1–5 ดาวก่อน", INVALID: "เลือกคะแนน 1–5 ดาวก่อน" },
  comment: { TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
  reason: { REQUIRED: "กรุณาบอกสิ่งที่ยังไม่เรียบร้อย", TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
  photoIds: { MAX_ITEMS: "แนบได้สูงสุด 5 รูป", INVALID: "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น" },
};

/** S18 contractor form. */
export const contractorFieldMessages: FieldMessages = {
  name: { REQUIRED: "กรุณากรอกชื่อร้าน / บริษัท", TOO_LONG: "ไม่เกิน 100 ตัวอักษร" },
  typeIds: { MIN_ITEMS: "เลือกประเภทอย่างน้อย 1 ประเภท", INVALID: "เลือกประเภทอย่างน้อย 1 ประเภท" },
  contactName: { TOO_LONG: "ไม่เกิน 100 ตัวอักษร" },
  phone: { TOO_LONG: "ไม่เกิน 30 ตัวอักษร" },
  note: { TOO_LONG: "ไม่เกิน 500 ตัวอักษร" },
};
