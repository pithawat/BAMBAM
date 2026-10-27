"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Picker } from "@/components/shared/picker";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createRole, deleteRole, getRoles, updateRole } from "../../api";
import type { Role } from "../../types";
import { errorCode, errorFields, GENERIC_ERROR, sheetOnMobile } from "../settings-ui";

// S24 role dialogs (CR-001 block): add / edit Role, delete (two variants). Copy from the S24 spec + HANDOFF Stage 2.

const NAME_MAX = 50;
const DESCRIPTION_MAX = 200;
const BASE = "base";

const len = (s: string) => [...s.trim()].length;

export const usersOfRoleHref = (role: Pick<Role, "id">) => `/settings/users?role=${role.id}`;

type FormProps = {
  /** undefined = add. */
  role?: Role;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a successful save (add → the new role). */
  onSaved: (role: Role, added: boolean) => void;
  /** VERSION_CONFLICT / ROLE_NOT_FOUND on edit: the caller refetches. */
  onStale: () => void;
};

export function RoleFormDialog({ role, roles, open, onOpenChange, onSaved, onStale }: FormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(BASE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reset each time the dialog opens (the parent opens it, so onOpenChange does not fire on open).
  const [seen, setSeen] = useState(false);
  if (open !== seen) {
    setSeen(open);
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setStart(BASE);
      setErrors({});
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "กรุณากรอกชื่อ Role";
    else if (len(name) > NAME_MAX) local.name = `ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`;
    if (len(description) > DESCRIPTION_MAX) local.description = `คำอธิบายยาวได้ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร`;
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (role) {
        const input: { name?: string; description?: string; updatedAt: string } = { updatedAt: role.updatedAt };
        if (name.trim() !== role.name) input.name = name.trim();
        if (description.trim() !== role.description) input.description = description.trim();
        if (input.name === undefined && input.description === undefined) {
          onOpenChange(false);
          return;
        }
        onSaved(await updateRole(role.id, input), false);
      } else {
        onSaved(await createRole({ name: name.trim(), description: description.trim(), copyFromRoleId: start === BASE ? null : start }), true);
      }
    } catch (err) {
      const code = errorCode(err);
      const f = errorFields(err);
      if (code === "NAME_TAKEN") setErrors({ name: "ชื่อนี้มีอยู่แล้ว" });
      else if (code === "VALIDATION_FAILED" && Object.keys(f).length) {
        setErrors({
          ...(f.name ? { name: f.name === "TOO_LONG" ? `ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร` : "กรุณากรอกชื่อ Role" } : {}),
          ...(f.description ? { description: `คำอธิบายยาวได้ไม่เกิน ${DESCRIPTION_MAX} ตัวอักษร` } : {}),
          ...(f.copyFromRoleId ? { start: "กรุณาเลือก Role ที่จะคัดลอก" } : {}),
        });
      } else if (role && code === "VERSION_CONFLICT") {
        // Someone edited it first: say who, from the refetched role.
        const fresh = await getRoles().then((rs) => rs.find((r) => r.id === role.id), () => undefined);
        toast.error(fresh?.updatedBy ? `ข้อมูลนี้ถูกแก้โดย ${fresh.updatedBy.name} เมื่อ ${formatDateTime(fresh.updatedAt)}` : GENERIC_ERROR);
        onOpenChange(false);
        onStale();
      } else if (code === "ROLE_NOT_FOUND") {
        toast.error(GENERIC_ERROR);
        onOpenChange(false);
        onStale();
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const title = role ? "แก้ไข Role" : "เพิ่ม Role";
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={sheetOnMobile}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13.5px]">
            {role ? "เปลี่ยนชื่อหรือคำอธิบาย สิทธิ์แก้ได้ที่ตารางสิทธิ์" : "ตั้งชื่อ Role แล้วเลือกสิทธิ์เริ่มต้น ปรับสิทธิ์เพิ่มได้ที่ตารางสิทธิ์"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="role-name" label="ชื่อ Role" required error={errors.name}>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น หัวหน้าช่าง"
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? "role-name-error" : undefined}
              className="h-11"
              autoFocus
            />
          </Field>
          <Field id="role-description" label="คำอธิบาย" error={errors.description}>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Role นี้ใช้กับใคร"
              aria-invalid={!!errors.description || undefined}
              aria-describedby={errors.description ? "role-description-error" : undefined}
              rows={3}
            />
          </Field>
          {!role && (
            <Field id="role-start" label="เริ่มต้นสิทธิ์" error={errors.start} hint="คัดลอกเฉพาะสิทธิ์งานซ่อม สิทธิ์ตั้งค่าระบบสงวนตามบทบาทผู้ดูแล">
              <Picker
                id="role-start"
                aria-labelledby="role-start-label"
                aria-describedby="role-start-hint"
                title="เริ่มต้นสิทธิ์"
                placeholder="เลือกสิทธิ์เริ่มต้น"
                value={start}
                onValueChange={setStart}
                invalid={!!errors.start}
                options={[{ value: BASE, label: "สิทธิ์พื้นฐานเท่านั้น" }, ...roles.map((r) => ({ value: r.id, label: `คัดลอกจาก ${r.name}` }))]}
              />
            </Field>
          )}
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {role ? "บันทึก" : "เพิ่ม Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, required, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label id={`${id}-label`} htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

type DeleteProps = {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (role: Role) => void;
  /** ROLE_IN_USE / ROLE_NOT_FOUND from the server: the caller refetches and shows the fresh state. */
  onStale: (role: Role, code: string | undefined) => void;
};

/** Delete Role: blocked variant when it still has users (no call), confirm variant otherwise. */
export function DeleteRoleDialog({ role, onOpenChange, onDeleted, onStale }: DeleteProps) {
  const [busy, setBusy] = useState(false);
  const blocked = !!role && role.userCount > 0;

  async function remove() {
    if (!role) return;
    setBusy(true);
    try {
      await deleteRole(role.id);
      onDeleted(role);
    } catch (err) {
      const code = errorCode(err);
      if (code === "ROLE_IN_USE" || code === "ROLE_NOT_FOUND") onStale(role, code);
      else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!role} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className={sheetOnMobile}>
        {role && blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบ Role นี้ไม่ได้</AlertDialogTitle>
              <AlertDialogDescription>
                มีผู้ใช้ {role.userCount.toLocaleString("th-TH")} คนใน Role &quot;{role.name}&quot; ย้ายไป Role อื่นก่อน
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ปิด</AlertDialogCancel>
              <Button asChild>
                <Link href={usersOfRoleHref(role)}>ดูผู้ใช้</Link>
              </Button>
            </AlertDialogFooter>
          </>
        ) : role ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบ Role &quot;{role.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>ลบถาวร กู้คืนไม่ได้</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
              <Button variant="destructive" disabled={busy} onClick={remove} className={cn(busy && "cursor-wait")}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                ลบ Role
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
