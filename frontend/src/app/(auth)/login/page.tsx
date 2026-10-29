import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame } from "../auth-frame";
import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

// S01 — public. Never starts login automatically (sso.md Flow 1).
export default function LoginPage() {
  return (
    <AuthFrame pose="full">
      <Suspense>
        <LoginCard />
      </Suspense>
    </AuthFrame>
  );
}
