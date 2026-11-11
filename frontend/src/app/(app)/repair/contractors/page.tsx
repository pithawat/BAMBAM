import { Suspense } from "react";
import { ContractorsScreen } from "@/modules/repair/components/contractors";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";
export default function ContractorsPage() { return <Suspense fallback={<TicketSkeleton />}><ContractorsScreen /></Suspense>; }
