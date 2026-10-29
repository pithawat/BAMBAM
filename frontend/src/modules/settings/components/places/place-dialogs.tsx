"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ASSET_ICONS } from "@/components/shared/asset-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createAssetType, renameRoom, updateAssetType, updateBuilding } from "../../api";
import type { AssetIconName, AssetMount, AssetTypeAdmin, BuildingTypeAdmin, PersonRef } from "../../types";
import { errorCode, errorFields, GENERIC_ERROR, sheetOnMobile } from "../settings-ui";

// S20 dialogs (CR-001 / CR-002): edit building (name + CR-005 type) / rename room, add / edit asset type. Server and validation errors show
// as one line at the top of the form (settings _common.md §6, CR-001 design).

export const MOUNTS: { value: AssetMount; label: string }[] = [
  { value: "floor", label: "พื้น" },
  { value: "wall", label: "ผนัง" },
  { value: "ceiling", label: "เพดาน" },
];

export const mountLabel = (m: string) => MOUNTS.find((x) => x.value === m)?.label ?? m;

/** "ข้อมูลนี้ถูกแก้โดย {ชื่อ} เมื่อ {เวลา}" (settings _common.md §6). */
export function conflictText(by: PersonRef | null, at: string) {
  return `ข้อมูลนี้ถูกแก้โดย ${by?.name ?? "ผู้ใช้อื่น"} เมื่อ ${formatDateTime(at)}`;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-1.5 text-[13px] text-destructive">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function FieldLabel({ htmlFor, id, children, required }: { htmlFor?: string; id?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} id={id} className="block text-sm font-semibold">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </label>
  );
}

