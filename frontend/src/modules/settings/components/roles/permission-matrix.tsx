"use client";

import { Info, KeyRound, Lock, ShieldCheck, Users, Wrench, type LucideIcon } from "lucide-react";
import { Picker } from "@/components/shared/picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MatrixRole, PermissionGroup, PermissionMatrix } from "../../types";
import { panelClass } from "../settings-ui";

// S24 tab ตารางสิทธิ์ (CR-001 design #roles): one card per group — desktop rows = roles, columns = permissions;
// phones pick one role and get a switch per permission. Cards and columns come from the matrix, never hard-coded.

/** Pending changes: `cellKey(roleId, permission)` → granted. A cell back at its loaded value is removed. */
export type Pending = Record<string, boolean>;

export const cellKey = (roleId: string, permission: string) => `${roleId}|${permission}`;

export function cellValue(pending: Pending, role: MatrixRole, permission: string): boolean {
  return pending[cellKey(role.id, permission)] ?? role.permissions.includes(permission);
}

const GROUP_ICONS: Record<string, LucideIcon> = { "repair.ticket": Wrench, "repair.team": Users, settings: ShieldCheck };

type MatrixProps = {
  matrix: PermissionMatrix;
  pending: Pending;
  onToggle: (role: MatrixRole, permission: string) => void;
  /** Row flashed after "เพิ่ม Role" (1.5s). */
  flashRoleId: string | null;
};

function GroupHeader({ group }: { group: PermissionGroup }) {
  const Icon = GROUP_ICONS[group.key] ?? KeyRound;
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3.5 lg:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <h3 className="min-w-0 flex-1 font-heading text-base font-semibold">{group.name}</h3>
      {group.isFixed ? (
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

/** Desktop (≥ 1024px): a table per group. */
export function MatrixDesktop({ matrix, pending, onToggle, flashRoleId }: MatrixProps) {
  return (
    <div className="space-y-4">
      {matrix.systems.flatMap((s) => s.groups).map((group) => (
        <section key={group.key} className={cn(panelClass, "overflow-hidden")} aria-label={group.name}>
          <GroupHeader group={group} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 text-[13px] text-muted-foreground">
                  <th scope="col" className="w-60 px-5 py-3.5 text-left font-medium">
                    Role / การกระทำ
                  </th>
                  {group.permissions.map((p) => (
                    <th key={p.key} scope="col" className="px-2 py-3.5 text-center font-medium">
                      <span className="inline-flex items-center gap-1">
                        {p.label}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`คำอธิบาย ${p.label}`}
                              className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                            >
                              <Info className="size-3.5" aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64">{p.description}</TooltipContent>
                        </Tooltip>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.roles.map((role) => (
                  <tr
                    key={role.id}
                    data-role-row={role.id}
                    className={cn(
                      "border-t transition-colors duration-500",
                      role.isLocked && "bg-muted/40",
                      flashRoleId === role.id && "bg-secondary",
                    )}
                  >
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-2">
                        {role.isLocked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0} className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                                <Lock className="size-3.5 text-muted-foreground" aria-label="Superadmin มีทุกสิทธิ์เสมอ" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Superadmin มีทุกสิทธิ์เสมอ</TooltipContent>
                          </Tooltip>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{role.name}</span>
                          <span className="block text-xs text-muted-foreground">{role.userCount.toLocaleString("th-TH")} คน</span>
                        </span>
                      </span>
                    </th>
                    {group.permissions.map((p) => {
                      const disabled = group.isFixed || role.isLocked;
                      const changed = cellKey(role.id, p.key) in pending;
                      const id = `cell-${role.id}-${p.key}`;
                      return (
                        <td key={p.key} className={cn("p-0 text-center", changed && "bg-secondary")}>
                          <label
                            htmlFor={id}
                            className={cn("relative flex h-14 items-center justify-center", !disabled && "cursor-pointer hover:bg-muted/60")}
                          >
                            <Checkbox
                              id={id}
                              checked={cellValue(pending, role, p.key)}
                              disabled={disabled}
                              onCheckedChange={() => onToggle(role, p.key)}
                              aria-label={`${p.label} — ${role.name}`}
                              className="size-4.5"
                            />
                            {changed && <span aria-hidden className="absolute top-3 left-1/2 ml-3 size-1.5 rounded-full bg-primary" />}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

type MobileProps = MatrixProps & { roleId: string; onRoleChange: (roleId: string) => void };

/** Phones (< 1024px): role picker + a switch per permission. Pending changes of other roles stay. */
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
      {matrix.systems.flatMap((s) => s.groups).map((group) => (
        <section key={group.key} className={cn(panelClass, "overflow-hidden")} aria-label={group.name}>
          <GroupHeader group={group} />
          <ul className="divide-y">
            {group.permissions.map((p) => {
              const disabled = group.isFixed || role.isLocked;
              const changed = cellKey(role.id, p.key) in pending;
              const id = `switch-${role.id}-${p.key}`;
              return (
                <li key={p.key} className={cn("flex min-h-16 items-center gap-3 px-4 py-3", changed && "bg-secondary/60")}>
                    <label htmlFor={id} className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {p.label}
                        {changed && <span aria-hidden className="size-1.5 rounded-full bg-primary" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.description}
                        {group.isFixed && " · กำหนดโดยระบบ"}
                      </span>
                    </label>
                    <Switch
                      id={id}
                      checked={cellValue(pending, role, p.key)}
                      disabled={disabled}
                      onCheckedChange={() => onToggle(role, p.key)}
                      aria-label={`${p.label} — ${role.name}`}
                    />
                  </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
