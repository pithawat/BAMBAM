// Mirrors the platform endpoints P1–P3 in docs/modules/settings/04-api-contract.md (changed in settings Stage 1).

/**
 * Keys of the seeded roles (glossary), in role order. Roles are data since settings Stage 1: `Me.role` can be any
 * key (custom roles get `r_` + 8 hex). Never branch UI on the key — use `can()` from `./permissions`.
 * repair CR-024: no `executive`.
 */
export const SEEDED_ROLES = ["super_admin", "employee", "housekeeper_lead", "security_lead", "technician", "admin"] as const;

export type SeededRole = (typeof SEEDED_ROLES)[number];

/** A role key: a seeded one or a custom `r_…` key. */
export type Role = string;

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
  /** Role key (UI never shows it). */
  role: Role;
  /** Role name to show everywhere a role is shown (navbar, profile, role switcher). */
  roleName: string;
  /** Effective permission keys: stored + the fixed `settings.*` keys of the role. Base permissions are not listed. */
  permissions: string[];
  technicianCategories: Ref[];
  isDemoUser: boolean;
  /** "DEV" | "UAT", null in production */
  environment: "DEV" | "UAT" | null;
};

/** P2 GET /api/v1/dev/demo-users item — one per role in role order. */
export type DemoUser = { role: Role; roleName: string; name: string };
