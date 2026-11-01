import { PERM } from "./permissions";
import type { DemoUser, Me, Role } from "./types";

// Sample people from docs/modules/repair/ui/screens/_common.md §8 and settings _common.md §7 (fictional).
// Permissions = the seeded matrix (settings 01-users.md → Permission catalog; CR-006 migration), in catalog order.
// The custom role got report + services like every role but technician (migration 20261030000002).

const ALL_PERMISSIONS: string[] = Object.values(PERM);
const SERVICES = [PERM.carBookingUse, PERM.roomBookingUse];
const ADMIN_SETTINGS = [PERM.settingsLocations, PERM.settingsAssets, PERM.settingsCategories, PERM.settingsContractorTypes,
  PERM.settingsUsersView, PERM.settingsUsers, PERM.settingsRoles, PERM.settingsAudit];

/** A custom role made in S24 (settings P2 example), to exercise "roles are data" in mock mode. */
export const MOCK_CUSTOM_ROLE = "r_7c21a9f0";
const base: Pick<Me, "technicianCategories" | "isDemoUser" | "environment"> = {
  technicianCategories: [],
  isDemoUser: true,
  environment: "DEV",
};

export const mockMeByRole: Record<Role, Me> = {
  super_admin: {
    ...base,
    id: "9a1c7e20-0000-4000-8000-000000000007",
    employeeCode: "EMP0105",
    name: "ณัฐพล อินทรวงศ์",
    position: "เจ้าหน้าที่ระบบ",
    department: "ฝ่ายเทคโนโลยีสารสนเทศ",
    division: "สายงานบริหารทั่วไป",
    email: "nattapon.i@example.co.th",
    role: "super_admin",
    roleName: "Superadmin",
    permissions: ALL_PERMISSIONS,
  },
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
    roleName: "พนักงานทั่วไป",
    permissions: [PERM.ticketReport, ...SERVICES],
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
    roleName: "หัวหน้าแม่บ้าน",
    permissions: [PERM.ticketReport, PERM.ticketTeamHandle, ...SERVICES],
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
    roleName: "หัวหน้ารปภ.",
    permissions: [PERM.ticketReport, PERM.ticketTeamHandle, ...SERVICES],
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
    roleName: "ช่างเทคนิค",
    permissions: [PERM.ticketViewAll, PERM.ticketWork, PERM.contractorManage],
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
    roleName: "Admin",
    permissions: [PERM.ticketReport, PERM.ticketViewAll, PERM.ticketCloseAny, PERM.ticketHandoverAny, PERM.overviewView, PERM.building3dView, ...SERVICES, ...ADMIN_SETTINGS],
  },
  [MOCK_CUSTOM_ROLE]: {
    ...base,
    id: "c4d5e6f7-0000-4000-8000-000000000008",
    employeeCode: "DEMO-R_7C21A9F0",
    name: "ผู้ใช้ตัวอย่าง หัวหน้าช่าง",
    position: null,
    department: null,
    division: null,
    email: null,
    role: MOCK_CUSTOM_ROLE,
    roleName: "หัวหน้าช่าง",
    permissions: [PERM.ticketReport, PERM.ticketViewAll, PERM.ticketWork, PERM.ticketCloseAny, ...SERVICES],
  },
};

export const mockDemoUsers: DemoUser[] = Object.values(mockMeByRole).map((m) => ({ role: m.role, roleName: m.roleName, name: m.name }));
