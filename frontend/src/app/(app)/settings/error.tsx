"use client";

import { ErrorState } from "@/components/shared/states";

// Whole page failed (settings _common.md §6, CR-001 copy).
export default function SettingsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="rounded-xl border bg-card shadow-card">
      <ErrorState hint="ตรวจสอบการเชื่อมต่อ แล้วลองอีกครั้ง ข้อมูลที่ยังไม่บันทึกจะยังอยู่" onRetry={retry} />
    </section>
  );
}
