"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Lock, Search } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getRoles, getUsers } from "../../api";
import { settingsHeading } from "../../nav";
import type { Page, RoleListItem, UserSummary } from "../../types";
import { SettingsForbidden } from "../settings-forbidden";
import { SettingsHeading } from "../settings-heading";
import { errorCode, panelClass } from "../settings-ui";
import { ChangeRoleDialog } from "./change-role-dialog";
import { dateAndTime, FixedRoleNote, Initials, LOCK_COPY } from "./user-bits";
import { UserDetailDialog } from "./user-detail-dialog";
import { useCurrentUser } from "@/components/shared/me-provider";
import { can, PERM } from "@/lib/platform/permissions";

// S25 ผู้ใช้ (F15; spec screens/S25-users.md + CR-001 block; design CR-001-admin-settings.html#users).
// `?q=&role=&page=&user=` live in the URL; search / filter reset the page. CR-006: `users.view` only → read-only;
// a non-Superadmin cannot change a Superadmin.

const PAGE_SIZE = 20;
const ALL = "all";

export function UsersScreen() {
  const me = useCurrentUser();
  const pathname = usePathname();
  const search = useSearchParams();
  const q = search.get("q") ?? "";
  const roleId = search.get("role") ?? "";
  const page = Math.max(1, Number(search.get("page")) || 1);
  const openUser = search.get("user");

  const [text, setText] = useState(q);
  const [roles, setRoles] = useState<RoleListItem[]>();
  const [list, setList] = useState<Page<UserSummary>>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [rolesRevision, setRolesRevision] = useState(0);
  const [changing, setChanging] = useState<UserSummary | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);

  function setParams(next: Record<string, string | null>, push = false) {
    // the current URL, not this render's copy: a debounced search may fire after another filter changed
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const url = `${pathname}${params.size ? `?${params}` : ""}`;
    // Native history updates the URL synchronously and Next syncs useSearchParams with it.
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  // Debounced search (300 ms, ≥ 2 characters or empty).
  useEffect(() => {
    const value = text.trim();
    if (value === q || (value.length === 1)) return;
    const t = window.setTimeout(() => setParams({ q: value || null, page: null }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the current URL
  }, [text]);

  useEffect(() => {
    let active = true;
    getRoles().then((r) => { if (active) setRoles(r); }, (err: unknown) => { if (active) setError(err); });
    return () => { active = false; };
  }, [rolesRevision]);

  useEffect(() => {
    let active = true;
    getUsers({ q: q || undefined, roleId: roleId || undefined, page, pageSize: PAGE_SIZE }).then(
      (res) => { if (active) { setList(res); setError(undefined); } },
      (err: unknown) => { if (active) setError(err); },
    );
    return () => { active = false; };
  }, [q, roleId, page, revision]);

  const heading = settingsHeading("users");
  const lock = (u: UserSummary): RoleLock =>
    u.roleLockedByEnv ? "env"
      : u.id === me.id ? "self"
      : !can(me, PERM.settingsUsers) ? "readOnly"
      : me.role !== "super_admin" && u.role.key === "super_admin" ? "superAdmin"
      : null;
  const filterRole = roles?.find((r) => r.id === roleId);

  if (error !== undefined) {
    return (
      <>
        <SettingsHeading {...heading} />
        <section className={panelClass}>
          {errorCode(error) === "FORBIDDEN" ? (
            <SettingsForbidden />
          ) : (
            <ErrorState hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่" onRetry={() => { setError(undefined); setRevision((r) => r + 1); setRolesRevision((r) => r + 1); }} />
          )}
        </section>
      </>
    );
  }

  const total = list?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const memberTotal = roles?.reduce((n, r) => n + r.userCount, 0);

  function onChanged(u: UserSummary) {
    setChanging(null);
    setList((l) => l && { ...l, items: l.items.map((x) => (x.id === u.id ? u : x)) });
    setDetailRevision((r) => r + 1);
    setRolesRevision((r) => r + 1);
  }

  return (
    <>
      <SettingsHeading {...heading} />

      <section className={cn(panelClass, "overflow-hidden")} aria-label="สมาชิกในระบบ">
        <div className="flex items-center gap-2 border-b px-4 py-4 lg:px-5">
          <h2 className="font-heading text-base font-semibold">สมาชิกในระบบ</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {memberTotal === undefined ? "–" : `${memberTotal.toLocaleString("th-TH")} คน`}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{roles ? `${roles.length} Role` : ""}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:gap-3 lg:px-5">
          <div className="relative min-w-0 basis-full lg:basis-90">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="ค้นหาชื่อ รหัสพนักงาน หรืออีเมล"
              placeholder="ค้นหาชื่อ รหัสพนักงาน หรืออีเมล"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              className="h-11 pl-10"
            />
          </div>
          <Select value={roleId || ALL} onValueChange={(v) => setParams({ role: v === ALL ? null : v, page: null })}>
            <SelectTrigger aria-label="กรองตาม Role" className="h-11 min-w-44 data-[size=default]:h-11">
              <SelectValue>{filterRole ? `Role: ${filterRole.name}` : "Role: ทั้งหมด"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Role: ทั้งหมด</SelectItem>
              {roles?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} · {r.userCount.toLocaleString("th-TH")} คน
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">{list ? `พบ ${total.toLocaleString("th-TH")} คน` : ""}</p>
        </div>

        {!list || !roles ? (
          <div aria-busy="true" aria-label="กำลังโหลด">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b px-5 py-4 last:border-0">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                <Skeleton className="hidden h-4 w-24 lg:block" />
              </div>
            ))}
          </div>
        ) : list.items.length === 0 ? (
          <div className="p-4">
            {q ? (
              <EmptyState title={`ไม่พบผู้ใช้ที่ตรงกับ "${q}"`} hint="ผู้ใช้ต้องเข้าสู่ระบบ BAMBAM ด้วย SSO อย่างน้อย 1 ครั้งก่อน"
                action={<Button variant="outline" onClick={() => { setText(""); setParams({ q: null, page: null }); }}>ล้างการค้นหา</Button>} />
            ) : roleId ? (
              <EmptyState title={`ไม่มีผู้ใช้ใน Role "${filterRole?.name ?? ""}"`}
                action={<Button variant="outline" onClick={() => setParams({ role: null, page: null })}>ล้างตัวกรอง</Button>} />
            ) : (
              <EmptyState title="ยังไม่มีผู้ใช้" hint="ผู้ใช้ต้องเข้าสู่ระบบ BAMBAM ด้วย SSO อย่างน้อย 1 ครั้งก่อน" />
            )}
          </div>
        ) : (
          <>
            <table className="hidden w-full text-sm lg:table">
              <thead>
                <tr className="bg-muted/50 text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-medium">ผู้ใช้</th>
                  <th scope="col" className="px-3 py-3 font-medium">แผนก / ตำแหน่ง</th>
                  <th scope="col" className="px-3 py-3 font-medium">Role</th>
                  <th scope="col" className="px-3 py-3 font-medium">เข้าใช้ล่าสุด</th>
                  <th scope="col" className="w-16 px-3 py-3"><span className="sr-only">ดูข้อมูล</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-5 py-3"><Person u={u} self={u.id === me.id} /></td>
                    <td className="px-3 py-3">
                      <span className="block">{u.department ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{u.position ?? ""}</span>
                    </td>
                    <td className="px-3 py-3"><RoleControl u={u} lock={lock(u)} onChange={() => setChanging(u)} /></td>
                    <td className="px-3 py-3 tabular-nums"><LastLogin iso={u.lastLoginAt} /></td>
                    <td className="px-3 py-3 text-right"><OpenButton u={u} onOpen={() => setParams({ user: u.id }, true)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y lg:hidden">
              {list.items.map((u) => (
                <li key={u.id} className="flex items-start gap-2 py-3.5 pr-2 pl-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Person u={u} self={u.id === me.id} />
                    <div className="pl-13"><RoleControl u={u} lock={lock(u)} onChange={() => setChanging(u)} /></div>
                    <p className="pl-13 text-xs text-muted-foreground">
                      เข้าใช้ล่าสุด {dateAndTime(u.lastLoginAt)?.join(" ") ?? "—"}
                    </p>
                  </div>
                  <OpenButton u={u} onOpen={() => setParams({ user: u.id }, true)} />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 lg:px-5">
              <p className="flex-1 text-[13px] text-muted-foreground">แสดง {first}–{last} จาก {total.toLocaleString("th-TH")} คน</p>
              {pages > 1 && (
                <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-1.5">
                  <PageButton label="หน้าก่อน" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, true)}><ChevronLeft className="size-4" aria-hidden /></PageButton>
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((n) => pages <= 7 || n === 1 || n === pages || Math.abs(n - page) <= 1)
                    .map((n) => (
                      <PageButton key={n} label={`หน้า ${n}`} current={n === page} onClick={() => setParams({ page: n === 1 ? null : String(n) }, true)}>{n}</PageButton>
                    ))}
                  <PageButton label="หน้าถัดไป" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) }, true)}><ChevronRight className="size-4" aria-hidden /></PageButton>
                </nav>
              )}
            </div>
          </>
        )}
      </section>

      <p className="mt-3 flex gap-2 text-[13px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        ชื่อ อีเมล และข้อมูลพนักงานมาจาก SSO · การเปลี่ยน Role ต้องยืนยันก่อนบันทึก
      </p>

      <UserDetailDialog
        userId={openUser}
        revision={detailRevision}
        onOpenChange={(o) => !o && setParams({ user: null })}
        onChangeRole={(d) => setChanging(d)}
      />
      <ChangeRoleDialog
        user={changing}
        roles={roles ?? []}
        onOpenChange={(o) => !o && setChanging(null)}
        onChanged={onChanged}
        onRolesStale={() => setRolesRevision((r) => r + 1)}
      />
    </>
  );
}

