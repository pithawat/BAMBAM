import { Building2, HardHat, History, ShieldCheck, Tags, Users, Wrench, type LucideIcon } from "lucide-react";
import { canAny, PERM, type PermissionKey } from "@/lib/platform/permissions";
import type { Me } from "@/lib/platform/types";
import { LABELS_PATH } from "./labels";

// Settings navigation (settings ui/screens/_common.md §2, CR-006: the navbar "ตั้งค่าระบบ" dropdown). Claude owns this
// file: the UI renders `settingsMenu(me)` and asks `settingsAccess(me, pathname)` — it never checks roles itself.

/** The administration pages. */
export type SettingsPage = "buildings" | "categories" | "contractor-types" | "users" | "roles" | "audit";

type PageDef = {
  page: SettingsPage;
  label: string;
  /** Page heading subtitle (the screen spec's CR-001 copy). */
  subtitle: string;
  icon: LucideIcon;
  /** Any of them opens the page (CR-006: ผู้ใช้ = users.view or users.manage). */
  permissions: PermissionKey[];
};

// CR-006: every settings key is tickable, so no page is "Superadmin only" any more.
const NO_ACCESS = "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ";

const MASTER_DATA: PageDef[] = [
  { page: "buildings", label: "อาคารและอุปกรณ์", subtitle: "เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น", icon: Building2, permissions: [PERM.settingsLocations] },
  { page: "categories", label: "หมวดงานและอาการ", subtitle: "จัดระเบียบหมวดงาน อาการ และความเร่งด่วนของงานแจ้งซ่อม", icon: Tags, permissions: [PERM.settingsCategories] },
  { page: "contractor-types", label: "ประเภทผู้รับเหมา", subtitle: "ประเภทที่ช่างเลือกตอนประเมินงาน ช่างเพิ่มประเภทใหม่เองได้ด้วย", icon: HardHat, permissions: [PERM.settingsContractorTypes] },
];
const IDENTITY: PageDef[] = [
  { page: "users", label: "ผู้ใช้", subtitle: "จัดการบทบาทของทุกคนที่เข้าใช้ BAMBAM ผ่าน SSO", icon: Users, permissions: [PERM.settingsUsersView, PERM.settingsUsers] },
  { page: "roles", label: "Role และสิทธิ์", subtitle: "กำหนดว่าแต่ละบทบาททำอะไรได้ใน BAMBAM", icon: ShieldCheck, permissions: [PERM.settingsRoles] },
  { page: "audit", label: "ประวัติการเปลี่ยนแปลง", subtitle: "ทุกการเปลี่ยนในตั้งค่าระบบ ใครทำ เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร · ไม่มีการลบประวัติ", icon: History, permissions: [PERM.settingsAudit] },
];
const PAGES = [...MASTER_DATA, ...IDENTITY];

export const settingsHref = (page: SettingsPage) => `/settings/${page}`;

/** Where `/settings` lands for Admin and Superadmin (owner 2026-10-26). */
export const SETTINGS_HOME = settingsHref("buildings");

/** Where the "ตั้งค่าระบบ" entry goes: อาคารและอุปกรณ์ when allowed, else the first page the viewer has (CR-006). */
export function settingsEntry(me: Me): string {
  const first = PAGES.find((d) => canAny(me, ...d.permissions));
  return first && first.page !== "buildings" && !canAny(me, PERM.settingsLocations) ? settingsHref(first.page) : SETTINGS_HOME;
}

/** One sub-menu of the "ตั้งค่าระบบ" dropdown. `soon`: shown with "เร็ว ๆ นี้", not a link. */
export type SettingsMenuItem = { label: string; href: string; soon?: boolean };

/** One group of the dropdown (left column), its sub-menus on the right (CR-006 `_common.md` §2). */
export type SettingsMenuGroup = { key: string; name: string; description: string; icon: LucideIcon; items: SettingsMenuItem[] };

const tabHref = (tab: string) => `${SETTINGS_HOME}?tab=${tab}`;

