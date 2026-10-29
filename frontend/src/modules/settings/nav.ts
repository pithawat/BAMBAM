import { Building2, Car, DoorOpen, HardHat, History, Home, ShieldCheck, Tags, Users, Wrench, type LucideIcon } from "lucide-react";
import { can, PERM, repairHome, type PermissionKey } from "@/lib/platform/permissions";
import type { Me } from "@/lib/platform/types";

// Administration shell navigation (settings ui/screens/_common.md §1–§2, CR-001 / CR-003 / CR-004). Claude owns this
// file: the UI renders `settingsNav(me)` and asks `settingsAccess(me, pathname)` — it never checks roles itself.

/** The administration pages (one sidebar item each). */
export type SettingsPage = "buildings" | "categories" | "contractor-types" | "users" | "roles" | "audit";

export type SettingsNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Set for administration pages; service links have none. */
  page?: SettingsPage;
  /** Static item with the "เร็ว ๆ นี้" badge (not a link). */
  soon?: boolean;
};

export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

type PageDef = {
  page: SettingsPage;
  label: string;
  /** Page heading subtitle (the screen spec's CR-001 copy). */
  subtitle: string;
  icon: LucideIcon;
  permission: PermissionKey;
  forbiddenReason: string;
};

const SUPERADMIN_ONLY = "การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น";
const NO_ACCESS = "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ";

const MASTER_DATA: PageDef[] = [
  { page: "buildings", label: "อาคารและอุปกรณ์", subtitle: "เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น", icon: Building2, permission: PERM.settingsLocations, forbiddenReason: NO_ACCESS },
  { page: "categories", label: "หมวดงานและอาการ", subtitle: "จัดระเบียบหมวดงาน อาการ และความเร่งด่วนของงานแจ้งซ่อม", icon: Tags, permission: PERM.settingsCategories, forbiddenReason: NO_ACCESS },
  { page: "contractor-types", label: "ประเภทผู้รับเหมา", subtitle: "ประเภทที่ช่างเลือกตอนประเมินงาน ช่างเพิ่มประเภทใหม่เองได้ด้วย", icon: HardHat, permission: PERM.settingsContractorTypes, forbiddenReason: SUPERADMIN_ONLY },
];
const IDENTITY: PageDef[] = [
  { page: "users", label: "ผู้ใช้", subtitle: "จัดการบทบาทของทุกคนที่เข้าใช้ BAMBAM ผ่าน SSO", icon: Users, permission: PERM.settingsUsers, forbiddenReason: SUPERADMIN_ONLY },
  { page: "roles", label: "Role และสิทธิ์", subtitle: "กำหนดว่าแต่ละบทบาททำอะไรได้ใน BAMBAM", icon: ShieldCheck, permission: PERM.settingsRoles, forbiddenReason: SUPERADMIN_ONLY },
  { page: "audit", label: "ประวัติการเปลี่ยนแปลง", subtitle: "ทุกการเปลี่ยนในตั้งค่าระบบ ใครทำ เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร · ไม่มีการลบประวัติ", icon: History, permission: PERM.settingsAudit, forbiddenReason: SUPERADMIN_ONLY },
];
const PAGES = [...MASTER_DATA, ...IDENTITY];

export const settingsHref = (page: SettingsPage) => `/settings/${page}`;

/** Where `/settings` lands for Admin and Superadmin (owner 2026-10-26). */
export const SETTINGS_HOME = settingsHref("buildings");

const allowed = (me: Me, defs: PageDef[]) =>
  defs.filter((d) => can(me, d.permission)).map((d): SettingsNavItem => ({ label: d.label, href: settingsHref(d.page), icon: d.icon, page: d.page }));

/** Sidebar / drawer groups in order: บริการ · ข้อมูลกลาง · ผู้ใช้และสิทธิ์. Items without permission and empty groups are left out. */
export function settingsNav(me: Me): SettingsNavGroup[] {
  const groups: SettingsNavGroup[] = [
    {
      label: "บริการ",
      items: [
        { label: "หน้าแรก", href: "/", icon: Home },
        { label: "แจ้งซ่อม", href: repairHome(me), icon: Wrench },
        { label: "จองรถ", href: "/car-booking", icon: Car, soon: true },
        { label: "จองห้องประชุม", href: "/room-booking", icon: DoorOpen, soon: true },
      ],
    },
    { label: "ข้อมูลกลาง", items: allowed(me, MASTER_DATA) },
    { label: "ผู้ใช้และสิทธิ์", items: allowed(me, IDENTITY) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** The administration page of a pathname (`/settings/users/…` → `users`); null for `/settings` itself or unknown paths. */
export function settingsPageOf(pathname: string): SettingsPage | null {
  const seg = pathname.split("/")[2];
  return PAGES.find((d) => d.page === seg)?.page ?? null;
}

/** Title and subtitle of a page's heading. */
export function settingsHeading(page: SettingsPage): { title: string; subtitle: string } {
  const d = PAGES.find((x) => x.page === page);
  return { title: d?.label ?? "ตั้งค่าระบบ", subtitle: d?.subtitle ?? "" };
}

export type SettingsAccess =
  | { allowed: true }
  | { allowed: false; title: string; reason: string; action?: { label: string; href: string } };

/**
 * Access to the page of `pathname` (BR-ALL-1). Not allowed → render the Forbidden state with exactly this copy and
 * never any page data; the action goes to อาคารและอุปกรณ์ when the viewer has that page (else the default "กลับหน้าแรก").
 */
export function settingsAccess(me: Me, pathname: string): SettingsAccess {
  const page = PAGES.find((d) => d.page === settingsPageOf(pathname));
  if (page && can(me, page.permission)) return { allowed: true };
  const home = can(me, PERM.settingsLocations) && page?.page !== "buildings" ? { label: "ไปที่อาคารและอุปกรณ์", href: SETTINGS_HOME } : undefined;
  return { allowed: false, title: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", reason: page?.forbiddenReason ?? NO_ACCESS, action: home };
}

/** Decorative mascot beside the page heading (CR-003): guardian for Superadmin, planner for everyone else. `alt=""`. */
export function settingsMascot(me: Me): { src: string; alt: "" } {
  return {
    src: me.role === "super_admin" ? "/brand/bam-mascot-superadmin-guardian-white.webp" : "/brand/bam-mascot-admin-planner-white.webp",
    alt: "",
  };
}
