"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { changeUserRole, guardRule } from "../../api";
import type { RoleListItem, UserSummary } from "../../types";
import { errorCode, GENERIC_ERROR, sheetOnMobile } from "../settings-ui";
import { Initials, LOCK_COPY } from "./user-bits";

// S25 change-role dialog (CR-001 block, design user-role-confirmation-desktop.png): radio grid of roles with the
// current one marked, Superadmin warning, live summary, confirm only for a different role. CR-006: only `assignable`
// roles (+ the current one) are offered.

type Props = {
  user: UserSummary | null;
  roles: RoleListItem[];
  onOpenChange: (open: boolean) => void;
  onChanged: (user: UserSummary) => void;
  /** ROLE_NOT_FOUND: the role list is stale; the caller refetches it. */
  onRolesStale: () => void;
};

export function ChangeRoleDialog({ user, roles, onOpenChange, onChanged, onRolesStale }: Props) {
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [seen, setSeen] = useState<string | null>(null);
  const openFor = user?.id ?? null;
  if (openFor !== seen) {
    setSeen(openFor);
    if (user) {
      setRoleId(user.role.id);
      setError(null);
    }
  }

  const offered = roles.filter((r) => r.assignable || r.id === user?.role.id);
  const picked = offered.find((r) => r.id === roleId);
  const changed = !!user && !!picked && picked.id !== user.role.id;

  async function confirm() {
    if (!user || !picked || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const next = await changeUserRole(user.id, picked.id);
      toast.success(`เปลี่ยน Role ของ ${user.name} เป็น ${next.role.name} แล้ว`);
      onChanged(next);
    } catch (err) {
      const code = errorCode(err);
      const rule = guardRule(err);
      if (rule === "SUPER_ADMIN") setError(LOCK_COPY.SUPER_ADMIN);
      else if (rule === "OWN_ROLE") setError(LOCK_COPY.SELF);
      else if (rule === "ESCALATION") {
        setError("เลือกได้เฉพาะ Role ที่มีสิทธิ์ไม่เกินของคุณ");
        setRoleId(user.role.id);
        onRolesStale();
      } else if (code === "CANNOT_CHANGE_SELF") setError(LOCK_COPY.SELF);
      else if (code === "ROLE_LOCKED") setError(LOCK_COPY.LOCKED_BY_ENV);
      else if (code === "ROLE_NOT_FOUND") {
        setError("Role นี้ถูกลบไปแล้ว เลือกใหม่");
        setRoleId(user.role.id);
        onRolesStale();
      } else if (code === "USER_NOT_FOUND") {
        toast.error("ไม่พบผู้ใช้นี้");
        onOpenChange(false);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={cn(sheetOnMobile, "lg:max-w-xl data-[size=default]:lg:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">เปลี่ยน Role</DialogTitle>
          <DialogDescription className="text-[13.5px]">กำหนดบทบาทให้เหมาะกับหน้าที่ของผู้ใช้</DialogDescription>
        </DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Initials name={user.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {user.employeeCode}
                  {user.department && ` · ${user.department}`}
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-[13px] text-destructive">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">
                Role ใหม่ <span className="text-destructive">*</span>
              </legend>
              <RadioGroup value={roleId} onValueChange={setRoleId} className="grid gap-2 sm:grid-cols-2">
                {offered.map((r) => {
                  const id = `new-role-${r.id}`;
                  return (
                    <label
                      key={r.id}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3.5 text-sm transition-colors hover:bg-muted/50",
                        roleId === r.id && "border-primary bg-secondary/60 text-primary ring-1 ring-primary",
                      )}
                    >
                      <RadioGroupItem id={id} value={r.id} />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      {r.id === user.role.id && <span className="text-xs text-muted-foreground">ปัจจุบัน</span>}
                    </label>
                  );
                })}
              </RadioGroup>
            </fieldset>

            {changed && picked.key === "super_admin" && (
              <Alert className="border-warning/30 bg-warning/5">
                <AlertTriangle className="text-warning" aria-hidden />
                <AlertDescription className="text-foreground">ผู้ใช้นี้จะตั้งค่าระบบและเปลี่ยนสิทธิ์ของทุกคนได้</AlertDescription>
              </Alert>
            )}

            {changed && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm" aria-live="polite">
                <p>
                  เปลี่ยน <span className="font-semibold">{user.name}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  จาก <span className="font-semibold">{user.role.name}</span>
                  <ArrowRight className="size-3.5" aria-label="เป็น" />
                  <span className="font-semibold">{picked.name}</span>
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="-mx-5 -mb-5 px-5">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="button" disabled={!changed || busy} onClick={confirm}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            ยืนยันเปลี่ยน Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
