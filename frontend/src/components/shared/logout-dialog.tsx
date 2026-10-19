"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { clearAllDrafts } from "@/lib/drafts";
import { env } from "@/lib/env";
import { LOGOUT_URL } from "@/lib/platform/api";

/**
 * Logout confirm (S14). Confirm POSTs a form to the API, which clears the app
 * session and redirects to RMC SSO End Session → /signed-out (sso.md Flow 7).
 */
type LogoutDialogProps = {
  /** Uncontrolled use; the navbar account menu opens it with `open` instead (CR-010). */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof AlertDialogContent>["onCloseAutoFocus"];
};

export function LogoutDialog({ trigger, open, onOpenChange, onCloseAutoFocus }: LogoutDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="rounded-xl" onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">ออกจากระบบ?</AlertDialogTitle>
          <AlertDialogDescription>คุณต้องเข้าสู่ระบบด้วย RMC SSO อีกครั้งเมื่อกลับมา</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
          <form
            method="post"
            action={env.useMocks ? "/signed-out" : LOGOUT_URL}
            onSubmit={(e) => {
              setBusy(true);
              clearAllDrafts();
              if (env.useMocks) {
                e.preventDefault();
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard navigation on purpose: drop all client state
                window.location.assign("/signed-out");
              }
            }}
          >
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              ออกจากระบบ
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
