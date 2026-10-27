"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Box, Building2, ChevronLeft, ChevronRight, DoorOpen, HardHat, Layers, ListChecks, Search, Shapes, ShieldCheck, Tags, Users,
  type LucideIcon,
} from "lucide-react";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { useIsDesktop } from "@/components/shared/use-media-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAuditActors, getAuditEntries } from "../../api";
import { settingsHeading } from "../../nav";
import type { AuditEntityType, AuditEntry, AuditQuery, PersonRef } from "../../types";
import { SettingsHeading } from "../settings-heading";
import { errorCode, panelClass } from "../settings-ui";

// S26 ประวัติการเปลี่ยนแปลง (F30; spec screens/S26-audit-log.md + CR-001 block): read-only, filters in the URL
// (`?type=&actor=&range=&q=&page=`), 50 per page; phones group by day and load more.

const PAGE_SIZE = 50;
const RANGES = [
  { value: "7", label: "7 วัน" },
  { value: "30", label: "30 วัน" },
  { value: "90", label: "90 วัน" },
  { value: "all", label: "ทั้งหมด" },
];
const DEFAULT_RANGE = "30";
const TYPES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "master", label: "Master" },
  { value: "permissions", label: "สิทธิ์" },
  { value: "users", label: "ผู้ใช้" },
];

export const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  create: "เพิ่ม", update: "แก้ไข", deactivate: "ปิดใช้งาน", activate: "เปิดใช้งาน", delete: "ลบ", role_change: "เปลี่ยน Role",
  permissions_change: "เปลี่ยนสิทธิ์", floor_plan_upload: "อัปโหลดผังชั้น", floor_plan_delete: "ลบผังชั้น", reorder: "เรียงลำดับ",
};

const ENTITY: Record<AuditEntityType, { label: string; icon: LucideIcon }> = {
  building: { label: "อาคาร", icon: Building2 },
  floor: { label: "ชั้น", icon: Layers },
  room: { label: "ห้อง / โซน", icon: DoorOpen },
  category: { label: "หมวดงาน", icon: Tags },
  symptom: { label: "อาการ", icon: ListChecks },
  contractor_type: { label: "ประเภทผู้รับเหมา", icon: HardHat },
  role: { label: "Role", icon: ShieldCheck },
  user: { label: "ผู้ใช้", icon: Users },
  asset: { label: "อุปกรณ์", icon: Box },
  asset_type: { label: "ประเภทอุปกรณ์", icon: Shapes },
};

const FIELD_LABEL: Record<string, string> = {
  name: "ชื่อ", icon: "ไอคอน", description: "คำอธิบาย", sortOrder: "ลำดับ", code: "รหัส", room: "ห้อง", codePrefix: "รหัสนำหน้า",
  mount: "ตำแหน่งติดตั้ง", assetType: "ประเภท", priority: "ความเร่งด่วน", defaultPriority: "ความเร่งด่วนเริ่มต้น", areaTypes: "ประเภทพื้นที่",
};

/** Where "รายการ" links while the item exists (S26 Interactions). */
function entityHref(e: AuditEntry): string | null {
  if (!e.exists) return null;
  switch (e.entityType) {
    case "building":
    case "room":
    case "asset":
      return "/settings/buildings";
    case "asset_type":
      return "/settings/buildings?tab=asset-types";
    case "category":
      return `/settings/categories/${e.entityId}`;
    case "contractor_type":
      return "/settings/contractor-types";
    case "role":
      return "/settings/roles?tab=roles";
    case "user":
      return `/settings/users?user=${e.entityId}`;
  }
  return null;
}

/** One-line details by action (S26 "Detail text by action"); several lines for an update of several fields. */
function details(e: AuditEntry): string[] {
  switch (e.action) {
    case "create":
      return [`เพิ่ม "${e.entityName}"${e.parentName && ["floor", "room", "symptom"].includes(e.entityType) ? ` ใน ${e.parentName}` : ""}`];
    case "update":
      return e.changes.map((c) => `${FIELD_LABEL[c.field] ?? c.field}: ${c.before ?? "—"} → ${c.after ?? "—"}`);
    case "reorder":
      return [`เรียงลำดับ${ENTITY[e.entityType].label}${e.parentName ? `ใน ${e.parentName}` : ""}ใหม่`];
    case "role_change":
      return e.changes.filter((c) => c.field === "role").map((c) => `${c.before ?? "—"} → ${c.after ?? "—"}`);
    case "permissions_change":
      return e.changes.map((c) => [c.added?.length ? `เพิ่ม: ${c.added.join(", ")}` : "", c.removed?.length ? `ถอด: ${c.removed.join(", ")}` : ""].filter(Boolean).join(" · "));
    case "floor_plan_upload":
    case "floor_plan_delete":
      return e.changes.map((c) => c.after ?? "").filter(Boolean);
  }
  return ["—"];
}

