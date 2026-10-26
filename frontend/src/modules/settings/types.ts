// Mirrors docs/modules/settings/04-api-contract.md. Stage 1: `Role` (#2). Later stages add their objects here.

/** `PersonRef` (same as repair). */
export type PersonRef = { id: string; name: string; department: string | null };

/** `Role` — #2 GET /api/v1/settings/roles item. Order: super_admin, the seeded roles, then custom roles by creation. */
export type Role = {
  id: string;
  /** Stable key (`employee` … `super_admin`, custom `r_` + 8 hex). The UI never shows it. */
  key: string;
  name: string;
  description: string;
  /** `employee`, `super_admin`: cannot be deleted. */
  isSystem: boolean;
  /** `super_admin` only: cannot be edited, has every permission. */
  isLocked: boolean;
  /** Users with this role (demo users excluded). */
  userCount: number;
  updatedAt: string;
  updatedBy: PersonRef | null;
};

/** Error codes of this module (04-api-contract.md → Error codes). */
export type SettingsErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "NAME_TAKEN"
  | "VERSION_CONFLICT"
  | "IN_USE"
  | "ROLE_IN_USE"
  | "SYSTEM_ROLE"
  | "UNKNOWN_PERMISSION"
  | "CANNOT_CHANGE_SELF"
  | "ROLE_LOCKED"
  | "FIXED_PERMISSION"
  | "ASSET_CODE_TAKEN"
  | "CODE_PREFIX_TAKEN"
  | "ASSET_NOT_FOUND"
  | "ASSET_TYPE_NOT_FOUND"
  | "ROLE_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "BUILDING_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "SYMPTOM_NOT_FOUND"
  | "CONTRACTOR_TYPE_NOT_FOUND";
