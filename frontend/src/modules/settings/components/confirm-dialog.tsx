"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sheetOnMobile } from "./settings-ui";

// settings _common.md §5: deactivate ("ปิดใช้งาน "{ชื่อ}"?") and delete ("ลบ "{ชื่อ}"?") confirmations.

export type Confirm = { title: string; body: string; extra?: string | null; confirm: string; destructive?: boolean; run: () => Promise<void> };

export function ConfirmDialog({ value, onClose }: { value: Confirm | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!value) return;
    setBusy(true);
    try {
      await value.run();
    } finally {
      setBusy(false);
      onClose();
    }
  }
  return (
    <AlertDialog open={!!value} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent className={sheetOnMobile}>
        <AlertDialogHeader>
          <AlertDialogTitle>{value?.title}</AlertDialogTitle>
          <AlertDialogDescription>{value?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {value?.extra && <p className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm">{value.extra}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
          <Button variant={value?.destructive ? "destructive" : "default"} disabled={busy} onClick={go}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {value?.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
