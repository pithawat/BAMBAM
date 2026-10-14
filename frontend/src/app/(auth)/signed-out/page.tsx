import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { loginUrl } from "@/lib/platform/api";
import { AuthFrame, BrandLogo } from "../auth-frame";

export const metadata: Metadata = { title: "ออกจากระบบแล้ว" };

// S01 signed-out — the registered post-logout redirect. Never redirects or
// starts login by itself; only the button starts a new login.
export default function SignedOutPage() {
  return (
    <AuthFrame pose="face">
      <div className="flex flex-col items-center text-center">
        <BrandLogo />
        <h2 className="mt-5 font-heading text-[28px] leading-[38px] font-bold">ออกจากระบบแล้ว</h2>
        <p className="mt-1 text-muted-foreground">ขอบคุณที่ใช้ BAMBAM</p>
        <Button asChild className="mt-6 w-full">
          <a href={env.useMocks ? "/" : loginUrl("/")}>เข้าสู่ระบบอีกครั้ง</a>
        </Button>
        <p className="mt-3 text-[12.5px] text-muted-foreground">ใช้บัญชี RMC SSO เดียวกับระบบอื่นของบริษัท</p>
      </div>
    </AuthFrame>
  );
}
