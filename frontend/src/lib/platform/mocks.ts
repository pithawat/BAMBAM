import type { DemoUser, Me, Role } from "./types";

// Sample people from docs/modules/repair/ui/screens/_common.md §8 (fictional).
const base: Pick<Me, "technicianCategories" | "isDemoUser" | "environment"> = {
  technicianCategories: [],
  isDemoUser: true,
  environment: "DEV",
};

export const mockMeByRole: Record<Role, Me> = {
  employee: {
    ...base,
    id: "a3d9e2b4-1f6c-4e8a-b2d7-5c9f0e1a2b33",
    employeeCode: "600123",
    name: "วรรณา สุขประเสริฐ",
    position: "พนักงานบัญชีอาวุโส",
    department: "ฝ่ายบัญชี",
    division: "แผนกบัญชีทั่วไป",
    email: "wanna.s@example.co.th",
    role: "employee",
  },
  housekeeper_lead: {
    ...base,
    id: "b1c2d3e4-0000-4000-8000-000000000002",
    employeeCode: "DEMO-HOUSEKEEPER-LEAD",
    name: "มาลี ทองดี",
    position: null,
    department: "ฝ่ายอาคารสถานที่",
    division: null,
    email: null,
    role: "housekeeper_lead",
  },
  security_lead: {
    ...base,
    id: "b1c2d3e4-0000-4000-8000-000000000003",
    employeeCode: "DEMO-SECURITY-LEAD",
    name: "สมศักดิ์ แก้วกล้า",
    position: null,
    department: "ฝ่ายอาคารสถานที่",
    division: null,
    email: null,
    role: "security_lead",
  },
  technician: {
    ...base,
    id: "d2e8a1b0-0000-4000-8000-000000000004",
    employeeCode: "DEMO-TECHNICIAN",
    name: "ธนากร พึ่งบุญ",
    position: null,
    department: "ฝ่ายอาคารสถานที่",
    division: null,
    email: null,
    role: "technician",
    technicianCategories: [
      { id: "6f1c2a90-0000-4000-8000-000000000001", name: "ระบบปรับอากาศ" },
      { id: "6f1c2a90-0000-4000-8000-000000000002", name: "ไฟฟ้าและแสงสว่าง" },
    ],
  },
  admin: {
    ...base,
    id: "b1c2d3e4-0000-4000-8000-000000000005",
    employeeCode: "DEMO-ADMIN",
    name: "ปวีณา ศรีสุข",
    position: null,
    department: "ศูนย์จัดการงานอาคาร",
    division: null,
    email: null,
    role: "admin",
  },
  executive: {
    ...base,
    id: "b1c2d3e4-0000-4000-8000-000000000006",
    employeeCode: "DEMO-EXECUTIVE",
    name: "ประเสริฐ วงศ์ไทย",
    position: null,
    department: "ผู้อำนวยการฝ่ายอาคารสถานที่",
    division: null,
    email: null,
    role: "executive",
  },
};

export const mockDemoUsers: DemoUser[] = Object.values(mockMeByRole).map((m) => ({ role: m.role, name: m.name }));
