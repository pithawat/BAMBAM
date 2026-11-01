"use client";

import { CalendarCheck, Info, KeyRound, Lock, ShieldCheck, Users, Wrench, type LucideIcon } from "lucide-react";
import { Picker } from "@/components/shared/picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GuardRule, MatrixRole, PermissionDef, PermissionGroup, PermissionMatrix } from "../../types";
import { panelClass } from "../settings-ui";

// S24 tab ตารางสิทธิ์ (CR-001 design #roles): one card per system (owner 2026-11-01) — desktop rows = roles, columns =
// permissions under their group; phones pick one role and get a switch per permission.
// Cards and columns come from the matrix, never hard-coded.

/** Pending changes: `cellKey(roleId, permission)` → granted. A cell back at its loaded value is removed. */
export type Pending = Record<string, boolean>;

export const cellKey = (roleId: string, permission: string) => `${roleId}|${permission}`;

export function cellValue(pending: Pending, role: MatrixRole, permission: string): boolean {
  return pending[cellKey(role.id, permission)] ?? role.permissions.includes(permission);
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  repair: Wrench,
  "repair.access": Wrench,
  "repair.ticket": Wrench,
  "repair.team": Users,
  "services.booking": CalendarCheck,
  settings: ShieldCheck,
};

// CR-006 lock reasons (HANDOFF Stage R1, word for word).
const SUPER_ADMIN_ROW = "Superadmin มีทุกสิทธิ์เสมอ";
const OWN_ROLE = "แก้สิทธิ์ของ role ตัวเองไม่ได้";
const NOT_GRANTABLE = "ให้ได้เฉพาะสิทธิ์ที่คุณมี";

/** Toast after `403 PERMISSION_GUARD` on save / edit / delete (nothing was saved). */
export const GUARD_COPY: Record<GuardRule, string> = {
  OWN_ROLE,
  SUPER_ADMIN: "แก้สิทธิ์ของ Superadmin ไม่ได้",
  ESCALATION: NOT_GRANTABLE,
};

/** Why the whole row is disabled for this viewer, or null. */
export function rowLock(role: MatrixRole): string | null {
  if (role.isLocked || role.guard === "SUPER_ADMIN") return SUPER_ADMIN_ROW;
  if (role.guard === "OWN_ROLE") return OWN_ROLE;
  return null;
}

/**
 * Why a cell is disabled, or null. One reason, in order: row (`isLocked` / `guard`) → fixed group → column
 * (`grantable`) → requires (checked against the value with pending changes).
 */
export function cellLock(matrix: PermissionMatrix, pending: Pending, role: MatrixRole, group: PermissionGroup, p: PermissionDef): string | null {
  const row = rowLock(role);
  if (row) return row;
  if (group.isFixed) return "กำหนดโดยระบบ";
  if (!matrix.grantable.includes(p.key)) return NOT_GRANTABLE;
  if (p.requires && !cellValue(pending, role, p.requires)) return `ต้องติ๊ก "${permissionLabel(matrix, p.requires)}" ก่อน`;
  return null;
}

function permissionLabel(matrix: PermissionMatrix, key: string): string {
  for (const s of matrix.systems) for (const g of s.groups) for (const p of g.permissions) if (p.key === key) return p.label;
  return key;
}

/** Keys whose `requires` is `key` (unticking `key` unticks these in the same row). */
export function dependentsOf(matrix: PermissionMatrix, key: string): string[] {
  return matrix.systems.flatMap((s) => s.groups.flatMap((g) => g.permissions.filter((p) => p.requires === key).map((p) => p.key)));
}

/** Pending changes still allowed against `matrix` (after a guard refusal or "โหลดข้อมูลล่าสุด"). */
export function keepAllowed(matrix: PermissionMatrix, pending: Pending): Pending {
  const groups = matrix.systems.flatMap((s) => s.groups);
  const next: Pending = {};
  for (const [k, granted] of Object.entries(pending)) {
    const [roleId, permission] = k.split("|");
    const role = matrix.roles.find((r) => r.id === roleId);
    if (role && role.permissions.includes(permission) !== granted) next[k] = granted;
  }
  // Drop disabled cells until nothing changes (dropping a requirement can disable its dependent).
  for (let changed = true; changed; ) {
    changed = false;
    for (const k of Object.keys(next)) {
      const [roleId, permission] = k.split("|");
      const role = matrix.roles.find((r) => r.id === roleId)!;
      const group = groups.find((g) => g.permissions.some((p) => p.key === permission));
      const def = group?.permissions.find((p) => p.key === permission);
      if (!group || !def || cellLock(matrix, next, role, group, def)) {
        delete next[k];
        changed = true;
      }
    }
  }
  return next;
}

