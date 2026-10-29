"use client";

import { Info, LogOut } from "lucide-react";
import { LogoutDialog } from "@/components/shared/logout-dialog";
import { useCurrentUser } from "@/components/shared/me-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { initials, ROLE_LABELS } from "@/lib/platform/roles";
import type { Me } from "@/lib/platform/types";

// S14 — โปรไฟล์ (read-only, BR-F01-3). Shows only the claims listed in the spec.

export default function ProfilePage() {
  const me = useCurrentUser();
  return (
    <>
      <PageHeader title="โปรไฟล์" variant="brand">
        <div className="flex flex-col items-center pb-2 text-center">
          <Avatar me={me} onGradient />
          <p className="mt-2 font-heading text-2xl leading-[34px] font-semibold">{me.name}</p>
          <p className="text-[13.5px] text-white/90">{me.position ?? "—"}</p>
        </div>
      </PageHeader>

      <div className="relative -mt-13.5 space-y-3 px-4 lg:mx-auto lg:mt-0 lg:max-w-190 lg:px-0">
        <Card className="hidden flex-row items-center gap-4 rounded-xl border-0 p-5 shadow-card lg:flex">
          <Avatar me={me} />
          <div>
            <p className="font-heading text-xl font-semibold">{me.name}</p>
            <p className="text-[13.5px] text-muted-foreground">{me.position ?? "—"}</p>
          </div>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4.5">
          <Card className="gap-0 rounded-xl border-0 p-4.5 shadow-float lg:shadow-card">
            <h2 className="mb-2 font-heading text-base font-semibold">ข้อมูลจาก RMC SSO</h2>
            <dl className="divide-y divide-border">
              <Row label="รหัสพนักงาน" value={me.employeeCode} />
              <Row label="ชื่อ-นามสกุล" value={me.name} />
              <Row label="ตำแหน่ง" value={me.position} />
              <Row label="ฝ่าย / แผนก" value={joinDept(me.department, me.division)} />
              <Row label="อีเมล" value={me.email} />
            </dl>
          </Card>

          <Card className="gap-0 rounded-xl border-0 p-4.5 shadow-card">
            <h2 className="mb-3 font-heading text-base font-semibold">บทบาทใน BAMBAM</h2>
            <div>
              <Badge variant="secondary" className="h-7 rounded-full px-3 text-[13.5px]">
                {ROLE_LABELS[me.role]}
              </Badge>
            </div>
            {me.role === "technician" && (
              <div className="mt-4">
                <p className="text-[13.5px] font-medium text-muted-foreground">หมวดงานที่รับผิดชอบ</p>
                {me.technicianCategories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {me.technicianCategories.map((c) => (
                      <Badge key={c.id} variant="outline" className="h-7 rounded-full px-3 text-[13.5px]">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[13.5px]">ยังไม่ได้กำหนดหมวดงาน ติดต่อ Admin</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {me.isDemoUser && (
          <Alert>
            <Info aria-hidden />
            <AlertTitle className="font-semibold">คุณกำลังใช้ผู้ใช้ตัวอย่างในโหมดทดสอบ</AlertTitle>
            <AlertDescription>ข้อมูลในหน้านี้เป็นข้อมูลตัวอย่าง ไม่ใช่บัญชีของคุณ</AlertDescription>
          </Alert>
        )}

        <p className="pt-1 text-center text-[12.5px] text-muted-foreground lg:text-left">
          ข้อมูลอัปเดตจาก RMC SSO ทุกครั้งที่เข้าสู่ระบบ แก้ไขในแอปนี้ไม่ได้
        </p>

        <div className="lg:flex lg:justify-end">
          <LogoutDialog
            trigger={
              <Button variant="outline" className="w-full lg:w-auto">
                <LogOut aria-hidden />
                ออกจากระบบ
              </Button>
            }
          />
        </div>

        {me.environment && (
          <p className="pb-2 text-center text-[12.5px] text-muted-foreground">
            BAMBAM · {me.environment} · v{env.appVersion}
          </p>
        )}
      </div>
    </>
  );
}

function Avatar({ me, onGradient }: { me: Me; onGradient?: boolean }) {
  return (
    <span
      className={
        onGradient
          ? "grid size-18 place-items-center rounded-full border-2 border-white bg-white/20 font-heading text-2xl font-semibold text-white"
          : "grid size-18 place-items-center rounded-full bg-brand font-heading text-2xl font-semibold text-white"
      }
      aria-hidden
    >
      {initials(me.name)}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13.5px] text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{value || "—"}</dd>
    </div>
  );
}

function joinDept(department: string | null, division: string | null): string | null {
  const parts = [department, division].filter(Boolean);
  return parts.length ? parts.join(" / ") : null;
}
