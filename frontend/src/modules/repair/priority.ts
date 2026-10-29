import type { Category, Priority, PrioritySource } from "./types";

// BR-F02-2 (CR-008): the system sets the priority — the most urgent picked symptom; with only a
// typed symptom the category default; a typed category ("อื่นๆ") starts at medium.
// Same rule as the backend `ticketPriority` (rules.go); S03 uses it to explain the level before
// sending, the mocks to create tickets.

const RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export type PriorityResult = {
  priority: Priority;
  source: PrioritySource;
  /** The symptom that set it (`source = symptom`). */
  symptom?: string;
};

export function ticketPriority(category: Category | undefined, symptomIds: string[], typedCategory: boolean): PriorityResult {
  if (typedCategory || !category) return { priority: "medium", source: "default" };
  const picked = category.symptoms
    .filter((s) => symptomIds.includes(s.id))
    .sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  if (picked.length) return { priority: picked[0].priority, source: "symptom", symptom: picked[0].name };
  return { priority: category.defaultPriority, source: "category" };
}

/** Why the ticket has its level (S03 explanation, S05, S07 facts). */
export function priorityReason(r: { source: PrioritySource; symptom?: string; categoryName?: string }): string {
  switch (r.source) {
    case "symptom":
      return r.symptom ? `ระบบกำหนดจากอาการ “${r.symptom}”` : "ระบบกำหนดจากอาการที่แจ้ง";
    case "category":
      return r.categoryName ? `ใช้ระดับเริ่มต้นของหมวด${r.categoryName}` : "ใช้ระดับเริ่มต้นของหมวดงาน";
    case "default":
      return "ใช้ระดับเริ่มต้นสำหรับหมวดอื่นๆ";
    case "admin":
      return "Admin ปรับระดับแล้ว";
    case "reporter":
      return "ผู้แจ้งเลือกเอง";
  }
}