function Person({ u, self }: { u: UserSummary; self: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Initials name={u.name} />
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {u.name}
          {self && <span className="ml-1 text-xs font-normal text-muted-foreground">(คุณ)</span>}
        </p>
        {u.email && <p className="truncate text-[13px] text-muted-foreground">{u.email}</p>}
        <p className="font-mono text-xs text-muted-foreground">{u.employeeCode}</p>
      </div>
    </div>
  );
}

type RoleLock = "env" | "self" | "readOnly" | "superAdmin" | null;

/** Contextual role control: opens the change dialog; locked cases show plain text (with the reason as title). */
function RoleControl({ u, lock, onChange }: { u: UserSummary; lock: RoleLock; onChange: () => void }) {
  if (lock === "env") {
    return (
      <span className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1.5 font-medium">{u.role.name}<Lock className="size-3.5 text-muted-foreground" aria-hidden /></span>
        <FixedRoleNote />
      </span>
    );
  }
  if (lock === "self") {
    return <span className="font-medium text-muted-foreground" title={LOCK_COPY.SELF}>{u.role.name}</span>;
  }
  if (lock === "readOnly") return <span className="font-medium">{u.role.name}</span>;
  if (lock === "superAdmin") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium" title={LOCK_COPY.SUPER_ADMIN}>
        {u.role.name}
        <Lock className="size-3.5 text-muted-foreground" aria-label={LOCK_COPY.SUPER_ADMIN} />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={`เปลี่ยน Role ของ ${u.name} (ตอนนี้ ${u.role.name})`}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium text-primary outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      {u.role.name}
      <ChevronDown className="size-3.5" aria-hidden />
    </button>
  );
}

function LastLogin({ iso }: { iso: string | null }) {
  const parts = dateAndTime(iso);
  if (!parts) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="block leading-tight">
      <span className="block">{parts[0]}</span>
      <span className="block text-muted-foreground">{parts[1]}</span>
    </span>
  );
}

function OpenButton({ u, onOpen }: { u: UserSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`ดูข้อมูล ${u.name}`}
      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <ChevronRight className="size-5" aria-hidden />
    </button>
  );
}

function PageButton({ label, current, disabled, onClick, children }: { label: string; current?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-11 place-items-center rounded-lg border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40",
        current ? "border-primary/40 bg-secondary font-semibold text-primary" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
