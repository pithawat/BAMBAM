"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { useDiscardGuard } from "@/components/shared/use-discard-guard";
import { ErrorState, ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPermissionMatrix, getRoles, savePermissionMatrix } from "../../api";
import { settingsHeading } from "../../nav";
import type { MatrixRole, PermissionMatrix, Role } from "../../types";
import { SettingsHeading } from "../settings-heading";
import { errorCode, GENERIC_ERROR, panelClass, sheetOnMobile } from "../settings-ui";
import { cellKey, MatrixDesktop, MatrixMobile, type Pending } from "./permission-matrix";
import { DeleteRoleDialog, RoleFormDialog } from "./role-dialogs";
import { RoleList } from "./role-list";

// S24 Role และสิทธิ์ (F29; spec screens/S24-roles-permissions.md + CR-001 block; design CR-001-admin-settings.html#roles).

type Tab = "permissions" | "roles";

export function RolesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab: Tab = search.get("tab") === "roles" ? "roles" : "permissions";
  const desktop = useIsDesktop();

  const [matrix, setMatrix] = useState<PermissionMatrix>();
  const [roles, setRoles] = useState<Role[]>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<Pending>({});
  const [mobileRoleId, setMobileRoleId] = useState("");
  const [flashRoleId, setFlashRoleId] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<PermissionMatrix | null>(null);
  const [form, setForm] = useState<{ open: boolean; role?: Role }>({ open: false });
  const [deleting, setDeleting] = useState<Role | null>(null);

  const count = Object.keys(pending).length;
  const guard = useDiscardGuard(count > 0);

  useEffect(() => {
    let active = true;
    Promise.all([getPermissionMatrix(), getRoles()]).then(
      ([m, r]) => {
        if (!active) return;
        setMatrix(m);
        setRoles(r);
        setError(undefined);
      },
      (err: unknown) => {
        if (active) setError(err);
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);

  // The row flash after "เพิ่ม Role" lasts 1.5s.
  useEffect(() => {
    if (!flashRoleId) return;
    const t = window.setTimeout(() => setFlashRoleId(null), 1500);
    return () => window.clearTimeout(t);
  }, [flashRoleId]);

  function setTab(next: Tab) {
    const q = new URLSearchParams(search);
    q.set("tab", next);
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  function toggle(role: MatrixRole, permission: string) {
    const k = cellKey(role.id, permission);
    const original = role.permissions.includes(permission);
    setPending((p) => {
      const next = { ...p };
      const current = k in p ? p[k] : original;
      if (!current === original) delete next[k];
      else next[k] = !current;
      return next;
    });
  }

  async function reloadAll() {
    const [m, r] = await Promise.all([getPermissionMatrix(), getRoles()]);
    setMatrix(m);
    setRoles(r);
    return { m, r };
  }

  async function save() {
    if (!matrix) return;
    setSaving(true);
    try {
      const changes = Object.entries(pending).map(([k, granted]) => {
        const [roleId, permission] = k.split("|");
        return { roleId, permission, granted };
      });
      const next = await savePermissionMatrix({ version: matrix.version, changes });
      setMatrix(next);
      setPending({});
      setSaveOpen(false);
      toast.success("บันทึกสิทธิ์แล้ว");
      getRoles().then(setRoles, () => undefined);
    } catch (err) {
      const code = errorCode(err);
      if (code === "VERSION_CONFLICT") {
        try {
          setConflict(await getPermissionMatrix());
        } catch {
          toast.error(GENERIC_ERROR);
        }
      } else if (code === "ROLE_NOT_FOUND") {
        setSaveOpen(false);
        toast.error(GENERIC_ERROR);
        reloadAll().catch(() => undefined);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setSaving(false);
    }
  }

  /** "โหลดข้อมูลล่าสุด": take the fresh matrix and re-apply the pending changes that still differ. */
  function loadLatest() {
    if (!conflict) return;
    const fresh = conflict;
    setPending((p) => {
      const next: Pending = {};
      for (const [k, granted] of Object.entries(p)) {
        const [roleId, permission] = k.split("|");
        const role = fresh.roles.find((r) => r.id === roleId);
        if (role && !role.isLocked && role.permissions.includes(permission) !== granted) next[k] = granted;
      }
      return next;
    });
    setMatrix(fresh);
    setConflict(null);
    setSaveOpen(false);
    toast.info("โหลดข้อมูลล่าสุดแล้ว ตรวจการเปลี่ยนแปลงอีกครั้งก่อนบันทึก");
    getRoles().then(setRoles, () => undefined);
  }

  async function afterRoleSaved(role: Role, added: boolean) {
    setForm({ open: false });
    toast.success(added ? `เพิ่ม Role "${role.name}" แล้ว` : "บันทึกแล้ว");
    try {
      await reloadAll();
    } catch {
      toast.error(GENERIC_ERROR);
      return;
    }
    if (added) {
      setFlashRoleId(role.id);
      setMobileRoleId(role.id);
      window.requestAnimationFrame(() => document.querySelector(`[data-role-row="${role.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
  }

  const heading = settingsHeading("roles");
  const addButton = (
    <Button className="h-11 px-4" onClick={() => setForm({ open: true })} disabled={!roles}>
      <Plus aria-hidden />
      เพิ่ม Role
    </Button>
  );

  if (error !== undefined) {
    return (
      <>
        <SettingsHeading {...heading} />
        <section className={panelClass}>
          {errorCode(error) === "FORBIDDEN" ? (
            <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason="การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น" />
          ) : (
            <ErrorState hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่" onRetry={() => setRevision((r) => r + 1)} />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <SettingsHeading {...heading} action={addButton} />

      <div role="tablist" aria-label="Role และสิทธิ์" className="mb-4 inline-flex gap-1 rounded-xl border bg-muted/70 p-1">
        <TabButton active={tab === "permissions"} onClick={() => setTab("permissions")} controls="roles-panel">
          ตารางสิทธิ์
        </TabButton>
        <TabButton active={tab === "roles"} onClick={() => setTab("roles")} controls="roles-panel">
          รายการ Role
          <span className="rounded-md bg-card px-1.5 text-xs text-muted-foreground tabular-nums">{roles?.length ?? "–"}</span>
        </TabButton>
      </div>

      <div id="roles-panel" role="tabpanel" aria-label={tab === "roles" ? "รายการ Role" : "ตารางสิทธิ์"}>
        {tab === "permissions" && (
          <div className="mb-4 flex gap-2.5 rounded-xl border border-primary/15 bg-secondary/60 px-4 py-3.5 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">ทุก Role แจ้งซ่อมและติดตามงานตัวเองได้เสมอ</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Superadmin มีทุกสิทธิ์ · สิทธิ์ตั้งค่าระบบล็อกตามขอบเขตของผู้ดูแล</p>
            </div>
          </div>
        )}

        {!matrix || !roles ? (
          <MatrixSkeleton />
        ) : tab === "roles" ? (
          <RoleList roles={roles} onEdit={(role) => setForm({ open: true, role })} onDelete={setDeleting} />
        ) : (
          <>
            {desktop ? (
              <MatrixDesktop matrix={matrix} pending={pending} onToggle={toggle} flashRoleId={flashRoleId} />
            ) : (
              <MatrixMobile
                matrix={matrix}
                pending={pending}
                onToggle={toggle}
                flashRoleId={flashRoleId}
                roleId={mobileRoleId || (matrix.roles.find((r) => !r.isLocked)?.id ?? matrix.roles[0].id)}
                onRoleChange={setMobileRoleId}
              />
            )}
            <p className="mt-4 flex gap-2 text-[13px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              ความเร่งด่วนกำหนดจากอาการที่เลือกตอนแจ้งซ่อม ตั้งค่าได้ที่ “หมวดงานและอาการ”
            </p>
          </>
        )}
      </div>

      {count > 0 && matrix && (
        <div className="sticky bottom-3 z-20 mt-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-float lg:bottom-6 lg:gap-3 lg:pl-5">
          <p className="min-w-0 flex-1 text-sm font-semibold" aria-live="polite">
            เปลี่ยนสิทธิ์ {count} รายการ
          </p>
          <Button variant="outline" className="h-11" onClick={() => setPending({})}>
            ยกเลิกการเปลี่ยนแปลง
          </Button>
          <Button className="h-11" onClick={() => { setConflict(null); setSaveOpen(true); }}>
            บันทึกสิทธิ์
          </Button>
        </div>
      )}

      {matrix && (
        <SaveDialog
          open={saveOpen}
          onOpenChange={(o) => !saving && setSaveOpen(o)}
          matrix={matrix}
          pending={pending}
          saving={saving}
          conflict={conflict}
          onSave={save}
          onLoadLatest={loadLatest}
        />
      )}

      {roles && (
        <RoleFormDialog
          role={form.role}
          roles={roles}
          open={form.open}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
          onSaved={afterRoleSaved}
          onStale={() => reloadAll().catch(() => undefined)}
        />
      )}

      <DeleteRoleDialog
        role={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDeleted={(role) => {
          setDeleting(null);
          toast.success(`ลบ Role "${role.name}" แล้ว`);
          // Its pending matrix changes go with it.
          setPending((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(`${role.id}|`))));
          reloadAll().catch(() => undefined);
        }}
        onStale={async (role, code) => {
          try {
            const { r } = await reloadAll();
            const fresh = r.find((x) => x.id === role.id);
            if (code === "ROLE_IN_USE" && fresh) setDeleting(fresh);
            else {
              setDeleting(null);
              toast.error(GENERIC_ERROR);
            }
          } catch {
            setDeleting(null);
            toast.error(GENERIC_ERROR);
          }
        }}
      />

      <AlertDialog open={guard.open} onOpenChange={guard.setOpen}>
        <AlertDialogContent className={sheetOnMobile}>
          <AlertDialogHeader>
            <AlertDialogTitle>ออกโดยไม่บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>มีการเปลี่ยนแปลง {count} รายการที่ยังไม่บันทึก</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>อยู่ต่อ</AlertDialogCancel>
            <Button variant="destructive" onClick={guard.discard}>
              ออกโดยไม่บันทึก
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TabButton({ active, onClick, controls, children }: { active: boolean; onClick: () => void; controls: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30",
        active ? "bg-card font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MatrixSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: 3 }, (_, c) => (
        <div key={c} className={cn(panelClass, "overflow-hidden")}>
          <div className="flex items-center gap-3 border-b px-5 py-3.5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-12 rounded-none" />
          {Array.from({ length: 7 }, (_, r) => (
            <div key={r} className="flex items-center gap-6 border-t px-5 py-4">
              <Skeleton className="h-4 w-36" />
              <div className="flex flex-1 justify-around">
                {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="size-4.5" />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type SaveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matrix: PermissionMatrix;
  pending: Pending;
  saving: boolean;
  conflict: PermissionMatrix | null;
  onSave: () => void;
  onLoadLatest: () => void;
};

/** "บันทึกการเปลี่ยนสิทธิ์?" — per role with changes: name, users, added / removed labels. */
function SaveDialog({ open, onOpenChange, matrix, pending, saving, conflict, onSave, onLoadLatest }: SaveDialogProps) {
  const labels = new Map(matrix.systems.flatMap((s) => s.groups.flatMap((g) => g.permissions.map((p) => [p.key, p.label] as const))));
  const byRole = new Map<string, { added: string[]; removed: string[] }>();
  for (const [k, granted] of Object.entries(pending)) {
    const [roleId, permission] = k.split("|");
    const entry = byRole.get(roleId) ?? { added: [], removed: [] };
    (granted ? entry.added : entry.removed).push(labels.get(permission) ?? permission);
    byRole.set(roleId, entry);
  }
  const rows = matrix.roles.filter((r) => byRole.has(r.id));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={sheetOnMobile}>
        <AlertDialogHeader>
          <AlertDialogTitle>บันทึกการเปลี่ยนสิทธิ์?</AlertDialogTitle>
          <AlertDialogDescription>มีผลในการใช้งานครั้งถัดไป โดยไม่ต้องออกจากระบบ</AlertDialogDescription>
        </AlertDialogHeader>
        {conflict && (
          <Alert className="border-warning/30 bg-warning/5 text-foreground">
            <AlertTriangle className="text-warning" aria-hidden />
            <AlertDescription className="text-foreground">
              <p>
                สิทธิ์ถูกแก้โดย {conflict.updatedBy?.name ?? "ผู้ใช้อื่น"} เมื่อ {formatDateTime(conflict.updatedAt)}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onLoadLatest}>
                โหลดข้อมูลล่าสุด
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {rows.map((r) => {
            const c = byRole.get(r.id)!;
            return (
              <li key={r.id} className="rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm">
                <p className="font-semibold">
                  {r.name} <span className="font-normal text-muted-foreground">· ผู้ใช้ {r.userCount.toLocaleString("th-TH")} คน</span>
                </p>
                {c.added.length > 0 && <p className="mt-1">เพิ่ม: {c.added.join(", ")}</p>}
                {c.removed.length > 0 && <p className="mt-1">ถอด: {c.removed.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>ยกเลิก</AlertDialogCancel>
          <Button onClick={onSave} disabled={saving || !!conflict}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            บันทึกสิทธิ์
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
