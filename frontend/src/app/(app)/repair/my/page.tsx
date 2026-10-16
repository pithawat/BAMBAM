import { Suspense } from "react";
import { MyTicketsScreen } from "@/modules/repair/components/my-tickets";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";
export default function MyTicketsPage() { return <Suspense fallback={<TicketSkeleton />}><MyTicketsScreen /></Suspense>; }
