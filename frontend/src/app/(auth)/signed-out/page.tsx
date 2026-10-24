import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "../login/login-card";

export const metadata: Metadata = { title: "ออกจากระบบแล้ว" };

// S01 signed-out — the registered post-logout redirect. Same screen as /login (CR-019) with an
// "ออกจากระบบแล้ว" notice; never redirects or starts login by itself, only the button does.
export default function SignedOutPage() {
  return (
    <Suspense>
      <LoginScreen signedOut />
    </Suspense>
  );
}
