import { Suspense } from "react";
import { LabelsScreen } from "@/modules/settings/components/labels/labels-screen";

// S30 พิมพ์ป้าย QR (settings CR-007, repair CR-036 Stage 5B). The preselection lives in the URL (read on the client), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <LabelsScreen />
    </Suspense>
  );
}
