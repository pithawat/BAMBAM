import { ResolveScreen } from "@/modules/repair/components/resolve-form";

// The platform's client-only AppShell resolves usePathname before mounting this dynamic route.
export const instant = false;

export default async function ResolvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResolveScreen key={id} id={id} />;
}
