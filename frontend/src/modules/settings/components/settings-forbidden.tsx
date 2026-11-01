"use client";

import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/components/shared/me-provider";
import { ForbiddenState } from "@/components/shared/states";
import { settingsAccess } from "../nav";

// A settings page whose API answered 403 FORBIDDEN although the menu let the viewer in (permissions changed since
// `/me` was loaded): same copy as the shell's Forbidden state (`settingsAccess`, CR-006).

const FALLBACK = "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลในส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ";

export function SettingsForbidden() {
  const me = useCurrentUser();
  const access = settingsAccess(me, usePathname());
  if (access.allowed) return <ForbiddenState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" reason={FALLBACK} />;
  return <ForbiddenState title={access.title} reason={access.reason} action={access.action} />;
}
