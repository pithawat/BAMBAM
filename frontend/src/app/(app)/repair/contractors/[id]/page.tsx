import { ContractorDetailScreen } from "@/modules/repair/components/contractors";

// The platform's client-only AppShell resolves usePathname before mounting this dynamic route.
export const instant = false;

export default async function ContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractorDetailScreen key={id} id={id} />;
}
