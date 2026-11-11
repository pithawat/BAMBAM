"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/components/shared/me-provider";
import { settingsEntry } from "@/modules/settings/nav";

// `/settings` opens อาคารและอุปกรณ์ (settings F25 step 3, owner 2026-10-26), or — CR-006, settings keys are tickable — the
// first page the viewer has. Anyone without any gets the Forbidden state there (settings/layout.tsx); the API checks
// every request again.
export default function SettingsIndexPage() {
  const me = useCurrentUser();
  const router = useRouter();
  const to = settingsEntry(me);
  useEffect(() => router.replace(to), [router, to]);
  return null;
}
