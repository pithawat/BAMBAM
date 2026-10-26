"use client";

import { EmptyState } from "@/components/shared/states";
import { settingsHeading, type SettingsPage } from "../nav";
import { SettingsHeading } from "./settings-heading";

/** Temporary page for a section whose stage is not built yet (settings Stage 1): heading + one panel, no data calls. */
export function SettingsPlaceholder({ page }: { page: SettingsPage }) {
  return (
    <>
      <SettingsHeading {...settingsHeading(page)} />
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <EmptyState title="ส่วนนี้กำลังพัฒนา" hint="เปิดใช้ได้ในรอบถัดไป" className="rounded-none py-12" />
      </section>
    </>
  );
}
