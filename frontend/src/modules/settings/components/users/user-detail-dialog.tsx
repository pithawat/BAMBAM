"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getUser } from "../../api";
import type { UserDetail } from "../../types";
import { errorCode, sheetOnMobile } from "../settings-ui";
import { FixedRoleNote, Initials, LOCK_COPY } from "./user-bits";

// S25 detail (CR-001 block): "ข้อมูลผู้ใช้" dialog / bottom sheet — SSO fields, Role with "เปลี่ยน Role", role history
// newest first ending with the first login. `revision` bumps after a role change so it reloads.

type Props = {
  userId: string | null;
  revision: number;
  onOpenChange: (open: boolean) => void;
  onChangeRole: (user: UserDetail) => void;
};

export function UserDetailDialog({ userId, revision, onOpenChange, onChangeRole }: Props) {
  const [detail, setDetail] = useState<UserDetail>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getUser(userId).then(
      (d) => { if (active) { setDetail(d); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [userId, revision, retry]);

  // A different user starts from the skeleton.
  const [shown, setShown] = useState(userId);
  if (shown !== userId) {
    setShown(userId);
    setDetail(undefined);
    setError(undefined);
  }

  const notFound = errorCode(error) === "USER_NOT_FOUND";
  const d = detail && detail.id === userId ? detail : undefined;

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sheetOnMobile, "lg:max-w-xl data-[size=default]:lg:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">ข้อมูลผู้ใช้</DialogTitle>
          <DialogDescription className="text-[13.5px]">ข้อมูลพนักงานจาก RMC SSO</DialogDescription>
        </DialogHeader>

        {notFound ? (
          <div className="py-6 text-center">
            <p className="font-semibold">ไม่พบผู้ใช้นี้</p>
            <Button variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>ปิด</Button>
          </div>
        ) : error !== undefined ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>โหลดข้อมูลผู้ใช้ไม่สำเร็จ</AlertTitle>
              <AlertDescription>ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง</AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => setRetry((r) => r + 1)}>ลองอีกครั้ง</Button>
          </div>
        ) : !d ? (
          <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลด">
            <div className="flex items-center gap-3"><Skeleton className="size-14 rounded-full" /><Skeleton className="h-5 w-48" /></div>
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Initials name={d.name} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-semibold">{d.name}</p>
                <p className="text-[13px] text-muted-foreground">{d.employeeCode}</p>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              {([
                ["รหัสพนักงาน", d.employeeCode],
                ["อีเมล", d.email],
                ["แผนก", d.department],
                ["ฝ่าย", d.division],
                ["ตำแหน่ง", d.position],
                ["เข้าใช้ล่าสุด", d.lastLoginAt ? formatDateTime(d.lastLoginAt) : null],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>

            <section className="border-t pt-4">
              <h3 className="text-sm font-semibold">Role</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="flex-1 font-medium">
                  {d.role.name}
                  {d.roleLockedByEnv && <FixedRoleNote className="ml-2" />}
                </span>
                <Button variant="outline" disabled={!d.canChangeRole} onClick={() => onChangeRole(d)} aria-describedby={d.cannotChangeReason ? "role-lock-reason" : undefined}>
                  เปลี่ยน Role
                </Button>
              </div>
              {d.cannotChangeReason && (
                <p id="role-lock-reason" className="mt-1.5 text-xs text-muted-foreground">{LOCK_COPY[d.cannotChangeReason]}</p>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold">ประวัติ Role</h3>
              <ol className="mt-2 space-y-2 border-l pl-4 text-sm">
                {d.roleHistory.map((h, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>{" "}
                    <span className="font-medium">{h.from} → {h.to}</span>
                    {h.actor && <span className="text-muted-foreground"> โดย{h.actor.name}</span>}
                  </li>
                ))}
                <li>
                  <span className="text-muted-foreground">{formatDateTime(d.firstLoginAt)}</span> เข้าใช้ครั้งแรก (
                  {d.roleHistory.length ? d.roleHistory[d.roleHistory.length - 1].from : d.role.name})
                </li>
              </ol>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
