"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/shared/asset-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createAsset, createAssetType, suggestAssetCode, updateAsset } from "../../api";
import type { AssetAdmin, AssetMount, AssetTypeAdmin, PlanBuilding } from "../../types";
import { errorCode, errorFields, GENERIC_ERROR, sheetOnMobile } from "../settings-ui";
import { checkTypeForm, ConflictAlert, conflictText, FieldLabel, FormError, MountChoice, typeErrorText } from "./place-dialogs";

// S20 asset dialog (CR-001 design asset-form-desktop.png): building · floor · room, type (+ inline "เพิ่มประเภทใหม่"),
// code (suggested by #49 on add until typed), name. Edit = แก้ไข / ย้ายห้อง: the type is read-only, and so is the code once
// its QR label was printed (CR-007).

export type AssetDialogTarget = { mode: "add"; roomId: string } | { mode: "edit"; asset: AssetAdmin };

type Props = {
  target: AssetDialogTarget | null;
  tree: PlanBuilding[];
  types: AssetTypeAdmin[];
  onOpenChange: (open: boolean) => void;
  onSaved: (asset: AssetAdmin) => void;
  onTypeAdded: (t: AssetTypeAdmin) => void;
  /** VERSION_CONFLICT: the fresh asset (or null when it is gone). */
  fetchFresh: (asset: AssetAdmin) => Promise<AssetAdmin | null>;
};

const CODE_RE = /^[A-Za-z0-9_-]{1,50}$/;

function placeOfRoom(tree: PlanBuilding[], roomId: string) {
  for (const b of tree) for (const f of b.floors) if (f.rooms.some((r) => r.id === roomId)) return { buildingId: b.id, floorId: f.id };
  return null;
}

