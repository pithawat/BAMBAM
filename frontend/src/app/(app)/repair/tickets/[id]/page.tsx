import { Suspense } from "react";
import { TicketDetailScreen } from "@/modules/repair/components/ticket-detail";
import { TicketSkeleton } from "@/modules/repair/components/ticket-ui";

// The platform's client-only AppShell resolves usePathname before mounting this dynamic route.
export const instant = false;

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<TicketSkeleton />}><TicketDetailScreen key={id} id={id} /></Suspense>;
}
