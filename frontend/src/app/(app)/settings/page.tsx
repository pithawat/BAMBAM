import { redirect } from "next/navigation";
import { SETTINGS_HOME } from "@/modules/settings/nav";

// `/settings` opens อาคารและอุปกรณ์ for Admin and Superadmin (settings F25 step 3, owner 2026-10-26). Anyone without the
// permission gets the Forbidden state there (settings/layout.tsx); the API checks every request again.
export default function SettingsIndexPage() {
  redirect(SETTINGS_HOME);
}