function rangeFrom(range: string): string | undefined {
  if (range === "all") return undefined;
  const d = new Date();
  d.setDate(d.getDate() - Number(range));
  return d.toISOString();
}

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** วันนี้ · เมื่อวาน · {วันที่} for the phone day groups. */
function dayLabel(iso: string): string {
  const day = bangkokDay.format(new Date(iso));
  const today = bangkokDay.format(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === today) return "วันนี้";
  if (day === bangkokDay.format(y)) return "เมื่อวาน";
  return formatDateTime(iso).split(" ").slice(0, 3).join(" ");
}

export function AuditScreen() {
  const pathname = usePathname();
  const search = useSearchParams();
  const desktop = useIsDesktop();
  const type = search.get("type") ?? "all";
  const actor = search.get("actor") ?? "";
  const range = search.get("range") ?? DEFAULT_RANGE;
  const q = search.get("q") ?? "";
  const page = Math.max(1, Number(search.get("page")) || 1);

  const [text, setText] = useState(q);
  const [actors, setActors] = useState<PersonRef[]>([]);
  const [items, setItems] = useState<AuditEntry[]>();
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [more, setMore] = useState<{ page: number; busy: boolean; failed: boolean }>({ page: 1, busy: false, failed: false });

  const filters: AuditQuery = useMemo(() => ({
    type: type === "all" ? undefined : (type as AuditQuery["type"]),
    actorId: actor || undefined,
    from: rangeFrom(range),
    q: q || undefined,
    pageSize: PAGE_SIZE,
  }), [type, actor, range, q]);

  function setParams(next: Record<string, string | null>) {
    // the current URL, not this render's copy: a debounced search may fire after another filter changed
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    // Native history updates the URL synchronously and Next syncs useSearchParams with it.
    window.history.replaceState(null, "", `${pathname}${params.size ? `?${params}` : ""}`);
  }

  useEffect(() => {
    const value = text.trim();
    if (value === q) return;
    const t = window.setTimeout(() => setParams({ q: value || null, page: null }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the current URL
  }, [text]);

  useEffect(() => {
    getAuditActors().then(setActors, () => setActors([]));
  }, []);

  useEffect(() => {
    let active = true;
    getAuditEntries({ ...filters, page }).then(
      (res) => { if (active) { setItems(res.items); setTotal(res.meta.total); setError(undefined); setMore({ page, busy: false, failed: false }); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [filters, page, revision]);

  async function loadMore() {
    setMore((m) => ({ ...m, busy: true, failed: false }));
    try {
      const res = await getAuditEntries({ ...filters, page: more.page + 1 });
      setItems((old) => [...(old ?? []), ...res.items]);
      setTotal(res.meta.total);
      setMore({ page: more.page + 1, busy: false, failed: false });
    } catch {
      setMore((m) => ({ ...m, busy: false, failed: true }));
    }
  }

  const heading = settingsHeading("audit");
  const filtered = type !== "all" || !!actor || range !== DEFAULT_RANGE || !!q;
  const clear = () => { setText(""); window.history.replaceState(null, "", pathname); };
  const actorName = actors.find((a) => a.id === actor)?.name;

  if (error !== undefined) {
    return (
      <>
        <SettingsHeading {...heading} />
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

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <SettingsHeading {...heading} />
      <section className={cn(panelClass, "overflow-hidden")} aria-label="ประวัติการเปลี่ยนแปลง">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:gap-3 lg:px-5">
          <SegmentedControl label="ประเภทรายการ" value={type} onValueChange={(v) => setParams({ type: v === "all" ? null : v, page: null })} options={TYPES} className="basis-full lg:basis-auto" />
          <Select value={actor || "all"} onValueChange={(v) => setParams({ actor: v === "all" ? null : v, page: null })}>
            <SelectTrigger aria-label="กรองตามผู้ทำ" className="h-11 min-w-40 flex-1 data-[size=default]:h-11 sm:flex-none">
              <SelectValue>{actorName ? `ผู้ทำ: ${actorName}` : "ผู้ทำ: ทุกคน"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ผู้ทำ: ทุกคน</SelectItem>
              {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setParams({ range: v === DEFAULT_RANGE ? null : v, page: null })}>
            <SelectTrigger aria-label="ช่วงวันที่" className="h-11 min-w-40 flex-1 data-[size=default]:h-11 sm:flex-none">
              <SelectValue>{`ช่วงวันที่: ${RANGES.find((r) => r.value === range)?.label ?? "30 วัน"}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-0 flex-1 basis-full sm:basis-60">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="ค้นหาชื่อรายการ" placeholder="ค้นหาชื่อรายการ" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className="h-11 pl-10" />
          </div>
          {filtered && <Button variant="ghost" className="h-11" onClick={clear}>ล้างตัวกรอง</Button>}
        </div>

        {!items ? (
          <div aria-busy="true" aria-label="กำลังโหลด">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
                <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            {filtered ? (
              <EmptyState title="ไม่พบรายการตามตัวกรอง" action={<Button variant="outline" onClick={clear}>ล้างตัวกรอง</Button>} />
            ) : (
              <EmptyState title="ยังไม่มีการเปลี่ยนแปลง" hint="การเพิ่ม แก้ไข และเปลี่ยนสิทธิ์จะแสดงที่นี่" />
            )}
          </div>
        ) : desktop ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="w-44 px-5 py-3 font-medium">เวลา</th>
                  <th scope="col" className="w-44 px-3 py-3 font-medium">ผู้ทำ</th>
                  <th scope="col" className="w-32 px-3 py-3 font-medium">การกระทำ</th>
                  <th scope="col" className="px-3 py-3 font-medium">รายการ</th>
                  <th scope="col" className="px-3 py-3 font-medium">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-t align-top">
                    <td className="px-5 py-3.5 tabular-nums">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-3.5">{e.actor?.name ?? "—"}</td>
                    <td className="px-3 py-3.5"><Badge variant="secondary" className="bg-muted text-foreground">{ACTION_LABEL[e.action]}</Badge></td>
                    <td className="px-3 py-3.5"><EntityCell e={e} /></td>
                    <td className="px-3 py-3.5">{details(e).map((line, i) => <p key={i}>{line}</p>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="flex items-center gap-3 border-t px-5 py-3">
                <p className="flex-1 text-[13px] text-muted-foreground">หน้า {page} / {pages} · {total.toLocaleString("th-TH")} รายการ</p>
                <Button variant="outline" size="icon" className="size-11" aria-label="หน้าก่อน" disabled={page <= 1} onClick={() => setParams({ page: page - 1 === 1 ? null : String(page - 1) })}><ChevronLeft aria-hidden /></Button>
                <Button variant="outline" size="icon" className="size-11" aria-label="หน้าถัดไป" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })}><ChevronRight aria-hidden /></Button>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-3">
            {groupByDay(items).map(([label, rows]) => (
              <section key={label} className="mb-4" aria-label={label}>
                <h3 className="mb-2 text-sm font-semibold">{label}</h3>
                <ul className="divide-y rounded-xl border">
                  {rows.map((e) => (
                    <li key={e.id} className="flex gap-3 px-3.5 py-3">
                      <EntityIcon type={e.entityType} />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold">{ACTION_LABEL[e.action]} · <EntityName e={e} /></p>
                        {details(e).map((line, i) => <p key={i} className="mt-0.5">{line}</p>)}
                        <p className="mt-1 text-xs text-muted-foreground">{e.actor?.name ?? "—"} · {formatDateTime(e.createdAt).split(" ").pop()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {more.failed && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle aria-hidden />
                <AlertDescription>โหลดเพิ่มไม่สำเร็จ ลองอีกครั้ง</AlertDescription>
              </Alert>
            )}
            {items.length < total && (
              <Button variant="outline" className="h-11 w-full" disabled={more.busy} onClick={loadMore}>{more.failed ? "ลองอีกครั้ง" : "โหลดเพิ่ม"}</Button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function groupByDay(items: AuditEntry[]): [string, AuditEntry[]][] {
  const groups = new Map<string, AuditEntry[]>();
  for (const e of items) {
    const k = dayLabel(e.createdAt);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()];
}

function EntityIcon({ type }: { type: AuditEntityType }) {
  const Icon = ENTITY[type]?.icon ?? Box;
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function EntityName({ e }: { e: AuditEntry }) {
  const href = entityHref(e);
  return href ? (
    <Link href={href} className="font-medium text-primary underline-offset-2 hover:underline">{e.entityName}</Link>
  ) : (
    <span className="font-medium">{e.entityName}</span>
  );
}

function EntityCell({ e }: { e: AuditEntry }) {
  return (
    <div className="flex items-start gap-2.5">
      <EntityIcon type={e.entityType} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{ENTITY[e.entityType]?.label ?? e.entityType}{e.parentName ? ` · ${e.parentName}` : ""}</p>
        <EntityName e={e} />
      </div>
    </div>
  );
}
