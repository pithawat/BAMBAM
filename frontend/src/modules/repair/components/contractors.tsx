"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronRight, HardHat, Loader2, Pencil, Phone, Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/shared/states";
import { useCurrentUser } from "@/components/shared/me-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createContractor, createContractorType, getContractor, getContractorJobs, getContractors, getContractorTypes, updateContractor } from "../api";
import { contractorFieldMessages, errorCode, errorMessage, fieldErrors } from "../errors";
import type { Contractor, ContractorJob, Ref } from "../types";
import { Stars } from "./ticket-ui";
import { ticketHref } from "./ticket-presentation";

// S18 ช่างภายนอก (F24, CR-005): the technician adds / edits contractors and their types;
// technician, admin and executive see job history and scores.

const STAFF = ["technician", "admin", "executive"];

function Score({ c }: { c: Pick<Contractor, "avgRating" | "ratedCount"> }) {
  if (c.avgRating === null) return <span className="text-xs text-muted-foreground">ยังไม่มีคะแนน</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm"><Stars value={Math.round(c.avgRating)} label={false} /><span className="font-semibold">{c.avgRating.toFixed(1)}</span><span className="text-xs text-muted-foreground">({c.ratedCount} งาน)</span></span>;
}

export function ContractorsScreen() {
  const me = useCurrentUser();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [inactive, setInactive] = useState(false);
  const [list, setList] = useState<{ items: Contractor[]; total: number }>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setQuery(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => {
    if (!STAFF.includes(me.role)) return;
    let active = true;
    getContractors({ q: query || undefined, includeInactive: inactive, pageSize: 100 }).then(
      (page) => { if (active) { setList({ items: page.items, total: page.meta.total }); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [query, inactive, revision, me.role]);
  if (!STAFF.includes(me.role)) return <><PageHeader title="ช่างภายนอก" variant="bar" /><ForbiddenState /></>;
  const canEdit = me.role === "technician";
  return <>
    <PageHeader title="ช่างภายนอก" variant="service" service="repair" subtitle="ประวัติงานและคะแนนของช่างนอกระบบ"
      action={canEdit ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus aria-hidden />เพิ่มช่างภายนอก</Button> : undefined} />
    <div className="space-y-3 px-4 py-4 lg:px-0 lg:py-0">
      <Card className="gap-3 p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input aria-label="ค้นหาชื่อร้าน หรือผู้ติดต่อ" placeholder="ค้นหาชื่อร้าน หรือผู้ติดต่อ" value={q} onChange={(e) => setQ(e.target.value)} maxLength={50} className="h-11 rounded-full pl-10" /></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} className="size-4 accent-primary" />แสดงที่ปิดใช้งาน</label>
      </Card>
      {error !== undefined ? (errorCode(error) === "FORBIDDEN" ? <ForbiddenState /> : <ErrorState variant="inline" title="โหลดรายชื่อช่างภายนอกไม่สำเร็จ" onRetry={() => setRevision((r) => r + 1)} />)
        : !list ? <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลด">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
        : list.items.length === 0 ? <EmptyState title={query ? `ไม่พบช่างภายนอกที่ตรงกับ "${query}"` : "ยังไม่มีช่างภายนอก"} hint={canEdit && !query ? "เพิ่มช่างภายนอกได้จากปุ่มด้านบน หรือตอนบันทึกผลซ่อม" : undefined} />
        : <Card className="gap-0 divide-y py-0 shadow-card">{list.items.map((c) => <Link key={c.id} href={`/repair/contractors/${c.id}`} className="flex items-start gap-3 px-3.5 py-3.5 outline-none hover:bg-muted/50 focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary"><HardHat className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1 space-y-1"><span className="flex items-center gap-2"><span className="truncate font-semibold">{c.name}</span>{!c.isActive && <Badge variant="secondary">ปิดใช้งาน</Badge>}</span>
            <span className="flex flex-wrap gap-1">{c.types.map((t) => <Badge key={t.id} variant="outline">{t.name}</Badge>)}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Score c={c} /><span className="text-xs text-muted-foreground">{c.jobCount} งาน</span>{c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}</span></span>
          <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>)}</Card>}
    </div>
    {canEdit && <ContractorFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={() => { setFormOpen(false); setRevision((r) => r + 1); toast.success("เพิ่มช่างภายนอกแล้ว"); }} />}
  </>;
}

export function ContractorDetailScreen({ id }: { id: string }) {
  const me = useCurrentUser();
  const [contractor, setContractor] = useState<Contractor>();
  const [jobs, setJobs] = useState<{ items: ContractorJob[]; total: number }>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!STAFF.includes(me.role)) return;
    let active = true;
    Promise.all([getContractor(id), getContractorJobs(id, 1, 20)]).then(([c, j]) => {
      if (active) { setContractor(c); setJobs({ items: j.items, total: j.meta.total }); setPage(1); setError(undefined); }
    }, (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [id, revision, me.role]);
  async function more() {
    setMoreBusy(true);
    try { const next = await getContractorJobs(id, page + 1, 20); setPage(page + 1); setJobs((old) => ({ items: [...(old?.items ?? []), ...next.items], total: next.meta.total })); }
    catch { toast.error("โหลดเพิ่มไม่สำเร็จ ลองอีกครั้ง"); }
    finally { setMoreBusy(false); }
  }
  const header = <PageHeader title="ช่างภายนอก" variant="bar" backHref="/repair/contractors" />;
  if (!STAFF.includes(me.role)) return <>{header}<ForbiddenState /></>;
  if (error !== undefined) {
    return <>{header}{errorCode(error) === "CONTRACTOR_NOT_FOUND" ? <ForbiddenState title="ไม่พบช่างภายนอกนี้" /> : errorCode(error) === "FORBIDDEN" ? <ForbiddenState /> : <ErrorState onRetry={() => setRevision((r) => r + 1)} />}</>;
  }
  if (!contractor || !jobs) return <>{header}<div className="space-y-3 px-4 py-4 lg:px-0"><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-60 w-full rounded-xl" /></div></>;
  const canEdit = me.role === "technician";
  return <>{header}
    <div className="space-y-3 px-4 py-4 lg:px-0 lg:py-0">
      <Card className="gap-3 p-4 shadow-card lg:p-5">
        <div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-primary"><HardHat className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">{contractor.name}{!contractor.isActive && <Badge variant="secondary">ปิดใช้งาน</Badge>}</h2>
            <div className="mt-1 flex flex-wrap gap-1">{contractor.types.map((t) => <Badge key={t.id} variant="outline">{t.name}</Badge>)}</div></div>
          {canEdit && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil aria-hidden />แก้ไข</Button>}</div>
        <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">คะแนนเฉลี่ย</p><Score c={contractor} /></div>
          <div><p className="text-xs text-muted-foreground">จำนวนงาน</p><p className="font-heading text-lg font-semibold">{contractor.jobCount}</p></div>
          <div className="space-y-1 text-sm">{contractor.contactName && <p className="flex items-center gap-1.5"><UserRound className="size-4 text-muted-foreground" aria-hidden />{contractor.contactName}</p>}
            {contractor.phone && <p className="flex items-center gap-1.5"><Phone className="size-4 text-muted-foreground" aria-hidden /><a href={`tel:${contractor.phone}`} className="underline-offset-2 hover:underline">{contractor.phone}</a></p>}</div>
        </div>
        {contractor.note && <p className="whitespace-pre-wrap rounded-sm bg-muted/60 p-3 text-sm">{contractor.note}</p>}
      </Card>
      <Card className="gap-0 p-0 shadow-card"><h2 className="px-4 pt-4 pb-2 font-heading text-base font-semibold">ประวัติงาน ({jobs.total})</h2>
        {jobs.items.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">ยังไม่มีงานที่ช่างเจ้านี้ทำ</p>
          : <ul className="divide-y">{jobs.items.map((j) => <li key={j.ticketId}><Link href={ticketHref(j.ticketId)} className="flex items-start gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className="min-w-0 flex-1 space-y-1"><span className="block text-sm font-semibold">{j.ticketNo} · {j.category.name}</span>
              <span className="block text-xs text-muted-foreground">{j.resolvedAt ? `เสร็จเมื่อ ${formatDateTime(j.resolvedAt)}` : "ยังไม่เสร็จ"}</span>
              {j.contractorRating ? <Stars value={j.contractorRating} /> : <span className="text-xs text-muted-foreground">ไม่มีคะแนน</span>}
              {j.contractorRatingComment && <span className="block whitespace-pre-wrap text-sm">{j.contractorRatingComment}</span>}
              {j.reporterRating && <span className="block text-xs text-muted-foreground">ผู้แจ้งให้ {j.reporterRating} ดาว</span>}</span>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden /></Link></li>)}</ul>}
        {jobs.items.length < jobs.total && <div className="p-3"><Button variant="outline" className="w-full" disabled={moreBusy} onClick={more}>{moreBusy && <Loader2 className="animate-spin" aria-hidden />}โหลดเพิ่ม</Button></div>}
      </Card>
    </div>
    {canEdit && <ContractorFormDialog contractor={contractor} open={editing} onOpenChange={setEditing} onSaved={(c) => { setEditing(false); setContractor(c); toast.success("บันทึกแล้ว"); }} />}
  </>;
}

// ---- add / edit (technician) ----

export function ContractorFormDialog({ contractor, open, onOpenChange, onSaved }: {
  contractor?: Contractor; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (c: Contractor) => void;
}) {
  const [types, setTypes] = useState<Ref[]>();
  const [values, setValues] = useState({ name: "", contactName: "", phone: "", note: "", typeIds: [] as string[], isActive: true });
  const [newType, setNewType] = useState("");
  const [addingType, setAddingType] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    getContractorTypes().then(setTypes, () => setTypes([]));
  }, [open]);
  function reset() {
    setValues(contractor
      ? { name: contractor.name, contactName: contractor.contactName ?? "", phone: contractor.phone ?? "", note: contractor.note ?? "", typeIds: contractor.types.map((t) => t.id), isActive: contractor.isActive }
      : { name: "", contactName: "", phone: "", note: "", typeIds: [], isActive: true });
    setNewType(""); setErrors({});
  }
  const toggle = (id: string) => setValues((v) => ({ ...v, typeIds: v.typeIds.includes(id) ? v.typeIds.filter((x) => x !== id) : [...v.typeIds, id] }));
  async function addType() {
    const name = newType.trim();
    if (!name) return;
    setAddingType(true);
    try {
      const t = await createContractorType(name);
      setTypes((old) => old?.some((x) => x.id === t.id) ? old : [...(old ?? []), t].sort((a, b) => a.name.localeCompare(b.name, "th")));
      setValues((v) => ({ ...v, typeIds: v.typeIds.includes(t.id) ? v.typeIds : [...v.typeIds, t.id] }));
      setNewType(""); setErrors((e) => { const n = { ...e }; delete n.typeIds; return n; });
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setAddingType(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!values.name.trim()) local.name = "กรุณากรอกชื่อร้าน / บริษัท";
    if (values.typeIds.length === 0) local.typeIds = "เลือกประเภทอย่างน้อย 1 ประเภท";
    if (Object.keys(local).length) { setErrors(local); return; }
    setBusy(true); setErrors({});
    const req = { name: values.name.trim(), typeIds: values.typeIds, contactName: values.contactName.trim(), phone: values.phone.trim(), note: values.note.trim(), isActive: values.isActive };
    try { onSaved(contractor ? await updateContractor(contractor.id, req) : await createContractor(req)); }
    catch (err) {
      const fields = fieldErrors(err, contractorFieldMessages);
      if (Object.keys(fields).length) setErrors(fields); else toast.error(errorMessage(err));
    } finally { setBusy(false); }
  }
  const field = (name: "name" | "contactName" | "phone", label: string, opts: { required?: boolean; max: number; type?: string; placeholder?: string }) =>
    <div className="space-y-1.5"><label htmlFor={`contractor-${name}`} className="text-sm font-medium">{label}{opts.required && <span className="text-destructive">*</span>}</label>
      <Input id={`contractor-${name}`} type={opts.type} value={values[name]} maxLength={opts.max} placeholder={opts.placeholder} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} aria-invalid={!!errors[name]} className="h-11" />
      {errors[name] && <p role="alert" className="flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{errors[name]}</p>}</div>;
  return <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={submit} noValidate className="space-y-4">
        <DialogHeader><DialogTitle>{contractor ? "แก้ไขช่างภายนอก" : "เพิ่มช่างภายนอก"}</DialogTitle><DialogDescription>ข้อมูลนี้เห็นเฉพาะช่าง Admin และผู้บริหาร</DialogDescription></DialogHeader>
        {field("name", "ชื่อร้าน / บริษัท", { required: true, max: 100, placeholder: "เช่น ร้านแอร์เย็นฉ่ำ" })}
        <fieldset className="space-y-2"><legend className="text-sm font-medium">ประเภท<span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">เลือกได้หลายประเภท</span></legend>
          {!types ? <Skeleton className="h-10 w-full" /> : <div className="flex flex-wrap gap-2">{types.map((t) => {
            const on = values.typeIds.includes(t.id);
            return <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)} className={cn("inline-flex min-h-10 items-center gap-1 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-foreground bg-foreground text-white" : "border-input bg-card")}>{on && <Check className="size-4" aria-hidden />}{t.name}</button>;
          })}{types.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีประเภท เพิ่มด้านล่างได้เลย</p>}</div>}
          <div className="flex gap-2"><Input aria-label="เพิ่มประเภทใหม่" placeholder="เพิ่มประเภทใหม่ เช่น แอร์" value={newType} maxLength={50} onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addType(); } }} className="h-10" />
            <Button type="button" variant="outline" onClick={addType} disabled={addingType || !newType.trim()}>{addingType ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}เพิ่ม</Button></div>
          {errors.typeIds && <p role="alert" className="flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{errors.typeIds}</p>}
        </fieldset>
        {field("contactName", "ผู้ติดต่อ", { max: 100 })}
        {field("phone", "เบอร์โทร", { max: 30, type: "tel" })}
        <div className="space-y-1.5"><label htmlFor="contractor-note" className="text-sm font-medium">หมายเหตุ</label>
          <Textarea id="contractor-note" value={values.note} maxLength={500} rows={3} onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))} /></div>
        {contractor && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={values.isActive} onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))} className="size-4 accent-primary" />ใช้งานอยู่ (ปิดไว้เมื่อเลิกจ้าง ประวัติยังอยู่)</label>}
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}บันทึก</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
