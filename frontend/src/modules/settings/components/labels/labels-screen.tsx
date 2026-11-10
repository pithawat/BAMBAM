"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, CheckIcon, Loader2, MinusIcon, Printer, X } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { toast } from "sonner";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getLabelAssets, getPlanBuildings, markLabelsPrinted } from "../../api";
import { LABELS_HEADING, needsReprint, pagesFor } from "../../labels";
import { SETTINGS_HOME } from "../../nav";
import { LABELS_MAX, type LabelAsset, type PlanBuilding } from "../../types";
import { SettingsHeading } from "../settings-heading";
import { errorCode, GENERIC_ERROR, panelClass, sheetOnMobile } from "../settings-ui";
import { LabelBadge } from "./label-badge";
import { LABEL_PRINT_CSS, LabelPages } from "./label-sheet";

// S30 พิมพ์ป้าย QR (settings CR-007, repair CR-036 / F13-A; spec settings ui/screens/S30-qr-labels.md). Building → floor / room
// tree with ticks → asset list with ticks + filter → A4 preview → window.print() → "พิมพ์ป้ายเรียบร้อยไหม" → #57 on yes only
// (BR-F13A-3). Selection in `?building=&floor=&room=&assets=` (S20 entry points; replace, no new history entry).

type Filter = "all" | "reprint" | "never";
type Tick = boolean | "indeterminate";

type RoomGroup = { id: string; name: string; assets: LabelAsset[] };
type FloorGroup = { id: string; name: string; rooms: RoomGroup[]; assets: LabelAsset[] };

function groupRows(rows: LabelAsset[]): FloorGroup[] {
  const floors: FloorGroup[] = [];
  for (const a of rows) {
    let f = floors.at(-1);
    if (!f || f.id !== a.floor.id) floors.push((f = { id: a.floor.id, name: a.floor.name, rooms: [], assets: [] }));
    let r = f.rooms.at(-1);
    if (!r || r.id !== a.room.id) f.rooms.push((r = { id: a.room.id, name: a.room.name, assets: [] }));
    r.assets.push(a);
    f.assets.push(a);
  }
  return floors;
}

function tickOf(assets: LabelAsset[], selected: Set<string>): Tick {
  const n = assets.filter((a) => selected.has(a.id)).length;
  return n === 0 ? false : n === assets.length ? true : "indeterminate";
}

/** The building S30 opens on: the URL's, else the first with active assets, else the first. */
function defaultBuilding(tree: PlanBuilding[], wanted: string | null): PlanBuilding | undefined {
  return (
    tree.find((b) => b.id === wanted) ??
    tree.find((b) => b.floors.some((f) => f.rooms.some((r) => r.activeAssetCount > 0))) ??
    tree[0]
  );
}

