"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_ICONS } from "@/components/shared/category-icon";
import { PRIORITY_LABEL } from "@/components/shared/priority-indicator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createCategory, createSymptom, updateCategory, updateSymptom } from "../../api";
import type { CategoryAdmin, PlanRoom, Priority, SymptomAdmin } from "../../types";
import { ConflictAlert, conflictText, FieldLabel, FormError } from "../places/place-dialogs";
import { errorCode, errorFields, GENERIC_ERROR, sheetOnMobile } from "../settings-ui";

// S22 dialogs (CR-001 block, CR-008 / CR-014): category (name, icon, default priority, area types) and symptom
// (name, priority). Errors as one line at the top of the form.

export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

type AreaType = PlanRoom["areaType"];
export const AREA_LABELS: Record<AreaType, string> = {
  meeting_room: "ห้องประชุม", restroom: "ห้องน้ำ", office: "สำนักงาน", pantry: "Pantry", common_area: "พื้นที่ส่วนกลาง", parking: "ลานจอด", other: "อื่นๆ",
};

function PriorityChoice({ value, onChange, labelledBy }: { value: Priority; onChange: (p: Priority) => void; labelledBy: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-4 gap-2">
      {PRIORITIES.map((p) => (
        <button key={p} type="button" role="radio" aria-checked={value === p} onClick={() => onChange(p)}
          className={cn("min-h-11 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            value === p ? "border-primary bg-secondary font-semibold text-primary" : "bg-card hover:bg-muted")}>
          {PRIORITY_LABEL(p)}
        </button>
      ))}
    </div>
  );
}

function nameError(err: unknown, taken: string): string | null {
  const code = errorCode(err);
  if (code === "NAME_TAKEN") return taken;
  if (code === "VALIDATION_FAILED") return errorFields(err).name === "TOO_LONG" ? "ชื่อยาวได้ไม่เกิน 100 ตัวอักษร" : "กรุณากรอกชื่อ";
  return null;
}

type CategoryProps = {
  target: CategoryAdmin | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (c: CategoryAdmin, added: boolean) => void;
  fetchFresh: (id: string) => Promise<CategoryAdmin | null>;
};

export function CategoryDialog({ target, onOpenChange, onSaved, fetchFresh }: CategoryProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("wrench");
  const [priority, setPriority] = useState<Priority>("medium");
  const [areas, setAreas] = useState<AreaType[]>([]);
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<CategoryProps["target"]>(null);
  if (target !== seen) {
    setSeen(target);
    if (target) {
      const c = target === "new" ? null : target;
      setName(c?.name ?? "");
      setIcon(c?.icon ?? "wrench");
      setPriority(c?.defaultPriority ?? "medium");
      setAreas(c?.areaTypes ?? []);
      setVersion(c?.updatedAt ?? "");
      setError(null);
      setConflict(null);
    }
  }
  const editing = target && target !== "new" ? target : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("กรุณากรอกชื่อ");
    if ([...n].length > 100) return setError("ชื่อยาวได้ไม่เกิน 100 ตัวอักษร");
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const sameAreas = [...areas].sort().join() === [...editing.areaTypes].sort().join();
        const c = await updateCategory(editing.id, {
          updatedAt: version,
          ...(n !== editing.name ? { name: n } : {}),
          ...(icon !== editing.icon ? { icon } : {}),
          ...(priority !== editing.defaultPriority ? { defaultPriority: priority } : {}),
          ...(!sameAreas ? { areaTypes: areas } : {}),
        });
        toast.success("บันทึกแล้ว");
        onSaved(c, false);
      } else {
        const c = await createCategory({ name: n, icon, defaultPriority: priority, areaTypes: areas });
        toast.success("เพิ่มหมวดงานแล้ว");
        onSaved(c, true);
      }
    } catch (err) {
      const text = nameError(err, "ชื่อนี้มีอยู่แล้ว");
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
      <DialogContent className={cn(sheetOnMobile, "lg:max-w-xl data-[size=default]:lg:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{editing ? "แก้ไขหมวดงาน" : "เพิ่มหมวดงาน"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">หมวดงานแสดงในแบบฟอร์มแจ้งซ่อมตามลำดับที่ตั้งไว้</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="cat-name" required>ชื่อหมวดงาน</FieldLabel>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ระบบปรับอากาศ" className="h-11" autoFocus />
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="cat-icon-label" required>ไอคอน</FieldLabel>
            <div role="radiogroup" aria-labelledby="cat-icon-label" className="flex flex-wrap gap-2">
              {CATEGORY_ICONS.map(({ name: n, label, icon: Icon }) => (
                <button key={n} type="button" role="radio" aria-checked={icon === n} aria-label={label} title={label} onClick={() => setIcon(n)}
                  className={cn("grid size-11 place-items-center rounded-lg border outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    icon === n ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted")}>
                  <Icon className="size-5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="cat-priority-label" required>ความเร่งด่วนตั้งต้น</FieldLabel>
            <PriorityChoice value={priority} onChange={setPriority} labelledBy="cat-priority-label" />
            <p className="text-xs text-muted-foreground">ใช้เมื่อผู้แจ้งเลือกแค่ “อาการอื่น ๆ”</p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="cat-area-label">ประเภทพื้นที่ที่มักเกิด</FieldLabel>
            <div role="group" aria-labelledby="cat-area-label" className="flex flex-wrap gap-2">
              {(Object.keys(AREA_LABELS) as AreaType[]).map((a) => {
                const on = areas.includes(a);
                return (
                  <button key={a} type="button" aria-pressed={on} onClick={() => setAreas((x) => (on ? x.filter((y) => y !== a) : [...x, a]))}
                    className={cn("min-h-10 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                      on ? "border-primary bg-secondary font-semibold text-primary" : "bg-card text-muted-foreground hover:bg-muted")}>
                    {AREA_LABELS[a]}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {editing ? "บันทึก" : "เพิ่มหมวดงาน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SymptomProps = {
  category: CategoryAdmin | null;
  /** undefined = add */
  symptom?: SymptomAdmin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (s: SymptomAdmin, added: boolean) => void;
  fetchFresh: (id: string) => Promise<SymptomAdmin | null>;
};

export function SymptomDialog({ category, symptom, open, onOpenChange, onSaved, fetchFresh }: SymptomProps) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; updatedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(false);
  if (open !== seen) {
    setSeen(open);
    if (open) {
      setName(symptom?.name ?? "");
      setPriority(symptom?.priority ?? category?.defaultPriority ?? "medium");
      setVersion(symptom?.updatedAt ?? "");
      setError(null);
      setConflict(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    const n = name.trim();
    if (!n) return setError("กรุณากรอกชื่อ");
    if ([...n].length > 100) return setError("ชื่อยาวได้ไม่เกิน 100 ตัวอักษร");
    setBusy(true);
    setError(null);
    try {
      if (symptom) {
        const s = await updateSymptom(symptom.id, { updatedAt: version, ...(n !== symptom.name ? { name: n } : {}), ...(priority !== symptom.priority ? { priority } : {}) });
        toast.success("บันทึกแล้ว");
        onSaved(s, false);
      } else {
        const s = await createSymptom(category.id, { name: n, priority });
        toast.success("เพิ่มอาการแล้ว");
        onSaved(s, true);
      }
    } catch (err) {
      const text = nameError(err, "ชื่อนี้มีอยู่แล้วในหมวดนี้");
      if (text) setError(text);
      else if (symptom && errorCode(err) === "VERSION_CONFLICT") {
        const fresh = await fetchFresh(symptom.id).catch(() => null);
        if (fresh) setConflict({ text: conflictText(fresh.updatedBy, fresh.updatedAt), updatedAt: fresh.updatedAt });
        else toast.error(GENERIC_ERROR);
      } else toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={sheetOnMobile}>
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{symptom ? "แก้ไขอาการ" : "เพิ่มอาการ"}</DialogTitle>
          <DialogDescription className="text-[13.5px]">{category?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {conflict && <ConflictAlert text={conflict.text} onReload={() => { setVersion(conflict.updatedAt); setConflict(null); }} />}
          <FormError message={error} />
          <div className="space-y-1.5">
            <FieldLabel htmlFor="sym-name" required>ชื่ออาการ</FieldLabel>
            <Input id="sym-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น แอร์ไม่เย็น" className="h-11" autoFocus aria-describedby="sym-name-hint" />
            <p id="sym-name-hint" className="text-xs text-muted-foreground">อาการแสดงเป็นชื่องานซ่อม เช่น “แอร์ไม่เย็น · มีน้ำหยด”</p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel id="sym-priority-label" required>ความเร่งด่วน</FieldLabel>
            <PriorityChoice value={priority} onChange={setPriority} labelledBy="sym-priority-label" />
            <p className="text-xs text-muted-foreground">งานจะได้ระดับสูงสุดของอาการที่เลือก · ใช้กับการแจ้งงานใหม่</p>
          </div>
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !!conflict}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {symptom ? "บันทึก" : "เพิ่มอาการ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
