"use client";

import { createElement, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Info, MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { categoryIconOf } from "@/components/shared/category-icon";
import { PriorityBadge } from "@/components/shared/priority-indicator";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { DESKTOP_QUERY } from "@/components/shared/use-media-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { deleteCategory, deleteSymptom, getCategories, getSymptoms, reorderCategories, reorderSymptoms, updateCategory, updateSymptom } from "../../api";
import type { CategoryAdmin, SymptomAdmin } from "../../types";
import { ConfirmDialog, type Confirm } from "../confirm-dialog";
import { SettingsHeading } from "../settings-heading";
import { errorCode, GENERIC_ERROR, panelClass } from "../settings-ui";
import { CategoryDialog, SymptomDialog } from "./category-dialogs";

// S22 หมวดงานและอาการ (F27; spec screens/S22-categories.md + CR-001 block; design CR-001-admin-settings.html#categories).
// Route `/settings/categories` (first category) · `/settings/categories/{id}` (that category, replace on select).

const NO_ACCESS = "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ";

function CategoryTile({ icon, className }: { icon: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary", className)}>
      {createElement(categoryIconOf(icon), { className: "size-4.5" })}
    </span>
  );
}

const versionOf = (items: { updatedAt: string }[]) => items.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), "");

/** `ids` with the item at `index` moved by `delta` (−1 up, +1 down). */
function moved(ids: string[], index: number, delta: number) {
  const next = [...ids];
  const [x] = next.splice(index, 1);
  next.splice(index + delta, 0, x);
  return next;
}

