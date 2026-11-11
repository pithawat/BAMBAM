// QR label target (CR-036, D-140): `{FRONTEND_URL}/q/{code}` → the report form, which looks the asset up (#25)
// and handles "not found". No API call here. A route handler, not a page: nothing to prerender (cacheComponents
// flags a page that reads params outside Suspense). `proxy.ts` sends a logged-out visitor to login with
// `next=/q/{code}` and back. Relative Location: the browser resolves it against the public origin.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return new Response(null, { status: 307, headers: { Location: `/repair/new?asset=${encodeURIComponent(code)}` } });
}
