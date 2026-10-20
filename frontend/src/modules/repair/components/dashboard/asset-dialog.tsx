"use client";

import { useEffect, useId, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Picker } from "@/components/shared/picker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createAsset, deactivateAsset, suggestAssetCode, updateAsset } from "../../api";
import { assetFieldMessages, errorCode, errorMessage, fieldErrors } from "../../errors";
import { roomCenter } from "../../plan-geometry";
import type { Asset, AssetType, FloorPlan } from "../../types";
import { floorLabel } from "../ticket-presentation";
import { AssetIcon } from "./dashboard-ui";

// S29 asset dialog (F31 steps 2, 4, 5): add (from a drop or the เพิ่มอุปกรณ์ button) or edit code / name /
// room. Copy: S29 spec "Asset dialog" + "Content". The point stays where it was dropped; changing the
// room puts it at the room centre.

export type AssetDraft =
  | { mode: "add"; typeId: string | null; roomId: string; x: number | null; z: number | null; fromDrop: boolean }
  | { mode: "edit"; asset: Asset };

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const round = (v: number) => Math.round(v * 100) / 100;

export function AssetDialog({ draft, plan, types, onClose, onSaved }: {
  draft: AssetDraft | null;
  plan: FloorPlan;
  types: AssetType[];
  onClose: () => void;
  onSaved: (asset: Asset, mode: "add" | "edit") => void;
}) {
  const id = useId();
  const editing = draft?.mode === "edit" ? draft.asset : null;
  const [typeId, setTypeId] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reset the form whenever a new draft opens.
  const [opened, setOpened] = useState<AssetDraft | null>(null);
  if (draft !== opened) {
    setOpened(draft);
    if (draft) {
      setErrors({});
      setCodeTouched(draft.mode === "edit");
      if (draft.mode === "edit") {
        const a = draft.asset;
        setTypeId(a.type.id); setCode(a.code); setName(a.name); setRoomId(a.room.id);
        setPoint(a.x !== null && a.z !== null ? [a.x, a.z] : null);
      } else {
        setTypeId(draft.typeId ?? ""); setCode(""); setName(""); setRoomId(draft.roomId);
        setPoint(draft.x !== null && draft.z !== null ? [round(draft.x), round(draft.z)] : null);
      }
    }
  }

  // Suggested code (#34) for a new asset until the user types their own.
  useEffect(() => {
    if (!draft || draft.mode !== "add" || codeTouched || !typeId) return;
    let alive = true;
    suggestAssetCode(typeId, plan.floor.id).then((c) => { if (alive) setCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [draft, typeId, codeTouched, plan.floor.id]);

  const type = types.find((t) => t.id === typeId);
  const roomOptions = plan.rooms.map((r) => ({ value: r.id, label: r.name }));

  function pickRoom(next: string) {
    setRoomId(next);
    const room = plan.rooms.find((r) => r.id === next);
    const c = room ? roomCenter(room, plan.rooms) : null;
    setPoint(c ? [round(c[0]), round(c[1])] : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const local: Record<string, string> = {};
    const c = code.trim();
    if (!typeId) local.assetTypeId = "เลือกประเภท";
    if (!c) local.code = "กรุณาใส่รหัสอุปกรณ์";
    else if (!CODE_PATTERN.test(c)) local.code = "ใช้ได้เฉพาะตัวอักษร ตัวเลข - และ _";
    if (!name.trim()) local.name = "กรุณาใส่ชื่ออุปกรณ์";
    if (!roomId) local.roomId = "เลือกห้อง";
    if (Object.keys(local).length) { setErrors(local); return; }
    setBusy(true); setErrors({});
    const body = { code: c, name: name.trim(), roomId, x: point?.[0] ?? null, z: point?.[1] ?? null };
    try {
      const saved = editing
        ? await updateAsset(editing.id, { ...body, rotationDeg: editing.rotationDeg })
        : await createAsset({ ...body, assetTypeId: typeId });
      onSaved(saved, editing ? "edit" : "add");
    } catch (err) {
      const fields = fieldErrors(err, assetFieldMessages);
      if (errorCode(err) === "ASSET_CODE_TAKEN") setErrors({ code: "รหัสนี้มีอุปกรณ์อื่นใช้แล้ว" });
      else if (Object.keys(fields).length) setErrors(fields);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const error = (field: string) => errors[field] &&
    <p id={`${id}-${field}-error`} role="alert" className="flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{errors[field]}</p>;
  const typeLocked = draft?.mode === "edit" || (draft?.mode === "add" && draft.fromDrop);

  return <Dialog open={!!draft} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}</DialogTitle>
          <DialogDescription>{plan.building.name} {floorLabel(plan.floor.name)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <span id={`${id}-type`} className="text-sm font-medium">ประเภท</span>
          {typeLocked
            ? <p aria-labelledby={`${id}-type`} className="flex w-max items-center gap-2 rounded-sm bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                <AssetIcon typeKey={type?.key ?? editing?.type.key ?? ""} className="size-4" />{type?.name ?? editing?.type.name}
              </p>
            : <Picker aria-labelledby={`${id}-type`} title="ประเภท" placeholder="เลือกประเภท" value={typeId} invalid={!!errors.assetTypeId}
                options={types.map((t) => ({ value: t.id, label: t.name }))} onValueChange={(v) => { setTypeId(v); setErrors((e) => ({ ...e, assetTypeId: "" })); }} />}
          {error("assetTypeId")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-code`} className="text-sm font-medium">รหัสอุปกรณ์<span className="text-destructive">*</span></label>
          <Input id={`${id}-code`} value={code} maxLength={50} autoComplete="off" className="h-11" aria-invalid={!!errors.code} aria-describedby={errors.code ? `${id}-code-error` : undefined}
            onChange={(e) => { setCode(e.target.value); setCodeTouched(true); }} />
          {error("code")}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">ชื่ออุปกรณ์<span className="text-destructive">*</span></label>
          <Input id={`${id}-name`} value={name} maxLength={100} placeholder="เช่น แอร์ห้อง HR ตัวซ้าย" className="h-11" aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined} onChange={(e) => setName(e.target.value)} />
          {error("name")}
        </div>
        <div className="space-y-1.5">
          <span id={`${id}-room`} className="text-sm font-medium">ห้อง</span>
          <Picker aria-labelledby={`${id}-room`} title="ห้อง" context={`${plan.building.name} ${floorLabel(plan.floor.name)}`} placeholder="เลือกห้อง"
            value={roomId} options={roomOptions} invalid={!!errors.roomId || !!errors.x} onValueChange={pickRoom} />
          {error("roomId") || error("x")}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}บันทึก</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** `ปิดใช้งาน {code}?` (BR-F31-4: deactivate only, the code stays taken). */
export function DeactivateAssetDialog({ asset, onClose, onDone }: { asset: Asset | null; onClose: () => void; onDone: (asset: Asset) => void }) {
  const [busy, setBusy] = useState(false);
  async function confirm(e: React.MouseEvent) {
    e.preventDefault();
    if (!asset) return;
    setBusy(true);
    try {
      await deactivateAsset(asset.id);
      onDone(asset);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return <AlertDialog open={!!asset} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>ปิดใช้งาน {asset?.code}?</AlertDialogTitle>
        <AlertDialogDescription>อุปกรณ์จะหายจากผัง งานซ่อมเดิมยังอ้างถึงได้ และรหัสนี้จะใช้กับอุปกรณ์ใหม่ไม่ได้</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={confirm} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}ปิดใช้งาน
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
