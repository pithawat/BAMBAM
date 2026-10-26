import type { Me } from "./types";

// Permission keys (docs/modules/settings/04-api-contract.md → Permission keys). Menus and buttons come from
// `Me.permissions`; the API checks every request again (repair CR-007 A, settings CR-001).

export const PERM = {
  ticketViewAll: "repair.ticket.view_all",
  ticketWork: "repair.ticket.work",
  ticketCloseAny: "repair.ticket.close_any",
  ticketTeamHandle: "repair.ticket.team_handle",
  ticketHandoverAny: "repair.ticket.handover_any",
  contractorManage: "repair.contractor.manage",
  overviewView: "repair.overview.view",
  // Fixed settings permissions — granted from the role key (admin: locations / assets / categories; super_admin: all).
  settingsLocations: "settings.locations.manage",
  settingsAssets: "settings.assets.manage",
  settingsCategories: "settings.categories.manage",
  settingsContractorTypes: "settings.contractor_types.manage",
  settingsUsers: "settings.users.manage",
  settingsRoles: "settings.roles.manage",
  settingsAudit: "settings.audit.view",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

export const SETTINGS_PERMISSIONS: readonly PermissionKey[] = [
  PERM.settingsLocations,
  PERM.settingsAssets,
  PERM.settingsCategories,
  PERM.settingsContractorTypes,
  PERM.settingsUsers,
  PERM.settingsRoles,
  PERM.settingsAudit,
];

type HasPermissions = Pick<Me, "permissions">;

export function can(me: HasPermissions, key: PermissionKey): boolean {
  return me.permissions.includes(key);
}

export function canAny(me: HasPermissions, ...keys: PermissionKey[]): boolean {
  return keys.some((k) => can(me, k));
}

/** The "ตั้งค่าระบบ" entry (navbar, profile) shows for any `settings.*` permission (settings F25, CR-001). */
export function canAnySettings(me: HasPermissions): boolean {
  return canAny(me, ...SETTINGS_PERMISSIONS);
}

/**
 * D-050: the repair staff tools ("งานทั้งหมด", "ช่างภายนอก" in that group, "ภาพรวมอาคาร") show for anyone with
 * `close_any`, `handover_any` or `overview.view` — today that is Admin and Superadmin.
 */
export function managesRepair(me: HasPermissions): boolean {
  return canAny(me, PERM.ticketCloseAny, PERM.ticketHandoverAny, PERM.overviewView);
}

/** S11 งานทั้งหมด and the staff entry to S18: a repair manager who sees every ticket (D-050). */
export function seesRepairQueue(me: HasPermissions): boolean {
  return managesRepair(me) && can(me, PERM.ticketViewAll);
}

/** Start route of the repair service: the work list for whoever works tickets (CR-005), else own tickets. */
export function repairHome(me: HasPermissions): string {
  return can(me, PERM.ticketWork) ? "/repair/work" : "/repair/my";
}