type MatrixProps = {
  matrix: PermissionMatrix;
  pending: Pending;
  onToggle: (role: MatrixRole, permission: string) => void;
  /** Row flashed after "เพิ่ม Role" (1.5s). */
  flashRoleId: string | null;
};

/**
 * One card per system (owner 2026-11-01): ระบบแจ้งซ่อม's groups share one table under a group header row; a system with
 * a single group keeps that group's name as its title.
 */
type MatrixCard = { key: string; title: string; groups: PermissionGroup[] };

function matrixCards(matrix: PermissionMatrix): MatrixCard[] {
  return matrix.systems
    .filter((s) => s.groups.length > 0)
    .map((s) => (s.groups.length > 1 ? { key: s.key, title: s.name, groups: s.groups } : { key: s.groups[0].key, title: s.groups[0].name, groups: s.groups }));
}

function CardHeader({ card }: { card: MatrixCard }) {
  const Icon = GROUP_ICONS[card.key] ?? KeyRound;
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3.5 lg:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <h3 className="min-w-0 flex-1 font-heading text-base font-semibold">{card.title}</h3>
      {card.groups.every((g) => g.isFixed) ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          กำหนดโดยระบบ
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">ติ๊กเพื่อให้สิทธิ์</span>
      )}
    </div>
  );
}

function PermissionHeader({ p, divider }: { p: PermissionDef; divider: boolean }) {
  return (
    <th scope="col" className={cn("px-2 py-3 text-center align-bottom font-medium", divider && "border-l")}>
      <span className="inline-flex items-center gap-1">
        {p.label}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`คำอธิบาย ${p.label}`}
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{p.description}</TooltipContent>
        </Tooltip>
      </span>
    </th>
  );
}