export function LabelsScreen() {
  const pathname = usePathname();
  const search = useSearchParams();

  const [tree, setTree] = useState<PlanBuilding[]>();
  const [treeError, setTreeError] = useState<unknown>();
  const [treeRevision, setTreeRevision] = useState(0);
  const [buildingId, setBuildingId] = useState<string>();
  const [rows, setRows] = useState<LabelAsset[]>();
  const [rowsError, setRowsError] = useState<unknown>();
  const [rowsRevision, setRowsRevision] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // the URL preselection (S20 entry) is applied once, to the first list of its building
  const preselect = useRef<{ building: string | null; floor: string | null; room: string | null; assets: string[] } | null>({
    building: search.get("building"),
    floor: search.get("floor"),
    room: search.get("room"),
    assets: (search.get("assets") ?? "").split(",").filter(Boolean),
  });

  function replaceParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => {
    let active = true;
    getPlanBuildings().then(
      (t) => {
        if (!active) return;
        setTree(t);
        setTreeError(undefined);
        setBuildingId((cur) => cur ?? defaultBuilding(t, preselect.current?.building ?? null)?.id);
      },
      (err: unknown) => { if (active) setTreeError(err); },
    );
    return () => { active = false; };
  }, [treeRevision]);

  useEffect(() => {
    if (!buildingId) return;
    let active = true;
    getLabelAssets({ buildingId }).then(
      (list) => {
        if (!active) return;
        setRows(list);
        setRowsError(undefined);
        // keep only ticks that are still listed (ASSET_NOT_ACTIVE reload keeps the still-active ones)
        setSelected((cur) => new Set(list.filter((a) => cur.has(a.id)).map((a) => a.id)));
        const pre = preselect.current;
        if (pre && (!pre.building || pre.building === buildingId)) {
          preselect.current = null;
          const ids = pre.assets.length
            ? list.filter((a) => pre.assets.includes(a.id))
            : pre.room ? list.filter((a) => a.room.id === pre.room)
            : pre.floor ? list.filter((a) => a.floor.id === pre.floor)
            : [];
          if (ids.length) {
            setSelected(new Set(ids.map((a) => a.id)));
            setExpanded(new Set(ids.map((a) => a.floor.id)));
            const first = ids[0].id;
            requestAnimationFrame(() => document.getElementById(`label-row-${first}`)?.scrollIntoView({ block: "center" }));
          }
        }
      },
      (err: unknown) => { if (active) setRowsError(err); },
    );
    return () => { active = false; };
  }, [buildingId, rowsRevision]);

  // a different building starts clean: skeleton, no ticks, filter back to ทั้งหมด
  const [shownBuilding, setShownBuilding] = useState(buildingId);
  if (shownBuilding !== buildingId) {
    setShownBuilding(buildingId);
    setRows(undefined);
    setRowsError(undefined);
    setFilter("all");
    if (shownBuilding !== undefined) {
      setSelected(new Set());
      setExpanded(new Set());
    }
  }

  const floors = useMemo(() => groupRows(rows ?? []), [rows]);
  const visible = useMemo(
    () => (rows ?? []).filter((a) => filter === "all" || (filter === "reprint" ? needsReprint(a.labelStatus) : a.labelStatus === "never")),
    [rows, filter],
  );
  const chosen = useMemo(() => (rows ?? []).filter((a) => selected.has(a.id)), [rows, selected]);
  const count = chosen.length;
  const tooMany = count > LABELS_MAX;
  const hint = count === 0 ? "เลือกอุปกรณ์อย่างน้อย 1 ชิ้น" : tooMany ? `เลือกได้ครั้งละไม่เกิน ${LABELS_MAX} ชิ้น` : null;

  function toggle(assets: LabelAsset[], on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const a of assets) {
        if (on) next.add(a.id);
        else next.delete(a.id);
      }
      return next;
    });
  }

  function pickBuilding(id: string) {
    setBuildingId(id);
    replaceParams({ building: id, floor: null, room: null, assets: null });
  }

  function print() {
    let asked = false;
    const ask = () => {
      if (asked) return;
      asked = true;
      window.removeEventListener("afterprint", ask);
      setConfirmOpen(true);
    };
    window.addEventListener("afterprint", ask);
    window.print();
    // Chrome / Edge block in print(); browsers that return early ask on `afterprint`
    setTimeout(ask, 0);
  }

  async function confirmPrinted() {
    setSaving(true);
    try {
      await markLabelsPrinted(chosen.map((a) => a.id));
      toast.success(`บันทึกการพิมพ์ป้าย ${count} ชิ้นแล้ว`);
      setConfirmOpen(false);
      setPreviewOpen(false);
      setRowsRevision((r) => r + 1);
    } catch (err) {
      if (errorCode(err) === "ASSET_NOT_ACTIVE") {
        toast.error("มีอุปกรณ์ที่ถูกปิดใช้งานระหว่างนี้ โหลดข้อมูลล่าสุดให้แล้ว");
        setConfirmOpen(false);
        setPreviewOpen(false);
        setRowsRevision((r) => r + 1);
      } else {
        toast.error(GENERIC_ERROR); // the confirm stays open: answer again
      }
    } finally {
      setSaving(false);
    }
  }

  const heading = (
    <>
      <nav aria-label="breadcrumb" className="mb-3 text-[13px] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>ตั้งค่าระบบ</li>
          <li aria-hidden><ChevronRight className="size-3.5" /></li>
          <li><Link href={SETTINGS_HOME} className="rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30">สถานที่และอุปกรณ์</Link></li>
          <li aria-hidden><ChevronRight className="size-3.5" /></li>
          <li aria-current="page" className="font-medium text-foreground">พิมพ์ป้าย QR</li>
        </ol>
      </nav>
      <SettingsHeading {...LABELS_HEADING} />
    </>
  );

  const failure = treeError ?? rowsError;
  if (failure !== undefined) {
    return (
      <>
        {heading}
        <section className={panelClass}>
          {errorCode(failure) === "FORBIDDEN" ? (
            <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason="บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ" />
          ) : (
            <ErrorState
              hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง"
              onRetry={() => {
                if (treeError !== undefined) { setTreeError(undefined); setTreeRevision((r) => r + 1); }
                else { setRowsError(undefined); setRowsRevision((r) => r + 1); }
              }}
            />
          )}
        </section>
      </>
    );
  }

  const building = tree?.find((b) => b.id === buildingId);
  const loading = !tree || !rows;
  const action = (
    <Button className="h-11 w-full px-4 sm:w-auto" disabled={!!hint || loading} onClick={() => setPreviewOpen(true)} aria-describedby="labels-hint">
      <Printer aria-hidden />ดูตัวอย่างและพิมพ์ ({count})
    </Button>
  );

  return (
    <>
      {heading}
      <div className="grid gap-4 pb-24 lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-6 lg:pb-0">
        {/* building + floor / room tree */}
        <nav aria-label="เลือกอุปกรณ์ตามสถานที่" className={cn(panelClass, "space-y-3 p-4 lg:sticky lg:top-6")}>
          <div className="space-y-1.5">
            <span id="labels-building" className="text-[13px] font-medium">อาคาร</span>
            {tree && building ? (
              <Select value={building.id} onValueChange={pickBuilding}>
                <SelectTrigger aria-labelledby="labels-building" className="h-11 w-full bg-card data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" avoidCollisions={false}>{tree.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-11 w-full" />
            )}
          </div>
          {loading ? (
            <div className="space-y-3 pt-1" aria-busy="true" aria-label="กำลังโหลด">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-2.5"><Skeleton className="size-4" /><Skeleton className="h-4 w-2/3" /></div>)}
            </div>
          ) : rows.length > 0 ? (
            <ul className="space-y-0.5" aria-label="ชั้นและห้อง">
              <li>
                <TreeRow label="ทั้งอาคาร" count={rows.length} tick={tickOf(rows, selected)} onTick={(on) => toggle(rows, on)} strong />
              </li>
              {floors.map((f) => {
                const open = expanded.has(f.id);
                return (
                  <li key={f.id}>
                    <TreeRow
                      label={`ชั้น ${f.name}`}
                      count={f.assets.length}
                      tick={tickOf(f.assets, selected)}
                      onTick={(on) => toggle(f.assets, on)}
                      expanded={open}
                      onExpand={() => setExpanded((cur) => { const n = new Set(cur); if (open) n.delete(f.id); else n.add(f.id); return n; })}
                    />
                    {open && (
                      <ul className="ml-7 space-y-0.5 border-l pl-2" aria-label={`ห้องในชั้น ${f.name}`}>
                        {f.rooms.map((r) => (
                          <li key={r.id}>
                            <TreeRow label={r.name} count={r.assets.length} tick={tickOf(r.assets, selected)} onTick={(on) => toggle(r.assets, on)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </nav>

        {/* asset list */}
        <section className={cn(panelClass, "overflow-hidden")} aria-label="อุปกรณ์ที่จะพิมพ์ป้าย">
          {loading ? (
            <div className="space-y-4 p-5" aria-busy="true" aria-label="กำลังโหลด">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-3"><Skeleton className="size-4" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 flex-1" /></div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="ยังไม่มีอุปกรณ์ในอาคารนี้"
                hint="เพิ่มอุปกรณ์ได้ที่หน้าสถานที่และอุปกรณ์"
                action={<Button asChild variant="secondary"><Link href={SETTINGS_HOME}>ไปที่สถานที่และอุปกรณ์</Link></Button>}
              />
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3 lg:px-5">
                <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} aria-label="กรองตามสถานะป้าย" className="flex-wrap">
                  <ToggleGroupItem value="all" className="h-9 px-3 data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:text-primary">ทั้งหมด</ToggleGroupItem>
                  <ToggleGroupItem value="reprint" className="h-9 px-3 data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:text-primary">ควรพิมพ์ใหม่</ToggleGroupItem>
                  <ToggleGroupItem value="never" className="h-9 px-3 data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:text-primary">ยังไม่เคยพิมพ์</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground lg:px-5">ไม่มีอุปกรณ์ตามตัวกรองนี้</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                      <th scope="col" className="w-12 py-3 pl-4 lg:pl-5">
                        <TriCheckbox
                          label="เลือกทั้งหมดที่แสดง"
                          tick={tickOf(visible, selected)}
                          onTick={(on) => toggle(visible, on)}
                        />
                      </th>
                      <th scope="col" className="px-3 py-3 font-medium">อุปกรณ์</th>
                      <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">ห้อง</th>
                      <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell">สถานะป้าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a) => {
                      const on = selected.has(a.id);
                      return (
                        <tr key={a.id} id={`label-row-${a.id}`} data-testid="label-row" className={cn("border-t", on && "bg-secondary/40")}>
                          <td className="py-3 pl-4 align-top lg:pl-5">
                            <TriCheckbox label={`เลือก ${a.code} ${a.name}`} tick={on} onTick={(v) => toggle([a], v)} />
                          </td>
                          <td className="px-3 py-3">
                            <span className="block font-mono text-[13px] font-medium">{a.code}</span>
                            <span className="block text-foreground">{a.name}</span>
                            <span className="block text-xs text-muted-foreground md:hidden">ชั้น {a.floor.name} · {a.room.name}</span>
                            <LabelBadge status={a.labelStatus} className="mt-1 lg:hidden" />
                          </td>
                          <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">ชั้น {a.floor.name} · {a.room.name}</td>
                          <td className="hidden px-3 py-3 lg:table-cell"><LabelBadge status={a.labelStatus} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {/* desktop footer */}
              <div className="hidden items-center gap-4 border-t px-5 py-4 lg:flex">
                <p className="flex-1 text-sm" aria-live="polite">
                  เลือกแล้ว <strong className="tabular-nums">{count}</strong> ชิ้น · <span className="tabular-nums">{pagesFor(count)}</span> หน้า A4
                  {hint && <span id="labels-hint" className={cn("block text-xs", tooMany ? "text-destructive" : "text-muted-foreground")}>{hint}</span>}
                </p>
                {action}
              </div>
            </>
          )}
        </section>
      </div>

      {/* mobile sticky action */}
      {!loading && rows.length > 0 && (
        <div className="fixed inset-x-0 bottom-(--app-bottom) z-30 border-t bg-card/95 px-4 pt-3 pb-3 backdrop-blur group-data-typing/shell:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <p className="mb-2 text-[13px] text-muted-foreground">
            เลือกแล้ว <strong className="text-foreground tabular-nums">{count}</strong> ชิ้น · {pagesFor(count)} หน้า A4
            {hint && <span className={cn("ml-1", tooMany && "text-destructive")}>· {hint}</span>}
          </p>
          {action}
        </div>
      )}

      <PreviewDialog
        open={previewOpen}
        assets={chosen}
        onOpenChange={setPreviewOpen}
        onPrint={print}
      />

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent className={sheetOnMobile}>
          <AlertDialogHeader>
            <AlertDialogTitle>พิมพ์ป้ายเรียบร้อยไหม</AlertDialogTitle>
            <AlertDialogDescription>ระบบจะจำข้อมูลบนป้าย {count} ชิ้นนี้ไว้ เพื่อเตือนเมื่ออุปกรณ์ถูกย้ายหรือเปลี่ยนชื่อ</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setConfirmOpen(false)}>ยังไม่</Button>
            <Button disabled={saving} onClick={confirmPrinted}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              ใช่ พิมพ์แล้ว
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Radix checkbox with a minus for "some ticked" (the shared one draws a check for both). */
function TriCheckbox({ label, tick, onTick }: { label: string; tick: Tick; onTick: (on: boolean) => void }) {
  return (
    <CheckboxPrimitive.Root
      checked={tick}
      onCheckedChange={() => onTick(tick !== true)}
      aria-label={label}
      className="relative grid size-5 shrink-0 place-items-center rounded-[5px] border border-input bg-card outline-none after:absolute after:-inset-3 focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {tick === "indeterminate" ? <MinusIcon className="size-3.5" aria-hidden /> : <CheckIcon className="size-3.5" aria-hidden />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function TreeRow({ label, count, tick, onTick, expanded, onExpand, strong }: {
  label: string;
  count: number;
  tick: Tick;
  onTick: (on: boolean) => void;
  expanded?: boolean;
  onExpand?: () => void;
  strong?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-lg pr-1 hover:bg-muted/60">
      {onExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "ซ่อน" : "แสดง"}ห้องใน${label}`}
          onClick={onExpand}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} aria-hidden />
        </button>
      ) : (
        <span className="w-1 shrink-0" aria-hidden />
      )}
      <TriCheckbox label={`${label} (${count})`} tick={tick} onTick={onTick} />
      <span className={cn("min-w-0 flex-1 truncate text-sm", strong && "font-semibold")} aria-hidden>
        {label} <span className="text-muted-foreground tabular-nums">({count})</span>
      </span>
    </div>
  );
}

function PreviewDialog({ open, assets, onOpenChange, onPrint }: {
  open: boolean;
  assets: LabelAsset[];
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const pages = pagesFor(assets.length);
  const [mono, setMono] = useState(false); // CR-037: colour by default, black-on-white for any printer
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none lg:inset-6 lg:h-[calc(100dvh-3rem)] lg:w-[calc(100vw-3rem)] lg:rounded-xl"
        >
          <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3 lg:px-6">
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg font-semibold">ตัวอย่างป้าย QR</DialogTitle>
              <DialogDescription className="text-[13px]">{assets.length} ชิ้น · {pages} หน้า A4 · พิมพ์ที่ขนาดจริง 100 %</DialogDescription>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={mono} onChange={(e) => setMono(e.target.checked)} />
              พิมพ์แบบขาวดำ
            </label>
            <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}><X aria-hidden />ปิด</Button>
            <Button className="h-11" onClick={onPrint}><Printer aria-hidden />พิมพ์</Button>
          </div>
          <div className="flex-1 overflow-auto bg-muted/60 px-3 py-5">
            <div className="flex flex-col items-center gap-4 [zoom:0.42] sm:[zoom:0.7] lg:[zoom:0.85]">
              {open && <LabelPages assets={assets} origin={origin} mono={mono} pageClassName="shadow-lg" />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* the print sheet: hidden on screen, the only thing on paper */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="qr-print-root" aria-hidden>
          <style>{LABEL_PRINT_CSS}</style>
          <LabelPages assets={assets} origin={origin} mono={mono} />
        </div>,
        document.body,
      )}
    </>
  );
}
