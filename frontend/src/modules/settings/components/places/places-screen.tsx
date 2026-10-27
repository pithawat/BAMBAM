"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Box, ChevronRight, DoorOpen, Lock, MoreHorizontal, Pencil, Plus, Power, Search, Tags } from "lucide-react";
import { toast } from "sonner";
import { AssetIcon } from "@/components/shared/asset-icon";
import { useCurrentUser } from "@/components/shared/me-provider";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { can, PERM } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";
import { getAssetTypes, getPlanBuildings, getRoomAssets, updateAsset } from "../../api";
import type { AssetAdmin, AssetTypeAdmin, PlanBuilding } from "../../types";
import { SettingsHeading } from "../settings-heading";
import { errorCode, GENERIC_ERROR, panelClass, sheetOnMobile } from "../settings-ui";
import { AssetDialog, type AssetDialogTarget } from "./asset-dialog";
import { AssetTypeDialog, mountLabel, RenameDialog, type RenameTarget } from "./place-dialogs";

// S20 อาคารและอุปกรณ์ (F26; spec screens/S20-buildings.md, CR-001 / CR-002; design CR-001-admin-settings.html#places).
// `?tab=assets|asset-types`, selection `?building=&floor=&room=` (replace, no history entry). Structure comes from the
// building plan: nothing here creates, deletes, reorders or deactivates buildings, floors or rooms.

type Tab = "assets" | "asset-types";

const SUBTITLE: Record<Tab, string> = {
  assets: "เลือกห้องจากผัง แล้วจัดการอุปกรณ์ที่ติดตั้งในห้องนั้น",
  "asset-types": "จัดการประเภทอุปกรณ์ที่เลือกใช้ร่วมกันได้ในทุกอาคาร",
};

