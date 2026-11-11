import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "./login-card";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

// S01 — public. Never starts login automatically (sso.md Flow 1). Full-page layout since CR-019
// (bam-workplace-login-v7.html), shared with /signed-out.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
