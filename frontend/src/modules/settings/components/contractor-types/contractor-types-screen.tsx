"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createContractorType, deleteContractorType, getContractorTypes, updateContractorType } from "../../api";
import type { ContractorTypeAdmin } from "../../types";
import { ConfirmDialog, type Confirm } from "../confirm-dialog";
import { ConflictAlert, conflictText, FieldLabel, FormError } from "../places/place-dialogs";
import { SettingsHeading } from "../settings-heading";
import { errorCode, errorFields, GENERIC_ERROR, panelClass, sheetOnMobile } from "../settings-ui";

// S23 ประเภทผู้รับเหมา (F28; spec screens/S23-contractor-types.md + CR-001 block): one panel with the types (Thai
// name order, no manual order), client-side search, add / rename / (de)activate / delete.

export function ContractorTypesScreen() {
  const [types, setTypes] = useState<ContractorTypeAdmin[]>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<ContractorTypeAdmin | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    let active = true;
    getContractorTypes().then(
      (list) => { if (active) { setTypes(list); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [revision]);

  async function reload() {
    const list = await getContractorTypes();
    setTypes(list);
    return list;
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (types ?? []).filter((t) => (showInactive || t.isActive) && (!needle || t.name.toLowerCase().includes(needle)));
  }, [types, q, showInactive]);

  function failed(err: unknown) {
    const code = errorCode(err);
    toast.error(code === "IN_USE" ? "ลบไม่ได้ เพราะเคยถูกใช้แล้ว ปิดใช้งานแทน" : code === "VERSION_CONFLICT" ? "ข้อมูลนี้ถูกแก้โดยผู้ใช้อื่น โหลดข้อมูลล่าสุดแล้ว" : GENERIC_ERROR);
    reload().catch(() => undefined);
  }

  function setActive(t: ContractorTypeAdmin, isActive: boolean) {
    const run = async () => {
      try {
        await updateContractorType(t.id, { isActive, updatedAt: t.updatedAt });
        toast.success(isActive ? `เปิดใช้งาน "${t.name}" แล้ว` : `ปิดใช้งาน "${t.name}" แล้ว`);
        await reload();
      } catch (err) {
        failed(err);
      }
    };
    if (isActive) void run();
    else setConfirm({
      title: `ปิดใช้งาน "${t.name}"?`, body: "ประเภทผู้รับเหมานี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง",
      extra: "ผู้รับเหมาที่มีประเภทนี้อยู่แล้วยังแสดงประเภทนี้ ช่างเลือกประเภทนี้ให้ผู้รับเหมาใหม่ไม่ได้", confirm: "ปิดใช้งาน", destructive: true, run,
    });
  }

  function remove(t: ContractorTypeAdmin) {
    setConfirm({
      title: `ลบ "${t.name}"?`, body: "ลบถาวร กู้คืนไม่ได้", confirm: "ลบ", destructive: true,
      run: async () => {
        try {
          await deleteContractorType(t.id);
          toast.success(`ลบ "${t.name}" แล้ว`);
          await reload();
        } catch (err) {
          failed(err);
        }
      },
    });
  }

  const heading = (
    <SettingsHeading
      title="ประเภทผู้รับเหมา"
      subtitle="ประเภทที่ช่างเลือกตอนประเมินงาน ช่างเพิ่มประเภทใหม่เองได้ด้วย"
      action={types ? <Button className="h-11 px-4" onClick={() => setDialog("new")}><Plus aria-hidden />เพิ่มประเภท</Button> : undefined}
    />
  );

  if (error !== undefined) {
    return (
      <>
        {heading}
        <section className={panelClass}>
          {errorCode(error) === "FORBIDDEN" ? (
            <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason="การจัดการผู้ใช้ Role และสิทธิ์ สำหรับ Superadmin เท่านั้น" />
          ) : (
            <ErrorState hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่" onRetry={() => { setError(undefined); setRevision((r) => r + 1); }} />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      {heading}
      <section className={cn(panelClass, "overflow-hidden")} aria-label="ประเภทผู้รับเหมา">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3.5 lg:px-5">
          <h2 className="font-heading text-base font-semibold">ประเภท ({types ? types.filter((t) => t.isActive).length : "–"})</h2>
          <div className="relative ml-auto min-w-0 basis-full sm:basis-64">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="ค้นหาประเภท" placeholder="ค้นหาประเภท" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-full pl-10" />
          </div>
        </div>

        {!types ? (
          <div className="space-y-4 p-5" aria-busy="true" aria-label="กำลังโหลด">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : types.length === 0 ? (
          <div className="p-4"><EmptyState title="ยังไม่มีประเภทผู้รับเหมา" hint="ช่างจะเพิ่มได้เองตอนประเมินงาน หรือเพิ่มไว้ล่วงหน้าที่นี่" action={<Button onClick={() => setDialog("new")}>เพิ่มประเภท</Button>} /></div>
        ) : visible.length === 0 ? (
          <div className="p-4"><EmptyState title={q.trim() ? `ไม่พบประเภทที่ตรงกับ "${q.trim()}"` : "ไม่มีประเภทที่เปิดใช้งาน"} action={q.trim() ? <Button variant="outline" onClick={() => setQ("")}>ล้างการค้นหา</Button> : undefined} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="hidden sm:table-header-group">
              <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium lg:px-5">ประเภท</th>
                <th scope="col" className="w-36 px-3 py-3 font-medium">ผู้รับเหมา</th>
                <th scope="col" className="px-3 py-3 font-medium">สร้างโดย</th>
                <th scope="col" className="w-14 px-3 py-3"><span className="sr-only">ตัวเลือก</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className={cn("border-t align-top sm:align-middle", !t.isActive && "text-muted-foreground")}>
                  <th scope="row" className="px-4 py-3 text-left font-medium lg:px-5">
                    <span className="flex flex-wrap items-center gap-2">
                      {t.name}
                      {t.createdByTechnician && <span className="rounded-sm bg-muted px-1.5 text-xs font-normal text-muted-foreground">สร้างโดยช่าง</span>}
                      {!t.isActive && <span className="rounded-sm bg-muted px-1.5 text-xs font-normal">ปิดใช้งาน</span>}
                    </span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground sm:hidden">
                      {t.contractorCount > 0 ? `${t.contractorCount} ผู้รับเหมา` : "ยังไม่มีผู้รับเหมา"}
                    </span>
                  </th>
                  <td className="hidden px-3 py-3 sm:table-cell">{t.contractorCount > 0 ? `${t.contractorCount} ผู้รับเหมา` : <span className="text-muted-foreground">ยังไม่มีผู้รับเหมา</span>}</td>
                  <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">{t.createdBy ? `${t.createdBy.name} · ${formatDateTime(t.createdAt).split(" ").slice(0, 3).join(" ")}` : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label={`ตัวเลือกของ ${t.name}`}
                          className="grid size-11 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
                          <MoreHorizontal className="size-5" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem className="min-h-10" onSelect={() => setDialog(t)}><Pencil aria-hidden />แก้ไข</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="min-h-10" onSelect={() => setActive(t, !t.isActive)}><Power aria-hidden />{t.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</DropdownMenuItem>
                        <DropdownMenuItem className="min-h-10" variant="destructive" disabled={t.inUse} onSelect={() => remove(t)}>
                          <Trash2 aria-hidden />
                          <span className="flex flex-col">ลบ{t.inUse && <span className="text-xs text-muted-foreground">เคยถูกใช้แล้ว ปิดใช้งานแทน</span>}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {types && types.length > 0 && (
        <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-primary" />
          แสดงที่ปิดใช้งาน
        </label>
      )}

      <TypeDialog target={dialog} onOpenChange={(o) => !o && setDialog(null)} onSaved={() => { setDialog(null); reload().catch(() => undefined); }}
        fetchFresh={async (id) => (await reload()).find((t) => t.id === id) ?? null} />
      <ConfirmDialog value={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function TypeDialog({ target, onOpenChange, onSaved, fetchFresh }: {
  target: ContractorTypeAdmin | "new" | null; onOpenChange: (open: boolean) => void; onSaved: () => void; fetchFresh: (id: string) => Promise<ContractorTypeAdmin | null>;
}) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<typeof target>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      setName(target === "new" ? "" : target.name);
      setVersion(target === "new" ? "" : target.updatedAt);
      setError(null);
      setConflict(null);
    }
  }
  const editing = target && target !== "new" ? target : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("กรุณากรอกชื่อ");
    if ([...n].length > 50) return setError("ชื่อยาวได้ไม่เกิน 50 ตัวอักษร");
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        if (n !== editing.name) await updateContractorType(editing.id, { name: n, updatedAt: version });
        toast.success("บันทึกแล้ว");
      } else {
        await createContractorType(n);
        toast.success("เพิ่มประเภทแล้ว");
      }
      onSaved();
    } catch (err) {
      const code = errorCode(err);
      if (code === "NAME_TAKEN") setError("ชื่อนี้มีอยู่แล้ว");
      else if (code === "VALIDATION_FAILED") setError(errorFields(err).name === "TOO_LONG" ? "ชื่อยาวได้ไม่เกิน 50 ตัวอักษร" : "กรุณากรอกชื่อ");
      else if (editing && code === "VERSION_CONFLICT") {
        const fresh = await fetchFresh(editing.id).catch(() => null);
        if (fresh) setConflict({ text: conflictText(fresh.updatedBy, fresh.updatedAt), updatedAt: fresh.updatedAt });
        else toast.error(GENERIC_ERROR);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={sheetOnMobile}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{editing ? "แก้ไขประเภท" : "เพิ่มประเภท"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">ประเภทที่ช่างเลือกให้ผู้รับเหมาตอนประเมินงาน</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="ctype-name" required>ชื่อประเภท</FieldLabel>
            <Input id="ctype-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ไฟฟ้า, ประปา, ลิฟต์" className="h-11" autoFocus aria-describedby="ctype-hint" />
            <p id="ctype-hint" className="text-xs text-muted-foreground">ชื่อซ้ำไม่ได้ (ไม่สนตัวพิมพ์เล็ก-ใหญ่)</p>
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "บันทึก" : "เพิ่มประเภท"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
