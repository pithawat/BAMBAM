// Mirrors the platform endpoints P1–P3 in docs/modules/repair/04-api-contract.md.

export const ROLES = [
  "employee",
  "housekeeper_lead",
  "security_lead",
  "technician",
  "admin",
  "executive",
] as const;

export type Role = (typeof ROLES)[number];

/** { id, name } reference used across the API contract. */
export type Ref = { id: string; name: string };

/** P1 GET /api/v1/me */
export type Me = {
  id: string;
  employeeCode: string;
  name: string;
  position: string | null;
  department: string | null;
  division: string | null;
  email: string | null;
  role: Role;
  technicianCategories: Ref[];
  isDemoUser: boolean;
  /** "DEV" | "UAT", null in production */
  environment: "DEV" | "UAT" | null;
};

/** P2 GET /api/v1/dev/demo-users item */
export type DemoUser = { role: Role; name: string };