/** A conflict inside a dialog: the warning line + "โหลดข้อมูลล่าสุด" (takes the fresh version, keeps the input). */
export function ConflictAlert({ text, onReload }: { text: string; onReload: () => void }) {
  return (
    <Alert className="border-warning/30 bg-warning/5">
      <AlertTriangle className="text-warning" aria-hidden />
      <AlertDescription className="text-foreground">
        <p>{text}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onReload}>
          โหลดข้อมูลล่าสุด
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ---- rename ----

export type RenameTarget =
  | { kind: "building"; id: string; name: string; updatedAt: string; buildingTypeId: string }
  | { kind: "room"; id: string; name: string; updatedAt: string; context: string };

type RenameProps = {
  target: RenameTarget | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Fresh name / version after a conflict (the caller refetched the tree). */
  fetchFresh: (target: RenameTarget) => Promise<{ updatedAt: string; updatedBy: PersonRef | null } | null>;
  /** CR-005: the `ประเภทอาคาร *` select of the building dialog (active types are offered). */
  buildingTypes?: BuildingTypeAdmin[];
};

export function RenameDialog({ target, onOpenChange, onSaved, fetchFresh, buildingTypes = [] }: RenameProps) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<RenameTarget | null>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      setName(target.name);
      setTypeId(target.kind === "building" ? target.buildingTypeId : "");
      setVersion(target.updatedAt);
      setError(null);
      setConflict(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    const n = name.trim();
    if (!n) return setError("กรุณากรอกชื่อ");
    if ([...n].length > 100) return setError("ชื่อยาวได้ไม่เกิน 100 ตัวอักษร");
    if (target.kind === "building" && !typeId) return setError("กรุณาเลือกประเภทอาคาร");
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "building") await updateBuilding(target.id, { name: n, buildingTypeId: typeId, updatedAt: version });
      else await renameRoom(target.id, { name: n, updatedAt: version });
      toast.success(target.kind === "building" ? "บันทึกแล้ว" : "บันทึกชื่อแล้ว");
      onSaved();
    } catch (err) {
      const code = errorCode(err);
      if (code === "NAME_TAKEN") setError("ชื่อนี้มีอยู่แล้ว");
      else if (code === "VALIDATION_FAILED") {
        const f = errorFields(err);
        if (f.buildingTypeId) {
          // the type was just deactivated: the caller refetches, the select shows active ones
          toast.error(GENERIC_ERROR);
          onSaved();
        } else setError(f.name === "TOO_LONG" ? "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร" : "กรุณากรอกชื่อ");
      }
      else if (code === "VERSION_CONFLICT") {
        const fresh = await fetchFresh(target).catch(() => null);
        if (fresh) setConflict({ text: conflictText(fresh.updatedBy, fresh.updatedAt), updatedAt: fresh.updatedAt });
        else toast.error(GENERIC_ERROR);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const building = target?.kind === "building";
  return (
    <Dialog open={!!target} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={sheetOnMobile}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{building ? "แก้ไขอาคาร" : "แก้ไขชื่อห้อง / พื้นที่"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">{target?.kind === "room" ? target.context : "ชื่อที่ใช้แสดงในระบบ"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="rename-name" required>{building ? "ชื่ออาคาร" : "ชื่อห้อง / พื้นที่"}</FieldLabel>
            <Input id="rename-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" aria-describedby="rename-hint" autoFocus />
            <p id="rename-hint" className="text-xs text-muted-foreground">เปลี่ยนชื่อที่แสดง โดยตำแหน่งในผังและอุปกรณ์ยังอยู่ที่เดิม</p>
          </div>
          {building && (
            <div className="space-y-1.5">
              <FieldLabel id="building-type-label" required>ประเภทอาคาร</FieldLabel>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger aria-labelledby="building-type-label" aria-describedby="building-type-hint" className="h-11 w-full data-[size=default]:h-11">
                  <SelectValue placeholder="เลือกประเภทอาคาร" />
                </SelectTrigger>
                <SelectContent>
                  {buildingTypes.filter((t) => t.isActive || t.id === typeId).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p id="building-type-hint" className="text-xs text-muted-foreground">เปลี่ยนประเภทแล้วมีผลกับงานแจ้งใหม่เท่านั้น</p>
            </div>
          )}
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {building ? "บันทึก" : "บันทึกชื่อ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- asset type ----

/** Thai copy for #51 / #52 errors; null = not a form error (the caller toasts). */
export function typeErrorText(err: unknown): string | null {
  const code = errorCode(err);
  if (code === "NAME_TAKEN") return "ประเภทอุปกรณ์นี้มีอยู่แล้ว";
  if (code === "CODE_PREFIX_TAKEN") return "รหัสนำหน้านี้มีประเภทอื่นใช้แล้ว";
  if (code === "VALIDATION_FAILED") {
    const f = errorFields(err);
    if (f.name === "REQUIRED") return "กรุณากรอกชื่อประเภทอุปกรณ์";
    if (f.name === "TOO_LONG") return "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร";
    if (f.codePrefix === "REQUIRED") return "กรุณากรอกรหัสนำหน้า";
    if (f.codePrefix) return "รหัสนำหน้าใช้ตัวอักษรอังกฤษหรือตัวเลข 2–5 ตัว";
  }
  return null;
}

/** Client checks before #51 / #52 (same rules as the API). */
export function checkTypeForm(name: string, prefix: string): string | null {
  if (!name.trim()) return "กรุณากรอกชื่อประเภทอุปกรณ์";
  if (!prefix.trim()) return "กรุณากรอกรหัสนำหน้า";
  if (!/^[A-Z0-9]{2,5}$/.test(prefix.trim().toUpperCase())) return "รหัสนำหน้าใช้ตัวอักษรอังกฤษหรือตัวเลข 2–5 ตัว";
  return null;
}

export function MountChoice({ value, onChange, name }: { value: AssetMount; onChange: (m: AssetMount) => void; name: string }) {
  return (
    <div role="radiogroup" aria-labelledby={`${name}-label`} className="flex gap-2">
      {MOUNTS.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "min-h-11 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            value === m.value ? "border-primary bg-secondary font-semibold text-primary" : "bg-card hover:bg-muted",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

type TypeProps = {
  /** null = closed; "new" = add. */
  target: AssetTypeAdmin | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (t: AssetTypeAdmin, added: boolean) => void;
  fetchFresh: (id: string) => Promise<AssetTypeAdmin | null>;
};

export function AssetTypeDialog({ target, onOpenChange, onSaved, fetchFresh }: TypeProps) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [mount, setMount] = useState<AssetMount>("floor");
  const [icon, setIcon] = useState<AssetIconName>("box");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<TypeProps["target"]>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      const t = target === "new" ? null : target;
      setName(t?.name ?? "");
      setPrefix(t?.codePrefix ?? "");
      setMount(t?.mount ?? "floor");
      setIcon((t?.icon as AssetIconName) ?? "box");
      setVersion(t?.updatedAt ?? "");
      setError(null);
      setConflict(null);
    }
  }
  const editing = target && target !== "new" ? target : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = checkTypeForm(name, prefix);
    if (local) return setError(local);
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const input = {
          updatedAt: version,
          ...(name.trim() !== editing.name ? { name: name.trim() } : {}),
          ...(prefix.trim().toUpperCase() !== editing.codePrefix ? { codePrefix: prefix.trim().toUpperCase() } : {}),
          ...(mount !== editing.mount ? { mount } : {}),
          ...(icon !== editing.icon ? { icon } : {}),
        };
        const t = await updateAssetType(editing.id, input);
        toast.success("บันทึกประเภทอุปกรณ์แล้ว");
        onSaved(t, false);
      } else {
        const t = await createAssetType({ name: name.trim(), codePrefix: prefix.trim().toUpperCase(), mount, icon });
        toast.success("เพิ่มประเภทอุปกรณ์แล้ว");
        onSaved(t, true);
      }
    } catch (err) {
      const text = typeErrorText(err);
      if (text) setError(text);
      else if (editing && errorCode(err) === "VERSION_CONFLICT") {
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
          <DialogTitle className="font-heading text-lg font-semibold">{editing ? "แก้ไขประเภทอุปกรณ์" : "เพิ่มประเภทอุปกรณ์"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">ประเภทนี้เลือกใช้ได้กับอุปกรณ์ในทุกอาคาร</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="type-name" required>ชื่อประเภทอุปกรณ์</FieldLabel>
            <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เครื่องพิมพ์" className="h-11" autoFocus />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="type-prefix" required>รหัสนำหน้า</FieldLabel>
            <Input id="type-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="เช่น PRN" maxLength={5} className="h-11 font-mono uppercase" aria-describedby="type-prefix-hint" />
            <p id="type-prefix-hint" className="text-xs text-muted-foreground">ใช้ตั้งรหัสอุปกรณ์อัตโนมัติ เช่น PRN-1-001 · ตัวอักษรอังกฤษหรือตัวเลข 2–5 ตัว</p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="type-mount-label" required>ตำแหน่งติดตั้ง</FieldLabel>
            <MountChoice value={mount} onChange={setMount} name="type-mount" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="type-icon-label">ไอคอน</FieldLabel>
            <div role="radiogroup" aria-labelledby="type-icon-label" className="flex flex-wrap gap-2">
              {ASSET_ICONS.map(({ name: n, label, icon: Icon }) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={icon === n}
                  aria-label={label}
                  title={label}
                  onClick={() => setIcon(n)}
                  className={cn(
                    "grid size-11 place-items-center rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    icon === n ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "บันทึก" : "เพิ่มประเภทอุปกรณ์"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
