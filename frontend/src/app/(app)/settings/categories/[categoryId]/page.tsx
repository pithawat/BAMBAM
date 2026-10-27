import { CategoriesScreen } from "@/modules/settings/components/categories/categories-screen";

// The platform's client-only AppShell resolves usePathname before mounting this dynamic route.
export const instant = false;

// S22 with one category selected (settings Stage 5).
export default async function Page({ params }: PageProps<"/settings/categories/[categoryId]">) {
  const { categoryId } = await params;
  return <CategoriesScreen categoryId={categoryId} />;
}
