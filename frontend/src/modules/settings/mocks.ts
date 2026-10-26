import { ApiError } from "@/lib/http";
import { MOCK_CUSTOM_ROLE } from "@/lib/platform/mocks";
import type { PersonRef, Role } from "./types";

// Mock data for settings (settings _common.md §7, fictional). Scenarios: `?mock=<name>` in the URL (kept in
// localStorage) — normal · empty · error · forbidden · slow. The viewer's own permissions also apply, as on the API.

export const MOCK_SCENARIOS = ["normal", "empty", "error", "forbidden", "slow"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const SCENARIO_KEY = "bambam.settings.mockScenario";

export function mockScenario(): MockScenario {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mock");
    if (fromUrl && (MOCK_SCENARIOS as readonly string[]).includes(fromUrl)) {
      window.localStorage.setItem(SCENARIO_KEY, fromUrl);
      return fromUrl as MockScenario;
    }
    const saved = window.localStorage.getItem(SCENARIO_KEY);
    if (saved && (MOCK_SCENARIOS as readonly string[]).includes(saved)) return saved as MockScenario;
  } catch {
    // no window / storage — default
  }
  return "normal";
}

export const mockErrors = {
  server: () => new ApiError(500, "INTERNAL", "mock: server error"),
  forbidden: () => new ApiError(403, "FORBIDDEN", "mock: not allowed"),
};

export const mockPeople = {
  nattapon: { id: "9a1c7e20-0000-4000-8000-000000000007", name: "ณัฐพล อินทรวงศ์", department: "ฝ่ายเทคโนโลยีสารสนเทศ" },
  paweena: { id: "b1c2d3e4-0000-4000-8000-000000000005", name: "ปวีณา ศรีสุข", department: "ศูนย์จัดการงานอาคาร" },
} satisfies Record<string, PersonRef>;

const SEEDED_AT = "2026-10-14T02:00:00Z";

/** #2 — ids of the seeded roles are the migration's UUIDv5 ids. */
export const mockRoles: Role[] = [
  { id: "7f35e48b-245b-5d5c-a1af-eb43d9181a3c", key: "super_admin", name: "Superadmin", description: "ดูแลระบบทั้งหมด รวมผู้ใช้และสิทธิ์", isSystem: true, isLocked: true, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "5f75bf9d-49de-5619-af0a-53b0d96f5058", key: "employee", name: "พนักงานทั่วไป", description: "แจ้งซ่อมและติดตามงานของตัวเอง", isSystem: true, isLocked: false, userCount: 412, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "b1c735a0-4a1e-5e0a-af94-f8c879af66eb", key: "housekeeper_lead", name: "หัวหน้าแม่บ้าน", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "1b93abea-52ba-5e69-92d0-46d66c9689ec", key: "security_lead", name: "หัวหน้ารปภ.", description: "บันทึกและติดตามงานที่ทีมดำเนินการเอง", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "3c83d3f8-f274-599c-ae39-111c9e23defa", key: "technician", name: "ช่างเทคนิค", description: "รับเรื่อง ดำเนินการ และบันทึกผลซ่อม", isSystem: false, isLocked: false, userCount: 1, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "b736a006-ba77-5545-90ac-9f5387f981ba", key: "admin", name: "Admin", description: "จัดการงานซ่อม สถานที่ อุปกรณ์ และหมวดงาน", isSystem: false, isLocked: false, userCount: 2, updatedAt: SEEDED_AT, updatedBy: null },
  { id: "0d3f6a2c-0000-4000-8000-0000000000c1", key: MOCK_CUSTOM_ROLE, name: "หัวหน้าช่าง", description: "ดูแลงานซ่อมทั้งหมด", isSystem: false, isLocked: false, userCount: 0, updatedAt: "2026-10-26T03:42:00Z", updatedBy: mockPeople.nattapon },
];
