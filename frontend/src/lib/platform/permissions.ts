import type { Me } from "./types";

// Permission keys (docs/modules/settings/04-api-contract.md → Permission keys), in catalog order. Menus and buttons
// come from `Me.permissions`; the API checks every request again (repair CR-007 A, settings CR-001, CR-006).

export const PERM = {
  // settings CR-006: reporting is a key (every seeded role but technician), no longer a base right
  ticketReport: "repair.ticket.report",
  ticketViewAll: "repair.ticket.view_all",
  ticketWork: "repair.ticket.work",
  ticketCloseAny: "repair.ticket.close_any",
  ticketTeamHandle: "repair.ticket.team_handle",
  ticketHandoverAny: "repair.ticket.handover_any",
  contractorManage: "repair.contractor.manage",
  overviewView: "repair.overview.view",
  /** S29 3D models + site view; needs `overviewView` too (CR-006). */
  building3dView: "repair.building3d.view",
  // service access of the systems without a module yet (CR-006)
  carBookingUse: "car_booking.use",
  roomBookingUse: "room_booking.use",
  // Settings permissions — stored and tickable since CR-006 (default: admin all, super_admin always).
  settingsLocations: "settings.locations.manage",
  settingsAssets: "settings.assets.manage",
  settingsCategories: "settings.categories.manage",
  settingsContractorTypes: "settings.contractor_types.manage",
  settingsUsersView: "settings.users.view",
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
  PERM.settingsUsersView,
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

/** The "ตั้งค่าระบบ" entry (navbar, profile) shows for any `settings.*` permission (settings F25, CR-001, CR-006). */
export function canAnySettings(me: HasPermissions): boolean {
  return canAny(me, ...SETTINGS_PERMISSIONS);
}

/** S25 ผู้ใช้: `users.view` reads the list, `users.manage` also changes roles (implies view, CR-006). */
export function seesUsers(me: HasPermissions): boolean {
  return canAny(me, PERM.settingsUsersView, PERM.settingsUsers);
}

/** แจ้งซ่อม entries (Home CTA, สแกน QR, "แจ้งซ่อม" buttons, /repair/new): `repair.ticket.report` (CR-006). */
export function canReport(me: HasPermissions): boolean {
  return can(me, PERM.ticketReport);
}

/** S29 3D card and site view: overview + 3D (CR-006); without 3D, S29 shows the floor list only. */
export function sees3D(me: HasPermissions): boolean {
  return can(me, PERM.overviewView) && can(me, PERM.building3dView);
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
  if (can(me, PERM.ticketWork)) return "/repair/work";
  // repair CR-034: tracking needs `report`; a view-all role without it starts at งานทั้งหมด
  if (!can(me, PERM.ticketReport) && seesRepairQueue(me)) return "/repair/admin/queue";
  return "/repair/my";
}

export type ServiceKey = "repair" | "car" | "room";

/**
 * Services shown in the navbar, Home and the settings menu (settings CR-006): แจ้งซ่อม = any `repair.*` key (a
 * technician still gets the work list) · จองรถ = `car_booking.use` · จองห้องประชุม = `room_booking.use`.
 */
export function usesService(me: HasPermissions, service: ServiceKey): boolean {
  switch (service) {
    case "repair":
      return me.permissions.some((k) => k.startsWith("repair."));
    case "car":
      return can(me, PERM.carBookingUse);
    case "room":
      return can(me, PERM.roomBookingUse);
  }
}
