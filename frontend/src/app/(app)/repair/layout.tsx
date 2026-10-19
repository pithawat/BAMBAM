import type { ReactNode } from "react";
import { RepairNav } from "@/modules/repair/components/repair-nav";

// Repair section: staff tools nav above the list pages (CR-010).
export default function RepairLayout({ children }: { children: ReactNode }) {
  return <>
    <RepairNav />
    {children}
  </>;
}
