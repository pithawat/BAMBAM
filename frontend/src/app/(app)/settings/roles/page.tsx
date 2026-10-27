import { Suspense } from "react";
import { RolesScreen } from "@/modules/settings/components/roles/roles-screen";

// S24 Role และสิทธิ์ (settings Stage 2). `?tab=` is read on the client, hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <RolesScreen />
    </Suspense>
  );
}
