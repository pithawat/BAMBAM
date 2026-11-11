import { Suspense } from "react";
import { UsersScreen } from "@/modules/settings/components/users/users-screen";

// S25 ผู้ใช้ (settings Stage 3). Filters live in the URL (read on the client), hence the Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <UsersScreen />
    </Suspense>
  );
}