/** Desktop (≥ 1024px): a table per card; with several groups the columns sit under their group's name. */
export function MatrixDesktop({ matrix, pending, onToggle, flashRoleId }: MatrixProps) {
  return (
    <div className="space-y-4">
      {matrixCards(matrix).map((card) => {
        const grouped = card.groups.length > 1;
        const columns = card.groups.reduce((n, g) => n + g.permissions.length, 0);
        // a vertical rule before the first column of every group but the first
        const divider = (gi: number, pi: number) => grouped && gi > 0 && pi === 0;
        return (
          <section key={card.key} className={cn(panelClass, "overflow-hidden")} aria-label={card.title}>
            <CardHeader card={card} />
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 208 + columns * 100 }}>
                <thead className="bg-muted/50 text-[13px] text-muted-foreground">
                  {grouped && (
                    <tr>
                      <th scope="col" rowSpan={2} className="w-52 px-5 py-3 text-left align-bottom font-medium">
                        Role / การกระทำ
                      </th>
                      {card.groups.map((g, gi) => (
                        <th
                          key={g.key}
                          scope="colgroup"
                          colSpan={g.permissions.length}
                          className={cn("border-b px-2 pt-3 pb-2 text-center text-xs font-semibold text-foreground", gi > 0 && "border-l")}
                        >
                          {g.name}
                        </th>
                      ))}
                    </tr>
                  )}
                  <tr>
                    {!grouped && (
                      <th scope="col" className="w-52 px-5 py-3 text-left font-medium">
                        Role / การกระทำ
                      </th>
                    )}
                    {card.groups.map((g, gi) => g.permissions.map((p, pi) => <PermissionHeader key={p.key} p={p} divider={divider(gi, pi)} />))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.roles.map((role) => (
                    <tr
                      key={role.id}
                      data-role-row={role.id}
                      className={cn(
                        "border-t transition-colors duration-500",
                        rowLock(role) && "bg-muted/40",
                        flashRoleId === role.id && "bg-secondary",
                      )}
                    >
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        <span className="flex items-center gap-2">
                          {rowLock(role) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0} className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                                  <Lock className="size-3.5 text-muted-foreground" aria-label={rowLock(role)!} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{rowLock(role)}</TooltipContent>
                            </Tooltip>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{role.name}</span>
                            <span className="block text-xs text-muted-foreground">{role.userCount.toLocaleString("th-TH")} คน</span>
                          </span>
                        </span>
                      </th>
                      {card.groups.map((group, gi) =>
                        group.permissions.map((p, pi) => (
                          <MatrixCell key={p.key} matrix={matrix} pending={pending} onToggle={onToggle} role={role} group={group} p={p} divider={divider(gi, pi)} />
                        )),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type CellProps = Omit<MatrixProps, "flashRoleId"> & { role: MatrixRole; group: PermissionGroup; p: PermissionDef; divider: boolean };

function MatrixCell({ matrix, pending, onToggle, role, group, p, divider }: CellProps) {
  const reason = cellLock(matrix, pending, role, group, p);
  // the row header already says why a whole row is locked
  const cellReason = reason && reason !== rowLock(role) ? reason : null;
  const changed = cellKey(role.id, p.key) in pending;
  const id = `cell-${role.id}-${p.key}`;
  const cell = (
    <label htmlFor={id} className={cn("relative flex h-14 items-center justify-center", !reason && "cursor-pointer hover:bg-muted/60")}>
      <Checkbox
        id={id}
        checked={cellValue(pending, role, p.key)}
        disabled={!!reason}
        onCheckedChange={() => onToggle(role, p.key)}
        aria-label={`${p.label} — ${role.name}`}
        aria-describedby={reason ? `${id}-reason` : undefined}
        className="size-4.5"
      />
      {reason && <span id={`${id}-reason`} className="sr-only">{reason}</span>}
      {changed && <span aria-hidden className="absolute top-3 left-1/2 ml-3 size-1.5 rounded-full bg-primary" />}
    </label>
  );
  return (
    <td className={cn("p-0 text-center", divider && "border-l", changed && "bg-secondary")}>
      {cellReason ? (
        <Tooltip>
          <TooltipTrigger asChild>{cell}</TooltipTrigger>
          <TooltipContent className="max-w-64">{cellReason}</TooltipContent>
        </Tooltip>
      ) : (
        cell
      )}
    </td>
  );
}

type MobileProps = MatrixProps & { roleId: string; onRoleChange: (roleId: string) => void };

/** Phones (< 1024px): role picker + a switch per permission, one card per system. Pending changes of other roles stay. */
export function MatrixMobile({ matrix, pending, onToggle, roleId, onRoleChange }: MobileProps) {
  const role = matrix.roles.find((r) => r.id === roleId) ?? matrix.roles[0];
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label id="matrix-role-label" className="text-sm font-semibold">
          เลือก Role ที่ต้องการตั้งค่า
        </label>
        <Picker
          aria-labelledby="matrix-role-label"
          title="เลือก Role ที่ต้องการตั้งค่า"
          placeholder="เลือก Role"
          value={role.id}
          onValueChange={onRoleChange}
          options={matrix.roles.map((r) => ({ value: r.id, label: `${r.name} · ${r.userCount.toLocaleString("th-TH")} คน` }))}
        />
      </div>
      {matrixCards(matrix).map((card) => (
        <section key={card.key} className={cn(panelClass, "overflow-hidden")} aria-label={card.title}>
          <CardHeader card={card} />
          <ul className="divide-y">
            {card.groups.map((group) => (
              <li key={group.key}>
                {card.groups.length > 1 && <p className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground">{group.name}</p>}
                <ul className="divide-y">
                  {group.permissions.map((p) => {
                    const reason = cellLock(matrix, pending, role, group, p);
                    const changed = cellKey(role.id, p.key) in pending;
                    const id = `switch-${role.id}-${p.key}`;
                    return (
                      <li key={p.key} className={cn("flex min-h-16 items-center gap-3 px-4 py-3", changed && "bg-secondary/60")}>
                        <label htmlFor={id} className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {p.label}
                            {changed && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{p.description}</span>
                          {reason && (
                            <span id={`${id}-reason`} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="size-3 shrink-0" aria-hidden />
                              {reason}
                            </span>
                          )}
                        </label>
                        <Switch
                          id={id}
                          checked={cellValue(pending, role, p.key)}
                          disabled={!!reason}
                          onCheckedChange={() => onToggle(role, p.key)}
                          aria-label={`${p.label} — ${role.name}`}
                          aria-describedby={reason ? `${id}-reason` : undefined}
                        />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
