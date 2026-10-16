import { Suspense } from "react";
import { TechnicianWorkScreen } from "@/modules/repair/components/technician-work";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";
export default function TechnicianWorkPage() { return <Suspense fallback={<TicketSkeleton />}><TechnicianWorkScreen /></Suspense>; }
