import { Suspense } from "react";
import { ReportSuccessScreen } from "@/modules/repair/components/report-success";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";

export default function ReportSuccessPage() {
  return <Suspense fallback={<TicketSkeleton success />}><ReportSuccessScreen /></Suspense>;
}