/**
 * The navbar "ตั้งค่าระบบ" dropdown (CR-006): สถานที่และอุปกรณ์ · การให้บริการ · ผู้ใช้งานและสิทธิ์. Items without
 * permission and empty groups are left out; the booking items ("เร็ว ๆ นี้") only show in a group that has a real page.
 */
export function settingsMenu(me: Me): SettingsMenuGroup[] {
  const has = (...keys: PermissionKey[]) => canAny(me, ...keys);
  const items = (list: (SettingsMenuItem | false)[]) => list.filter((i): i is SettingsMenuItem => !!i);
  const services = items([
    has(PERM.settingsCategories) && { label: "หมวดงานและอาการ", href: settingsHref("categories") },
    has(PERM.settingsContractorTypes) && { label: "ประเภทผู้รับเหมา", href: settingsHref("contractor-types") },
  ]);
  const groups: SettingsMenuGroup[] = [
    {
      key: "places",
      name: "สถานที่และอุปกรณ์",
      description: "จัดการพื้นที่และทรัพย์สิน",
      icon: Building2,
      items: items([
        has(PERM.settingsLocations) && { label: "อาคารและอุปกรณ์", href: SETTINGS_HOME },
        has(PERM.settingsLocations) && { label: "ประเภทอาคาร", href: tabHref("building-types") },
        has(PERM.settingsLocations) && has(PERM.settingsAssets) && { label: "ประเภทอุปกรณ์", href: tabHref("asset-types") },
        has(PERM.settingsAssets) && { label: "พิมพ์ป้าย QR", href: LABELS_PATH },
      ]),
    },
    {
      key: "services",
      name: "การให้บริการ",
      description: "กำหนดบริการในองค์กร",
      icon: Wrench,
      items: services.length
        ? [...services, { label: "การจองรถ", href: "/car-booking", soon: true }, { label: "การจองห้องประชุม", href: "/room-booking", soon: true }]
        : [],
    },
    {
      key: "identity",
      name: "ผู้ใช้งานและสิทธิ์",
      description: "ดูแลสมาชิกและการเข้าถึง",
      icon: Users,
      items: items([
        has(PERM.settingsUsersView, PERM.settingsUsers) && { label: "ผู้ใช้งาน", href: settingsHref("users") },
        has(PERM.settingsRoles) && { label: "บทบาทและสิทธิ์", href: settingsHref("roles") },
        has(PERM.settingsAudit) && { label: "ประวัติการเปลี่ยนแปลง", href: settingsHref("audit") },
      ]),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** The dropdown item of the current URL (S20 tabs count as their own item; S22 detail → หมวดงานและอาการ). */
export function settingsMenuCurrent(pathname: string, tab: string | null): string | null {
  const page = settingsPageOf(pathname);
  if (!page) return null;
  if (pathname.startsWith(LABELS_PATH)) return LABELS_PATH;
  if (page === "buildings" && (tab === "building-types" || tab === "asset-types")) return tabHref(tab);
  return settingsHref(page);
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
  // S30 พิมพ์ป้าย QR (CR-007) lives under อาคารและอุปกรณ์ but needs the asset key, not the locations one.
  const labels = pathname.startsWith(LABELS_PATH);
  if (labels ? canAny(me, PERM.settingsAssets) : page && canAny(me, ...page.permissions)) return { allowed: true };
  const home = canAny(me, PERM.settingsLocations) && page?.page !== "buildings" ? { label: "ไปที่อาคารและอุปกรณ์", href: SETTINGS_HOME } : undefined;
  return { allowed: false, title: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้", reason: NO_ACCESS, action: home };
}

/** Decorative mascot beside the page heading (CR-003): guardian for Superadmin, planner for everyone else. `alt=""`. */
export function settingsMascot(me: Me): { src: string; alt: "" } {
  return {
    src: me.role === "super_admin" ? "/brand/bam-mascot-superadmin-guardian-white.webp" : "/brand/bam-mascot-admin-planner-white.webp",
    alt: "",
  };
}
