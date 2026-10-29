"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/states";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createBuildingType, getCategories, updateBuildingType } from "../../api";
import type { BuildingTypeAdmin, CategoryAdmin } from "../../types";
import { errorCode, errorFields, GENERIC_ERROR, panelClass, sheetOnMobile } from "../settings-ui";
import { ConflictAlert, conflictText, FieldLabel, FormError } from "./place-dialogs";

// S20 tab ประเภทอาคาร (CR-005, spec screens/S20-buildings.md CR-005 block): list, add (with the categories it uses),
// rename, (de)activate. A type an active building has cannot be deactivated (#55 IN_USE).

const IN_USE_TEXT = "ยังมีอาคารใช้ประเภทนี้อยู่ เปลี่ยนประเภทของอาคารก่อน";

type PanelProps = {
  types: BuildingTypeAdmin[];
  onAdd: () => void;
  onRename: (t: BuildingTypeAdmin) => void;
  onChanged: () => void;
};

export function BuildingTypesPanel({ types, onAdd, onRename, onChanged }: PanelProps) {
  const [confirm, setConfirm] = useState<BuildingTypeAdmin | null>(null);
  const [blocked, setBlocked] = useState<BuildingTypeAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setActive(t: BuildingTypeAdmin, isActive: boolean) {
    setBusyId(t.id);
    try {
      await updateBuildingType(t.id, { isActive, updatedAt: t.updatedAt });
      toast.success(isActive ? `เปิดใช้งาน "${t.name}" แล้ว` : `ปิดใช้งาน "${t.name}" แล้ว`);
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      if (errorCode(err) === "IN_USE") setBlocked(t);
      else toast.error(GENERIC_ERROR);
    } finally {
      setBusyId(null);
      onChanged();
    }
  }

  function menu(t: BuildingTypeAdmin) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={`ตัวเลือก ${t.name}`} disabled={busyId === t.id}>
            {busyId === t.id ? <Loader2 className="animate-spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(t)}><Pencil aria-hidden />แก้ไขชื่อ</DropdownMenuItem>
          {t.isActive ? (
            <DropdownMenuItem onSelect={() => (t.buildingCount > 0 ? setBlocked(t) : setConfirm(t))}><Power aria-hidden />ปิดใช้งาน</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setActive(t, true)}><Power aria-hidden />เปิดใช้งาน</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <section className={cn(panelClass, "overflow-hidden")} aria-label="ประเภทอาคาร">
      <div className="flex items-start gap-3 border-b px-4 py-4 lg:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">ประเภทอาคาร</h2>
          <p className="text-[13px] text-muted-foreground">ฟอร์มแจ้งซ่อมแสดงเฉพาะหมวดงานที่ใช้กับประเภทของอาคารที่เลือก</p>
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{types.length} ประเภท</span>
      </div>
      {types.length === 0 ? (
        <div className="p-4">
          <EmptyState title="ยังไม่มีประเภทอาคาร" hint="เพิ่มประเภทอาคาร แล้วกำหนดให้อาคารแต่ละหลัง" action={<Button onClick={onAdd}>เพิ่มประเภทอาคาร</Button>} />
        </div>
      ) : (
        <>
          {/* desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium lg:px-5">ชื่อประเภทอาคาร</th>
                <th scope="col" className="w-28 px-3 py-3 font-medium">อาคาร</th>
                <th scope="col" className="w-32 px-3 py-3 font-medium">หมวดงาน</th>
                <th scope="col" className="w-32 px-3 py-3 font-medium">สถานะ</th>
                <th scope="col" className="w-16 px-3 py-3"><span className="sr-only">ตัวเลือก</span></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className={cn("border-t", !t.isActive && "text-muted-foreground")}>
                  <td className="px-4 py-3 font-medium lg:px-5">{t.name}</td>
                  <td className="px-3 py-3 tabular-nums">{t.buildingCount}</td>
                  <td className="px-3 py-3 tabular-nums">{t.categoryIds.length} หมวด</td>
                  <td className="px-3 py-3"><StatusBadge active={t.isActive} /></td>
                  <td className="px-3 py-3 text-right">{menu(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile cards */}
          <ul className="divide-y sm:hidden">
            {types.map((t) => (
              <li key={t.id} className={cn("flex items-center gap-3 px-4 py-3", !t.isActive && "text-muted-foreground")}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.buildingCount} อาคาร · {t.categoryIds.length} หมวด</p>
                </div>
                <StatusBadge active={t.isActive} />
                {menu(t)}
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busyId && setConfirm(null)}>
        <AlertDialogContent className={sheetOnMobile}>
          <AlertDialogHeader>
            <AlertDialogTitle>ปิดใช้งานประเภทอาคารนี้?</AlertDialogTitle>
            <AlertDialogDescription>หมวดงานที่ใช้เฉพาะประเภทนี้จะไม่แสดงในฟอร์มแจ้งซ่อม</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>ยกเลิก</AlertDialogCancel>
            <Button variant="destructive" disabled={!!busyId} onClick={() => confirm && setActive(confirm, false)}>
              {busyId && <Loader2 className="animate-spin" aria-hidden />}ปิดใช้งาน
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <AlertDialogContent className={sheetOnMobile}>
          <AlertDialogHeader>
            <AlertDialogTitle>ปิดใช้งาน &quot;{blocked?.name}&quot; ไม่ได้</AlertDialogTitle>
            <AlertDialogDescription>{IN_USE_TEXT}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ปิด</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? <Badge variant="secondary">ใช้งาน</Badge> : <Badge variant="outline" className="text-muted-foreground">ปิดใช้งาน</Badge>;
}

// ---- add / rename dialog ----

type DialogProps = {
  target: BuildingTypeAdmin | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  fetchFresh: (id: string) => Promise<BuildingTypeAdmin | null>;
};

export function BuildingTypeDialog({ target, onOpenChange, onSaved, fetchFresh }: DialogProps) {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<CategoryAdmin[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<DialogProps["target"]>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      setName(target === "new" ? "" : target.name);
      setVersion(target === "new" ? "" : target.updatedAt);
      setError(null);
      setConflict(null);
      setCategories(undefined);
      setPicked([]);
      if (target === "new") {
        getCategories().then(
          (list) => {
            const usable = list.filter((c) => c.isActive && !c.isOther);
            setCategories(usable);
            setPicked(usable.map((c) => c.id)); // every active category ticked by default
          },
          () => setCategories([]),
        );
      }
    }
  }
  const creating = target === "new";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const n = name.trim();
    if (!n) return setError("กรุณากรอกชื่อประเภทอาคาร");
    if ([...n].length > 100) return setError("ชื่อยาวได้ไม่เกิน 100 ตัวอักษร");
    setBusy(true);
    setError(null);
    try {
      if (target === "new") {
        await createBuildingType({ name: n, categoryIds: picked });
        toast.success(`เพิ่มประเภทอาคาร "${n}" แล้ว`);
      } else {
        await updateBuildingType(target.id, { name: n, updatedAt: version });
        toast.success("บันทึกแล้ว");
      }
      onSaved();
    } catch (err) {
      const code = errorCode(err);
      const f = errorFields(err);
      if (code === "NAME_TAKEN") setError("ชื่อนี้มีอยู่แล้ว");
      else if (code === "VALIDATION_FAILED" && f.name) setError(f.name === "TOO_LONG" ? "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร" : "กรุณากรอกชื่อประเภทอาคาร");
      else if (code === "VERSION_CONFLICT" && target !== "new") {
        const fresh = await fetchFresh(target.id).catch(() => null);
        if (fresh) setConflict({ text: conflictText(fresh.updatedBy, fresh.updatedAt), updatedAt: fresh.updatedAt });
        else toast.error(GENERIC_ERROR);
      } else {
        toast.error(GENERIC_ERROR);
        if (code === "VALIDATION_FAILED") setSeen(null); // a category was just deactivated: reload the check boxes
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={sheetOnMobile}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{creating ? "เพิ่มประเภทอาคาร" : "แก้ไขชื่อประเภทอาคาร"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">{creating ? "เลือกหมวดงานที่แจ้งซ่อมได้ในอาคารประเภทนี้" : "ชื่อที่ใช้แสดงในระบบ"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="bt-name" required>ชื่อประเภทอาคาร</FieldLabel>
            <Input id="bt-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" autoFocus />
          </div>
          {creating && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">หมวดงานที่ใช้ได้</legend>
              {!categories ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />กำลังโหลด</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {categories.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-muted">
                          <Checkbox checked={on} onCheckedChange={(v) => setPicked((x) => (v ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
                          {c.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">หมวด “อื่น ๆ” ใช้ได้กับทุกประเภทอาคาร</p>
            </fieldset>
          )}
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict || (creating && !categories)}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {creating ? "เพิ่มประเภทอาคาร" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
