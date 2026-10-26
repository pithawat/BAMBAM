import { SettingsShell } from "@/modules/settings/components/settings-shell";

// Administration shell for every /settings page (settings CR-001): replaces the app navbar (app-shell.tsx skips it here).
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <SettingsShell>{children}</SettingsShell>;
}