export function CategoriesScreen({ categoryId }: { categoryId?: string }) {
  const [categories, setCategories] = useState<CategoryAdmin[]>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(categoryId);
  const [showInactive, setShowInactive] = useState(false);
  const [symptoms, setSymptoms] = useState<SymptomAdmin[]>();
  const [symptomsError, setSymptomsError] = useState(false);
  const [symptomsRevision, setSymptomsRevision] = useState(0);
  const [categoryDialog, setCategoryDialog] = useState<CategoryAdmin | "new" | null>(null);
  const [symptomDialog, setSymptomDialog] = useState<{ open: boolean; symptom?: SymptomAdmin }>({ open: false });
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    let active = true;
    getCategories().then(
      (list) => { if (active) { setCategories(list); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [revision]);

  const visibleCategories = (categories ?? []).filter((c) => showInactive || c.isActive || c.id === selectedId);
  const selected = categories?.find((c) => c.id === selectedId) ?? visibleCategories[0];
  const notFound = !!categoryId && !!categories && categoryId === selectedId && !categories.some((c) => c.id === categoryId);

  const selId = selected?.id;
  useEffect(() => {
    if (!selId) return;
    let active = true;
    getSymptoms(selId).then(
      (list) => { if (active) { setSymptoms(list); setSymptomsError(false); } },
      () => { if (active) setSymptomsError(true); },
    );
    return () => { active = false; };
  }, [selId, symptomsRevision]);

  const [shownCat, setShownCat] = useState(selId);
  if (shownCat !== selId) {
    setShownCat(selId);
    setSymptoms(undefined);
  }

  function select(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `/settings/categories/${id}`);
    // phones stack the panels: bring the chosen category's symptoms into view
    if (!window.matchMedia(DESKTOP_QUERY).matches) window.requestAnimationFrame(() => document.getElementById("category-detail")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  async function reloadCategories() {
    const list = await getCategories();
    setCategories(list);
    return list;
  }
  async function reloadSymptoms() {
    if (!selId) return [];
    const list = await getSymptoms(selId);
    setSymptoms(list);
    return list;
  }

  function failed(err: unknown, reload: () => Promise<unknown>) {
    const code = errorCode(err);
    if (code === "IN_USE") toast.error("ลบไม่ได้ เพราะเคยถูกใช้แล้ว ปิดใช้งานแทน");
    else if (code === "VERSION_CONFLICT") toast.error("ข้อมูลนี้ถูกแก้โดยผู้ใช้อื่น โหลดข้อมูลล่าสุดแล้ว");
    else toast.error(GENERIC_ERROR);
    reload().catch(() => undefined);
  }

  async function moveCategory(index: number, delta: number) {
    if (!categories) return;
    try {
      const list = await reorderCategories({ ids: moved(categories.map((c) => c.id), index, delta), version: versionOf(categories) });
      setCategories(list);
      toast.success("บันทึกลำดับแล้ว");
    } catch (err) {
      failed(err, reloadCategories);
    }
  }
  async function moveSymptom(index: number, delta: number) {
    if (!symptoms || !selId) return;
    try {
      const list = await reorderSymptoms(selId, { ids: moved(symptoms.map((s) => s.id), index, delta), version: versionOf(symptoms) });
      setSymptoms(list);
      toast.success("บันทึกลำดับแล้ว");
    } catch (err) {
      failed(err, reloadSymptoms);
    }
  }

  function setCategoryActive(c: CategoryAdmin, isActive: boolean) {
    const run = async () => {
      try {
        await updateCategory(c.id, { isActive, updatedAt: c.updatedAt });
        toast.success(isActive ? `เปิดใช้งาน "${c.name}" แล้ว` : `ปิดใช้งาน "${c.name}" แล้ว`);
        await reloadCategories();
      } catch (err) {
        failed(err, reloadCategories);
      }
    };
    if (isActive) void run();
    else setConfirm({ title: `ปิดใช้งาน "${c.name}"?`, body: "หมวดงานนี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง", extra: "อาการทั้งหมดในหมวดนี้จะไม่แสดงในฟอร์มด้วย", confirm: "ปิดใช้งาน", destructive: true, run });
  }

  function removeCategory(c: CategoryAdmin) {
    setConfirm({
      title: `ลบ "${c.name}"?`, body: "ลบถาวร กู้คืนไม่ได้", confirm: "ลบ", destructive: true,
      run: async () => {
        try {
          await deleteCategory(c.id);
          toast.success(`ลบ "${c.name}" แล้ว`);
          setSelectedId(undefined);
          window.history.replaceState(null, "", "/settings/categories");
          await reloadCategories();
        } catch (err) {
          failed(err, reloadCategories);
        }
      },
    });
  }

  const lastActive = (s: SymptomAdmin) => s.isActive && (symptoms ?? []).filter((x) => x.isActive).length === 1;
  const lastLine = (s: SymptomAdmin) => (lastActive(s) && selected ? `นี่คืออาการสุดท้ายที่เปิดใช้งานของหมวด "${selected.name}" หมวดนี้จะไม่แสดงในฟอร์มแจ้งซ่อม` : null);

  function setSymptomActive(s: SymptomAdmin, isActive: boolean) {
    const run = async () => {
      try {
        await updateSymptom(s.id, { isActive, updatedAt: s.updatedAt });
        toast.success(isActive ? `เปิดใช้งาน "${s.name}" แล้ว` : `ปิดใช้งาน "${s.name}" แล้ว`);
        await Promise.all([reloadSymptoms(), reloadCategories()]);
      } catch (err) {
        failed(err, reloadSymptoms);
      }
    };
    if (isActive) void run();
    else setConfirm({ title: `ปิดใช้งาน "${s.name}"?`, body: "อาการนี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง", extra: lastLine(s), confirm: "ปิดใช้งาน", destructive: true, run });
  }

  function removeSymptom(s: SymptomAdmin) {
    setConfirm({
      title: `ลบ "${s.name}"?`, body: "ลบถาวร กู้คืนไม่ได้", extra: lastLine(s), confirm: "ลบ", destructive: true,
      run: async () => {
        try {
          await deleteSymptom(s.id);
          toast.success(`ลบ "${s.name}" แล้ว`);
          await Promise.all([reloadSymptoms(), reloadCategories()]);
        } catch (err) {
          failed(err, reloadSymptoms);
        }
      },
    });
  }

  const heading = (
    <SettingsHeading
      title="หมวดงานและอาการ"
      subtitle="จัดระเบียบหมวดงาน อาการ และความเร่งด่วนของงานแจ้งซ่อม"
      action={categories ? <Button className="h-11 px-4" onClick={() => setCategoryDialog("new")}><Plus aria-hidden />เพิ่มหมวดงาน</Button> : undefined}
    />
  );

  if (error !== undefined) {
    return (
      <>
        {heading}
        <section className={panelClass}>
          {errorCode(error) === "FORBIDDEN" ? (
            <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason={NO_ACCESS} />
          ) : (
            <ErrorState hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่" onRetry={() => { setError(undefined); setRevision((r) => r + 1); }} />
          )}
        </section>
      </>
    );
  }

  if (!categories) {
    return (
      <>
        {heading}
        <div className="grid gap-4 lg:grid-cols-[18.75rem_1fr] lg:gap-6" aria-busy="true" aria-label="กำลังโหลด">
          <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-3 p-2"><Skeleton className="size-10 rounded-lg" /><Skeleton className="h-4 flex-1" /></div>)}</div>
          <div className={cn(panelClass, "space-y-4 p-5")}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        </div>
      </>
    );
  }

  if (categories.length === 0) {
    return (
      <>
        {heading}
        <section className={cn(panelClass, "p-4")}>
          <EmptyState title="ยังไม่มีหมวดงาน" hint="ผู้แจ้งต้องเลือกหมวดงานทุกครั้งที่แจ้งซ่อม" action={<Button onClick={() => setCategoryDialog("new")}>เพิ่มหมวดงาน</Button>} />
        </section>
        <CategoryDialog target={categoryDialog} onOpenChange={(o) => !o && setCategoryDialog(null)}
          onSaved={(c) => { setCategoryDialog(null); select(c.id); reloadCategories().catch(() => undefined); }}
          fetchFresh={async (id) => (await reloadCategories()).find((c) => c.id === id) ?? null} />
      </>
    );
  }

  const activeSymptoms = (symptoms ?? []).filter((s) => s.isActive);

  return (
    <>
      {heading}
      <div className="grid gap-4 lg:grid-cols-[18.75rem_1fr] lg:items-start lg:gap-6">
        <nav aria-label="หมวดงาน" className="space-y-1">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            หมวดงาน <span className="rounded-md bg-muted px-1.5 text-xs font-normal text-muted-foreground">{categories.filter((c) => c.isActive).length}</span>
          </h2>
          <ul className="space-y-1">
            {visibleCategories.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={c.id === selected?.id} onClick={() => select(c.id)}
                  className={cn("flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    c.id === selected?.id ? "bg-secondary" : "hover:bg-muted", !c.isActive && "text-muted-foreground")}>
                  <CategoryTile icon={c.icon} className={c.id === selected?.id ? "bg-card" : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", c.id === selected?.id && "text-primary")}>{c.name}</span>
                    <span className={cn("block text-xs", c.activeSymptomCount === 0 && !c.isOther ? "text-warning" : "text-muted-foreground")}>
                      {c.activeSymptomCount === 0 && !c.isOther ? "ไม่มีอาการ" : `${c.activeSymptomCount} อาการ`}
                      {!c.isActive && " · ปิดใช้งาน"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-2 flex min-h-11 items-center gap-2 border-t px-1 pt-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-primary" />
            แสดงที่ปิดใช้งาน
          </label>
        </nav>

        <div>
          {notFound ? (
            <section className={cn(panelClass, "p-6 text-center")}>
              <p className="font-semibold">ไม่พบหมวดงานนี้</p>
              <Button variant="outline" className="mt-4" onClick={() => select(categories[0].id)}>กลับไปรายการหมวดงาน</Button>
            </section>
          ) : selected && (
            <section id="category-detail" className={cn(panelClass, "scroll-mt-4 overflow-hidden")} aria-label={selected.name}>
              <div className="border-b px-4 py-4 lg:px-5">
                <div className="flex items-start gap-3">
                  <CategoryTile icon={selected.icon} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-lg font-semibold">{selected.name}</h2>
                    <p className="text-[13px] text-muted-foreground">{selected.isActive ? "เปิดใช้งานในแบบฟอร์มแจ้งซ่อม" : "ปิดใช้งาน"}</p>
                  </div>
                  <RowMenu label={selected.name}>
                    <DropdownMenuItem className="min-h-10" onSelect={() => setCategoryDialog(selected)}><Pencil aria-hidden />แก้ไขหมวดงาน</DropdownMenuItem>
                    <DropdownMenuItem className="min-h-10" disabled={categories.indexOf(selected) === 0} onSelect={() => moveCategory(categories.indexOf(selected), -1)}><ArrowUp aria-hidden />เลื่อนขึ้น</DropdownMenuItem>
                    <DropdownMenuItem className="min-h-10" disabled={categories.indexOf(selected) === categories.length - 1} onSelect={() => moveCategory(categories.indexOf(selected), 1)}><ArrowDown aria-hidden />เลื่อนลง</DropdownMenuItem>
                    {!selected.isOther && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="min-h-10" onSelect={() => setCategoryActive(selected, !selected.isActive)}><Power aria-hidden />{selected.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</DropdownMenuItem>
                        <DropdownMenuItem className="min-h-10" variant="destructive" disabled={selected.inUse} onSelect={() => removeCategory(selected)}>
                          <Trash2 aria-hidden />
                          <span className="flex flex-col">ลบ{selected.inUse && <span className="text-xs text-muted-foreground">เคยถูกใช้แล้ว ปิดใช้งานแทน</span>}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </RowMenu>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                  ความเร่งด่วนตั้งต้น <PriorityBadge priority={selected.defaultPriority} className="text-xs" /> ใช้เมื่อเลือก “อาการอื่น ๆ”
                </p>
              </div>

              <div className="flex items-center gap-2 border-b px-4 py-3 lg:px-5">
                <h3 className="flex flex-1 items-center gap-2 font-semibold">
                  อาการ <span className="rounded-md bg-muted px-1.5 text-xs font-normal text-muted-foreground">{symptoms ? activeSymptoms.length : "–"}</span>
                </h3>
                <Button size="sm" className="h-10" onClick={() => setSymptomDialog({ open: true })}><Plus aria-hidden />เพิ่มอาการ</Button>
              </div>

              {symptomsError ? (
                <div className="space-y-3 p-4">
                  <Alert variant="destructive"><AlertCircle aria-hidden /><AlertTitle>โหลดรายการอาการไม่สำเร็จ</AlertTitle><AlertDescription>ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง</AlertDescription></Alert>
                  <Button variant="outline" onClick={() => setSymptomsRevision((r) => r + 1)}>ลองอีกครั้ง</Button>
                </div>
              ) : !symptoms ? (
                <div className="space-y-4 p-5" aria-busy="true" aria-label="กำลังโหลด">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
              ) : activeSymptoms.length === 0 && !selected.isOther ? (
                <div className="space-y-3 p-4">
                  <Alert className="border-warning/30 bg-warning/5"><AlertTriangle className="text-warning" aria-hidden /><AlertDescription className="text-foreground">หมวดนี้ไม่แสดงในฟอร์มแจ้งซ่อม เพราะยังไม่มีอาการที่เปิดใช้งาน</AlertDescription></Alert>
                  {symptoms.length === 0 && (
                    <EmptyState title="ยังไม่มีอาการที่เปิดใช้งาน" hint="หมวดนี้จะไม่แสดงในแบบฟอร์มแจ้งซ่อม จนกว่าจะมีอาการที่เปิดใช้งาน" action={<Button onClick={() => setSymptomDialog({ open: true })}>เพิ่มอาการ</Button>} />
                  )}
                </div>
              ) : null}

              {symptoms && symptoms.length > 0 && (
                <ul className="divide-y border-t first:border-t-0">
                  {symptoms.filter((s) => showInactive || s.isActive).map((s) => {
                    const index = symptoms.indexOf(s);
                    return (
                      <li key={s.id} className={cn("flex min-h-14 items-center gap-3 px-4 py-2 lg:px-5", !s.isActive && "text-muted-foreground")}>
                        <span className="min-w-0 flex-1 text-sm">
                          {s.name}
                          {!s.isActive && <span className="ml-2 rounded-sm bg-muted px-1.5 text-xs">ปิดใช้งาน</span>}
                        </span>
                        <PriorityBadge priority={s.priority} className="text-xs" />
                        <RowMenu label={s.name}>
                          <DropdownMenuItem className="min-h-10" onSelect={() => setSymptomDialog({ open: true, symptom: s })}><Pencil aria-hidden />แก้ไขอาการและความเร่งด่วน</DropdownMenuItem>
                          <DropdownMenuItem className="min-h-10" disabled={index === 0} onSelect={() => moveSymptom(index, -1)}><ArrowUp aria-hidden />เลื่อนขึ้น</DropdownMenuItem>
                          <DropdownMenuItem className="min-h-10" disabled={index === symptoms.length - 1} onSelect={() => moveSymptom(index, 1)}><ArrowDown aria-hidden />เลื่อนลง</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="min-h-10" onSelect={() => setSymptomActive(s, !s.isActive)}><Power aria-hidden />{s.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</DropdownMenuItem>
                          <DropdownMenuItem className="min-h-10" variant="destructive" disabled={s.inUse} onSelect={() => removeSymptom(s)}>
                            <Trash2 aria-hidden />
                            <span className="flex flex-col">ลบ{s.inUse && <span className="text-xs text-muted-foreground">เคยถูกใช้แล้ว ปิดใช้งานแทน</span>}</span>
                          </DropdownMenuItem>
                        </RowMenu>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
          <p className="mt-3 flex gap-2 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>เมื่อเลือกหลายอาการ งานจะใช้ระดับความเร่งด่วนสูงสุดของอาการที่เลือก<br />การตั้งค่านี้ใช้กับงานที่แจ้งใหม่ งานเดิมคงระดับที่ได้รับไว้</span>
          </p>
        </div>
      </div>

      <CategoryDialog
        target={categoryDialog}
        onOpenChange={(o) => !o && setCategoryDialog(null)}
        onSaved={(c, added) => { setCategoryDialog(null); if (added) select(c.id); reloadCategories().catch(() => undefined); }}
        fetchFresh={async (id) => (await reloadCategories()).find((c) => c.id === id) ?? null}
      />
      <SymptomDialog
        category={selected ?? null}
        symptom={symptomDialog.symptom}
        open={symptomDialog.open}
        onOpenChange={(open) => setSymptomDialog((d) => ({ ...d, open }))}
        onSaved={() => { setSymptomDialog({ open: false }); Promise.all([reloadSymptoms(), reloadCategories()]).catch(() => undefined); }}
        fetchFresh={async (id) => (await reloadSymptoms()).find((s) => s.id === id) ?? null}
      />
      <ConfirmDialog value={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`ตัวเลือกของ ${label}`}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
