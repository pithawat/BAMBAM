import { Suspense } from "react";
import { AuditScreen } from "@/modules/settings/components/audit/audit-screen";

// S26 ประวัติการเปลี่ยนแปลง (settings Stage 3). Filters live in the URL (read on the client), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <AuditScreen />
    </Suspense>
  );
}
