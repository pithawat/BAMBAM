"use client";

import Link from "next/link";
import { Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { RoleListItem } from "../../types";
import { panelClass } from "../settings-ui";
import { usersOfRoleHref } from "./role-dialogs";

// S24 tab รายการ Role (CR-001 block): table on desktop, cards on phones. `isSystem` → no ลบ; `isLocked` → no menu;
// CR-006 `guard` (own role) → no menu, `Lock` + "Role ของคุณ" instead.

type Props = { roles: RoleListItem[]; onEdit: (role: RoleListItem) => void; onDelete: (role: RoleListItem) => void };

function SystemBadge() {
  return (
    <Badge variant="secondary" className="gap-1 bg-secondary text-secondary-foreground">
      <Lock className="size-3" aria-hidden />
      Role ระบบ
    </Badge>
  );
}

function UsersLink({ role }: { role: RoleListItem }) {
  return (
    <Link href={usersOfRoleHref(role)} className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30">
      {role.userCount.toLocaleString("th-TH")} คน
    </Link>
  );
}

function RowMenu({ role, onEdit, onDelete }: { role: RoleListItem } & Omit<Props, "roles">) {
  if (role.guard === "OWN_ROLE" && !role.isLocked) {
    return (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs whitespace-nowrap text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        Role ของคุณ
      </span>
    );
  }
  if (role.isLocked || role.guard) return <span className="block size-11" aria-hidden />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`ตัวเลือกของ ${role.name}`}
          className="grid size-11 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={() => onEdit(role)} className="min-h-10">
          <Pencil aria-hidden />
          แก้ไข Role
        </DropdownMenuItem>
        {!role.isSystem && (
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(role)} className="min-h-10">
            <Trash2 aria-hidden />
            ลบ Role
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoleList({ roles, onEdit, onDelete }: Props) {
  return (
    <>
      <div className={cn(panelClass, "hidden overflow-hidden lg:block")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
              <th scope="col" className="w-1/4 px-5 py-3.5 font-medium">Role</th>
              <th scope="col" className="px-3 py-3.5 font-medium">คำอธิบาย</th>
              <th scope="col" className="w-32 px-3 py-3.5 font-medium">ผู้ใช้</th>
              <th scope="col" className="w-16 px-3 py-3.5"><span className="sr-only">ตัวเลือก</span></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t">
                <th scope="row" className="px-5 py-2 text-left font-medium">
                  <span className="flex flex-wrap items-center gap-2">
                    {r.name}
                    {r.isSystem && <SystemBadge />}
                  </span>
                </th>
                <td className="px-3 py-2 text-muted-foreground">{r.description || "—"}</td>
                <td className="px-3 py-2"><UsersLink role={r} /></td>
                <td className="px-3 py-2 text-right"><RowMenu role={r} onEdit={onEdit} onDelete={onDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cn(panelClass, "divide-y lg:hidden")}>
        {roles.map((r) => (
          <li key={r.id} className="flex items-start gap-2 py-3 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {r.name}
                {r.isSystem && <SystemBadge />}
              </p>
              {r.description && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{r.description}</p>}
              <UsersLink role={r} />
            </div>
            <RowMenu role={r} onEdit={onEdit} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </>
  );
}
