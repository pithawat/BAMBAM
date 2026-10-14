import { AppShell } from "@/components/shared/app-shell";

// Every module route lives inside the shared app shell. proxy.ts guards these
// routes; the API guards the data.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