export function AssetDialog({ target, tree, types, onOpenChange, onSaved, onTypeAdded, fetchFresh }: Props) {
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeLockedError, setCodeLockedError] = useState(false);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // inline type editor
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typePrefix, setTypePrefix] = useState("");
  const [typeMount, setTypeMount] = useState<AssetMount>("floor");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);
  const addTypeButton = useRef<HTMLButtonElement>(null);

  const [seen, setSeen] = useState<AssetDialogTarget | null>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      const rid = target.mode === "add" ? target.roomId : target.asset.roomId;
      const p = placeOfRoom(tree, rid);
      setBuildingId(p?.buildingId ?? "");
      setFloorId(p?.floorId ?? "");
      setRoomId(rid);
      setTypeId(target.mode === "edit" ? target.asset.type.id : (types[0]?.id ?? ""));
      setCode(target.mode === "edit" ? target.asset.code : "");
      setName(target.mode === "edit" ? target.asset.name : "");
      setCodeTouched(target.mode === "edit");
      setVersion(target.mode === "edit" ? target.asset.updatedAt : "");
      setError(null);
      setCodeLockedError(false);
      setConflict(null);
      setTypeOpen(false);
    }
  }

  const editing = target?.mode === "edit" ? target.asset : null;
  const building = tree.find((b) => b.id === buildingId);
  const floor = building?.floors.find((f) => f.id === floorId);

  // Suggest a code on add whenever the type or room changes and the user has not typed one (#49).
  useEffect(() => {
    if (!target || target.mode !== "add" || codeTouched || !typeId || !roomId) return;
    let active = true;
    suggestAssetCode(typeId, roomId).then((c) => { if (active) setCode(c); }, () => undefined);
    return () => { active = false; };
  }, [target, typeId, roomId, codeTouched]);

  function pickBuilding(id: string) {
    setBuildingId(id);
    const f = tree.find((b) => b.id === id)?.floors[0];
    setFloorId(f?.id ?? "");
    setRoomId(f?.rooms[0]?.id ?? "");
  }
  function pickFloor(id: string) {
    setFloorId(id);
    setRoomId(building?.floors.find((f) => f.id === id)?.rooms[0]?.id ?? "");
  }

  async function addType() {
    const local = checkTypeForm(typeName, typePrefix);
    if (local) return setTypeError(local);
    setTypeBusy(true);
    setTypeError(null);
    try {
      const t = await createAssetType({ name: typeName.trim(), codePrefix: typePrefix.trim().toUpperCase(), mount: typeMount });
      onTypeAdded(t);
      setTypeId(t.id);
      setTypeOpen(false);
      setTypeName("");
      setTypePrefix("");
      setTypeMount("floor");
      toast.success("เพิ่มประเภทอุปกรณ์แล้ว");
    } catch (err) {
      const text = typeErrorText(err);
      if (text) setTypeError(text);
      else toast.error(GENERIC_ERROR);
    } finally {
      setTypeBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!code.trim() || !name.trim()) return setError("กรุณากรอกรหัสและชื่ออุปกรณ์");
    if (!CODE_RE.test(code.trim())) return setError("รหัสอุปกรณ์ใช้ได้เฉพาะ A–Z 0–9 - _ ไม่เกิน 50 ตัว");
    if (!roomId || !typeId) return setError(GENERIC_ERROR);
    setBusy(true);
    setError(null);
    setCodeLockedError(false);
    try {
      let saved: AssetAdmin;
      if (editing) {
        saved = await updateAsset(editing.id, {
          updatedAt: version,
          ...(code.trim() !== editing.code ? { code: code.trim() } : {}),
          ...(name.trim() !== editing.name ? { name: name.trim() } : {}),
          ...(roomId !== editing.roomId ? { roomId } : {}),
        });
        toast.success("บันทึกอุปกรณ์แล้ว");
      } else {
        saved = await createAsset({ roomId, assetTypeId: typeId, code: code.trim(), name: name.trim() });
        toast.success("เพิ่มอุปกรณ์แล้ว");
      }
      onSaved(saved);
    } catch (err) {
      const c = errorCode(err);
      const f = errorFields(err);
      if (c === "ASSET_CODE_TAKEN") setError("รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น");
      else if (c === "ASSET_CODE_LOCKED") setCodeLockedError(true);
      else if (c === "VALIDATION_FAILED" && (f.code || f.name)) setError(f.code === "INVALID" ? "รหัสอุปกรณ์ใช้ได้เฉพาะ A–Z 0–9 - _ ไม่เกิน 50 ตัว" : "กรุณากรอกรหัสและชื่ออุปกรณ์");
      else if (editing && c === "VERSION_CONFLICT") {
        const fresh = await fetchFresh(editing).catch(() => null);
        if (fresh) setConflict({ text: conflictText(fresh.updatedBy, fresh.updatedAt), updatedAt: fresh.updatedAt });
        else toast.error(GENERIC_ERROR);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const moved = !!editing && roomId !== editing.roomId;
  // CR-007 (repair BR-F13A-5): the printed QR carries the code, so it is read-only after any print.
  const codeLocked = !!editing && editing.labelStatus !== "never";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !busy && !typeBusy && onOpenChange(o)}>
      <DialogContent className={cn(sheetOnMobile, "lg:max-w-xl data-[size=default]:lg:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">ข้อมูลอุปกรณ์และตำแหน่งที่ติดตั้ง</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel id="asset-building-label" required>อาคาร</FieldLabel>
              <Select value={buildingId} onValueChange={pickBuilding}>
                <SelectTrigger aria-labelledby="asset-building-label" className="h-11 w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{tree.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel id="asset-floor-label" required>ชั้น</FieldLabel>
              <Select value={floorId} onValueChange={pickFloor}>
                <SelectTrigger aria-labelledby="asset-floor-label" className="h-11 w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{building?.floors.map((f) => <SelectItem key={f.id} value={f.id}>ชั้น {f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="asset-room-label" required>ห้อง / พื้นที่</FieldLabel>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger aria-labelledby="asset-room-label" className="h-11 w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{floor?.rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            {moved && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <Info className="size-3.5" aria-hidden />
                ย้ายห้องแล้วต้องจัดวางตำแหน่งบนผัง 3D ใหม่
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel id="asset-type-label" required>ประเภทอุปกรณ์</FieldLabel>
              {!editing && (
                <button
                  ref={addTypeButton}
                  type="button"
                  aria-expanded={typeOpen}
                  aria-controls="inline-type"
                  onClick={() => setTypeOpen((o) => !o)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-[13px] font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <Plus className="size-3.5" aria-hidden />
                  เพิ่มประเภทใหม่
                </button>
              )}
            </div>
            {editing ? (
              <>
                <p className="flex h-11 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm" aria-labelledby="asset-type-label">
                  <AssetIcon icon={editing.type.icon} className="size-4 text-muted-foreground" />
                  {editing.type.name}
                </p>
                <p className="text-xs text-muted-foreground">เปลี่ยนประเภทไม่ได้</p>
              </>
            ) : (
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger aria-labelledby="asset-type-label" className="h-11 w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {typeOpen && !editing && (
              <div id="inline-type" className="mt-2 space-y-3 rounded-lg border bg-muted/40 p-3.5">
                <FormError message={typeError} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="inline-type-name" required>ชื่อประเภทใหม่</FieldLabel>
                    <Input
                      id="inline-type-name"
                      value={typeName}
                      onChange={(e) => setTypeName(e.target.value)}
                      placeholder="เช่น เครื่องพิมพ์"
                      className="h-11 bg-card"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addType(); } }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="inline-type-prefix" required>รหัสนำหน้า</FieldLabel>
                    <Input
                      id="inline-type-prefix"
                      value={typePrefix}
                      onChange={(e) => setTypePrefix(e.target.value.toUpperCase())}
                      placeholder="เช่น PRN"
                      maxLength={5}
                      className="h-11 bg-card font-mono uppercase"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addType(); } }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel id="inline-type-mount-label">ตำแหน่งติดตั้ง</FieldLabel>
                  <MountChoice value={typeMount} onChange={setTypeMount} name="inline-type-mount" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={typeBusy} onClick={() => { setTypeOpen(false); setTypeError(null); addTypeButton.current?.focus(); }}>ยกเลิก</Button>
                  <Button type="button" disabled={typeBusy} onClick={addType}>
                    {typeBusy && <Loader2 className="animate-spin" aria-hidden />}
                    เพิ่มประเภท
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="asset-code" required>รหัสอุปกรณ์</FieldLabel>
            <Input
              id="asset-code"
              value={code}
              onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }}
              placeholder="เช่น AC-1-003"
              className="h-11 font-mono read-only:bg-muted/50"
              readOnly={codeLocked}
              aria-invalid={codeLockedError || undefined}
              aria-describedby="asset-code-hint"
            />
            {codeLocked || codeLockedError ? (
              <p id="asset-code-hint" className={cn("flex items-center gap-1.5 text-xs", codeLockedError ? "text-destructive" : "text-muted-foreground")}>
                <QrCode className="size-3.5" aria-hidden />พิมพ์ป้าย QR แล้ว จึงเปลี่ยนรหัสไม่ได้
              </p>
            ) : (
              <p id="asset-code-hint" className="text-xs text-muted-foreground">รหัสต้องไม่ซ้ำกับอุปกรณ์อื่นในระบบ</p>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="asset-name" required>ชื่ออุปกรณ์</FieldLabel>
            <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น แอร์ห้องประชุม 1A ตัวซ้าย" className="h-11" />
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || typeBusy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "บันทึก" : "เพิ่มอุปกรณ์"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