export function PlacesScreen() {
  const me = useCurrentUser();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab: Tab = search.get("tab") === "asset-types" ? "asset-types" : "assets";
  const canRename = can(me, PERM.settingsLocations);
  const canAssets = can(me, PERM.settingsAssets);

  const [tree, setTree] = useState<PlanBuilding[]>();
  const [types, setTypes] = useState<AssetTypeAdmin[]>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [typeDialog, setTypeDialog] = useState<AssetTypeAdmin | "new" | null>(null);

  function setParams(next: Record<string, string | null>) {
    // the current URL (not this render's copy); native history updates it synchronously and Next syncs useSearchParams
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => {
    let active = true;
    Promise.all([getPlanBuildings(), canAssets ? getAssetTypes() : Promise.resolve([] as AssetTypeAdmin[])]).then(
      ([t, ty]) => { if (active) { setTree(t); setTypes(ty); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [revision, canAssets]);

  async function reloadTree() {
    const t = await getPlanBuildings();
    setTree(t);
    return t;
  }
  async function reloadTypes() {
    const t = await getAssetTypes();
    setTypes(t);
    return t;
  }

  const heading = (
    <SettingsHeading
      title="อาคารและอุปกรณ์"
      subtitle={SUBTITLE[tab]}
      action={tab === "asset-types" && canAssets && types ? (
        <Button className="h-11 px-4" onClick={() => setTypeDialog("new")}><Plus aria-hidden />เพิ่มประเภทอุปกรณ์</Button>
      ) : undefined}
    />
  );

  if (error !== undefined) {
    return (
      <>
        {heading}
        <section className={panelClass}>
          {errorCode(error) === "FORBIDDEN" ? (
            <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason="บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ" />
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
      <div role="tablist" aria-label="อาคารและอุปกรณ์" className="mb-5 flex gap-1 border-b">
        <TabButton active={tab === "assets"} onClick={() => setParams({ tab: null })} icon={Box}>อุปกรณ์ในห้อง</TabButton>
        {canAssets && (
          <TabButton active={tab === "asset-types"} onClick={() => setParams({ tab: "asset-types" })} icon={Tags}>
            ประเภทอุปกรณ์
            <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{types?.length ?? "–"}</span>
          </TabButton>
        )}
      </div>

      {!tree || !types ? (
        <PanelSkeleton />
      ) : tab === "asset-types" ? (
        <TypesPanel types={types} onAdd={() => setTypeDialog("new")} onEdit={setTypeDialog} />
      ) : tree.length === 0 || tree.every((b) => b.floors.length === 0) ? (
        <section className={cn(panelClass, "p-4")}>
          <EmptyState title="ยังไม่มีข้อมูลผังอาคาร" hint="อาคาร ชั้น และห้องจะแสดงเมื่อมีการกำหนดผังอาคารแล้ว" />
        </section>
      ) : (
        <AssetsTab
          tree={tree}
          types={types}
          canRename={canRename}
          canAssets={canAssets}
          search={search}
          setParams={setParams}
          reloadTree={reloadTree}
          onTypeAdded={() => { reloadTypes().catch(() => undefined); }}
        />
      )}

      <AssetTypeDialog
        target={typeDialog}
        onOpenChange={(o) => !o && setTypeDialog(null)}
        onSaved={() => { setTypeDialog(null); reloadTypes().catch(() => undefined); }}
        fetchFresh={async (id) => (await reloadTypes()).find((t) => t.id === id) ?? null}
      />
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Box; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className={cn(panelClass, "space-y-4 p-5")} aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
        </div>
      ))}
    </div>
  );
}

// ---- tab อุปกรณ์ในห้อง ----

type AssetsTabProps = {
  tree: PlanBuilding[];
  types: AssetTypeAdmin[];
  canRename: boolean;
  canAssets: boolean;
  search: { get(name: string): string | null };
  setParams: (next: Record<string, string | null>) => void;
  reloadTree: () => Promise<PlanBuilding[]>;
  onTypeAdded: () => void;
};

function AssetsTab({ tree, types, canRename, canAssets, search, setParams, reloadTree, onTypeAdded }: AssetsTabProps) {
  // Selection from the URL with fallbacks: first building, its bottom floor, that floor's first room.
  const building = tree.find((b) => b.id === search.get("building")) ?? tree.find((b) => b.floors.length > 0) ?? tree[0];
  const floor = building.floors.find((f) => f.id === search.get("floor")) ?? building.floors[0];
  const room = floor?.rooms.find((r) => r.id === search.get("room")) ?? floor?.rooms[0];

  const [assets, setAssets] = useState<AssetAdmin[]>();
  const [assetsError, setAssetsError] = useState(false);
  const [assetsRevision, setAssetsRevision] = useState(0);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [rename, setRename] = useState<RenameTarget | null>(null);
  const [assetDialog, setAssetDialog] = useState<AssetDialogTarget | null>(null);
  const [deactivating, setDeactivating] = useState<AssetAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roomId = room?.id;
  useEffect(() => {
    if (!roomId || !canAssets) return;
    let active = true;
    getRoomAssets(roomId, { includeInactive: true }).then(
      (list) => { if (active) { setAssets(list); setAssetsError(false); } },
      () => { if (active) setAssetsError(true); },
    );
    return () => { active = false; };
  }, [roomId, assetsRevision, canAssets]);

  // A different room starts clean: skeleton, no search / filter.
  const [shownRoom, setShownRoom] = useState(roomId);
  if (shownRoom !== roomId) {
    setShownRoom(roomId);
    setAssets(undefined);
    setQ("");
    setTypeFilter("all");
  }

  function select(next: { building?: string; floor?: string; room?: string }) {
    setParams({ building: next.building ?? building.id, floor: next.floor ?? null, room: next.room ?? null });
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (assets ?? [])
      .filter((a) => showInactive || a.isActive)
      .filter((a) => typeFilter === "all" || a.type.id === typeFilter)
      .filter((a) => !needle || a.code.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle));
  }, [assets, q, typeFilter, showInactive]);
  const activeCount = (assets ?? []).filter((a) => a.isActive).length;

  async function afterAssetSaved(a: AssetAdmin) {
    setAssetDialog(null);
    const t = await reloadTree().catch(() => tree);
    // select where the asset is now (it may have moved) and clear the filters
    for (const b of t) for (const f of b.floors) if (f.rooms.some((r) => r.id === a.roomId)) setParams({ building: b.id, floor: f.id, room: a.roomId });
    setQ("");
    setTypeFilter("all");
    setAssetsRevision((r) => r + 1);
  }

  async function setActive(a: AssetAdmin, isActive: boolean) {
    setBusyId(a.id);
    try {
      await updateAsset(a.id, { isActive, updatedAt: a.updatedAt });
      toast.success(isActive ? `เปิดใช้งาน "${a.name}" แล้ว` : `ปิดใช้งาน "${a.name}" แล้ว`);
      setDeactivating(null);
      setAssetsRevision((r) => r + 1);
      reloadTree().catch(() => undefined);
    } catch (err) {
      const code = errorCode(err);
      if (code === "VERSION_CONFLICT") {
        const fresh = await getRoomAssets(a.roomId, { includeInactive: true }).catch(() => null);
        const f = fresh?.find((x) => x.id === a.id);
        toast.error(f ? `ข้อมูลนี้ถูกแก้โดย ${f.updatedBy?.name ?? "ผู้ใช้อื่น"} โหลดข้อมูลล่าสุดแล้ว` : GENERIC_ERROR);
        if (fresh) setAssets(fresh);
      } else toast.error(GENERIC_ERROR);
      setDeactivating(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18.75rem_1fr] lg:items-start lg:gap-6">
      {/* navigator (subdued) */}
      <nav aria-label="เลือกห้องจากผัง" className="space-y-4 rounded-xl border border-transparent p-1 lg:sticky lg:top-6">
        <h2 className="text-sm font-semibold">เลือกห้องจากผัง</h2>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span id="nav-building" className="text-[13px] font-medium">อาคาร</span>
            {canRename && (
              <button type="button" onClick={() => setRename({ kind: "building", id: building.id, name: building.name, updatedAt: building.updatedAt })}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-[13px] text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30">
                <Pencil className="size-3.5" aria-hidden />แก้ชื่อ
              </button>
            )}
          </div>
          <Select value={building.id} onValueChange={(id) => select({ building: id })}>
            <SelectTrigger aria-labelledby="nav-building" className="h-11 w-full bg-card data-[size=default]:h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{tree.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span id="nav-floor" className="text-[13px] font-medium">ชั้น</span>
          <div role="group" aria-labelledby="nav-floor" className="flex flex-wrap gap-1.5">
            {building.floors.map((f) => (
              <button key={f.id} type="button" aria-pressed={f.id === floor?.id} onClick={() => select({ floor: f.id })}
                className={cn("min-h-11 min-w-11 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  f.id === floor?.id ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card hover:bg-muted")}>
                ชั้น {f.name}
              </button>
            ))}
          </div>
        </div>
        {floor && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span id="nav-room" className="text-[13px] font-medium">ห้อง / พื้นที่</span>
              <span className="text-xs text-muted-foreground">{floor.rooms.length} ห้อง</span>
            </div>
            <ul aria-labelledby="nav-room" className="space-y-1">
              {floor.rooms.map((r) => (
                <li key={r.id}>
                  <button type="button" aria-pressed={r.id === room?.id} onClick={() => select({ floor: floor.id, room: r.id })}
                    className={cn("flex min-h-11 w-full items-center gap-2.5 rounded-lg border-l-3 px-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                      r.id === room?.id ? "border-primary bg-secondary font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <DoorOpen className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="rounded-md bg-card px-1.5 text-xs tabular-nums" aria-label={`${r.activeAssetCount} ชิ้น`}>{r.activeAssetCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />ชั้นและห้องอ้างอิงจากผังอาคาร
        </p>
      </nav>

      {/* main asset panel */}
      <div>
        <section className={cn(panelClass, "overflow-hidden")} aria-label={room ? room.name : "อุปกรณ์ในห้อง"}>
          {room ? (
            <>
              <div className="flex flex-wrap items-start gap-3 border-b px-4 py-4 lg:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">{building.name}<ChevronRight className="size-3" aria-hidden />ชั้น {floor?.name}</p>
                  <h2 className="mt-1 flex items-center gap-1.5 font-heading text-lg font-semibold">
                    {room.name}
                    {canRename && (
                      <button type="button" aria-label="แก้ไขชื่อห้อง"
                        onClick={() => setRename({ kind: "room", id: room.id, name: room.name, updatedAt: room.updatedAt, context: `${building.name} · ชั้น ${floor?.name}` })}
                        className="grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    )}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">อุปกรณ์ {activeCount} ชิ้น</p>
                </div>
                {canAssets && (
                  <Button className="h-11" onClick={() => setAssetDialog({ mode: "add", roomId: room.id })} disabled={types.length === 0}>
                    <Plus aria-hidden />เพิ่มอุปกรณ์
                  </Button>
                )}
              </div>

              {canAssets && (
                <div className="flex flex-wrap gap-2 border-b px-4 py-3 lg:px-5">
                  <div className="relative min-w-0 flex-1 basis-full sm:basis-60">
                    <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
                    <Input type="search" aria-label="ค้นหาชื่อหรือรหัสอุปกรณ์" placeholder="ค้นหาชื่อหรือรหัสอุปกรณ์" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 pl-10" />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger aria-label="กรองตามประเภท" className="h-11 min-w-40 flex-1 data-[size=default]:h-11 sm:flex-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!canAssets ? null : assetsError ? (
                <div className="space-y-3 p-4">
                  <Alert variant="destructive"><AlertCircle aria-hidden /><AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle><AlertDescription>ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง</AlertDescription></Alert>
                  <Button variant="outline" onClick={() => setAssetsRevision((r) => r + 1)}>ลองอีกครั้ง</Button>
                </div>
              ) : !assets ? (
                <div className="space-y-4 p-5" aria-busy="true" aria-label="กำลังโหลด">
                  {Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-4 w-1/2" /></div>)}
                </div>
              ) : (assets.filter((a) => a.isActive).length === 0 && !showInactive) || (assets.length === 0) ? (
                <div className="p-4">
                  <EmptyState title="ยังไม่มีอุปกรณ์ในห้องนี้" hint="เพิ่มอุปกรณ์ที่ติดตั้งในห้องนี้ เพื่อใช้อ้างอิงตอนแจ้งซ่อม"
                    action={<Button onClick={() => setAssetDialog({ mode: "add", roomId: room.id })} disabled={types.length === 0}>เพิ่มอุปกรณ์ชิ้นแรก</Button>} />
                </div>
              ) : visible.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง" hint="ลองเปลี่ยนคำค้นหาหรือประเภทอุปกรณ์"
                    action={<Button variant="outline" onClick={() => { setQ(""); setTypeFilter("all"); }}>ล้างตัวกรอง</Button>} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium lg:px-5">อุปกรณ์</th>
                      <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell">ประเภท</th>
                      <th scope="col" className="w-14 px-3 py-3"><span className="sr-only">ตัวเลือก</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a) => {
                      return (
                        <tr key={a.id} className={cn("border-t", !a.isActive && "text-muted-foreground")}>
                          <td className="px-4 py-3 lg:px-5">
                            <div className="flex items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" title={a.type.name}>
                                <AssetIcon icon={a.type.icon} className="size-4.5" label={a.type.name} />
                              </span>
                              <span className="min-w-0">
                                <span className={cn("block truncate font-medium", a.isActive && "text-foreground")}>{a.name}</span>
                                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                  {a.code}
                                  {!a.isActive && <span className="rounded-sm bg-muted px-1.5 font-sans">ปิดใช้งาน</span>}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell">{a.type.name}</td>
                          <td className="px-3 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label={`ตัวเลือก ${a.name}`} disabled={busyId === a.id}
                                  className="grid size-11 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30">
                                  <MoreHorizontal className="size-5" aria-hidden />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-44">
                                {a.isActive ? (
                                  <>
                                    <DropdownMenuItem className="min-h-10" onSelect={() => setAssetDialog({ mode: "edit", asset: a })}><Pencil aria-hidden />แก้ไข / ย้ายห้อง</DropdownMenuItem>
                                    <DropdownMenuItem className="min-h-10" variant="destructive" onSelect={() => setDeactivating(a)}><Power aria-hidden />ปิดใช้งาน</DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem className="min-h-10" onSelect={() => setActive(a, true)}><Power aria-hidden />เปิดใช้งาน</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="p-4"><EmptyState title="ยังไม่มีข้อมูลผังอาคาร" hint="อาคาร ชั้น และห้องจะแสดงเมื่อมีการกำหนดผังอาคารแล้ว" /></div>
          )}
        </section>
        {canAssets && room && (
          <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-primary" />
            แสดงอุปกรณ์ที่ปิดใช้งาน
          </label>
        )}
      </div>

      <RenameDialog
        target={rename}
        onOpenChange={(o) => !o && setRename(null)}
        onSaved={() => { setRename(null); reloadTree().catch(() => undefined); }}
        fetchFresh={async (t) => {
          const fresh = await reloadTree();
          if (t.kind === "building") return fresh.find((b) => b.id === t.id) ?? null;
          for (const b of fresh) for (const f of b.floors) for (const r of f.rooms) if (r.id === t.id) return r;
          return null;
        }}
      />
      <AssetDialog
        target={assetDialog}
        tree={tree}
        types={types}
        onOpenChange={(o) => !o && setAssetDialog(null)}
        onSaved={afterAssetSaved}
        onTypeAdded={onTypeAdded}
        fetchFresh={async (a) => (await getRoomAssets(a.roomId, { includeInactive: true })).find((x) => x.id === a.id) ?? null}
      />
      <AlertDialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <AlertDialogContent className={sheetOnMobile}>
          <AlertDialogHeader>
            <AlertDialogTitle>ปิดใช้งาน &quot;{deactivating?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>อุปกรณ์นี้จะไม่แสดงในตัวเลือกใหม่ งานเดิมยังแสดงชื่อนี้ เปิดใช้งานกลับได้ภายหลัง</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>ยกเลิก</AlertDialogCancel>
            <Button variant="destructive" disabled={!!busyId} onClick={() => deactivating && setActive(deactivating, false)}>ปิดใช้งาน</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- tab ประเภทอุปกรณ์ ----

function TypesPanel({ types, onAdd, onEdit }: { types: AssetTypeAdmin[]; onAdd: () => void; onEdit: (t: AssetTypeAdmin) => void }) {
  return (
    <section className={cn(panelClass, "overflow-hidden")} aria-label="ประเภทอุปกรณ์">
      <div className="flex items-start gap-3 border-b px-4 py-4 lg:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">ประเภทอุปกรณ์</h2>
          <p className="text-[13px] text-muted-foreground">ใช้ร่วมกันทุกอาคาร และเลือกได้เมื่อเพิ่มอุปกรณ์</p>
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{types.length} ประเภท</span>
      </div>
      {types.length === 0 ? (
        <div className="p-4">
          <EmptyState title="ยังไม่มีประเภทอุปกรณ์" hint="เพิ่มประเภทอุปกรณ์ เพื่อให้เลือกใช้ตอนเพิ่มอุปกรณ์ในห้อง" action={<Button onClick={onAdd}>เพิ่มประเภทอุปกรณ์</Button>} />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium lg:px-5">ชื่อประเภท</th>
              <th scope="col" className="w-36 px-3 py-3 font-medium">อุปกรณ์ที่ใช้งาน</th>
              <th scope="col" className="w-24 px-3 py-3"><span className="sr-only">แก้ไข</span></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              return (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3 lg:px-5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><AssetIcon icon={t.icon} className="size-4.5" /></span>
                      <span className="min-w-0">
                        <span className="block font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground"><span className="font-mono">{t.codePrefix}</span> · ติดตั้งที่{mountLabel(t.mount)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{t.activeAssetCount} ชิ้น</td>
                  <td className="px-3 py-3 text-right">
                    <Button variant="ghost" className="h-11 text-primary" onClick={() => onEdit(t)} aria-label={`แก้ไข ${t.name}`}>
                      <Pencil aria-hidden />แก้ไข
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
