import { Suspense } from "react";
import { AdminTicketsScreen } from "@/modules/repair/components/admin-tickets";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";
export default function AdminTicketsPage() { return <Suspense fallback={<TicketSkeleton />}><AdminTicketsScreen /></Suspense>; }
