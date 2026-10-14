import { NextResponse, type NextRequest } from "next/server";

// Frontend auth gate (docs/shared/integrations/sso.md). It only checks that a
// session cookie exists; the Go API validates the session on every request.
// Never rely on this gate alone.

const SESSION_COOKIE = "bam_session";
const SEEN_COOKIE = "bam_seen";
const PUBLIC_PATHS = ["/login", "/signed-out"];

export function proxy(request: NextRequest) {
  // Mock mode (UI built without the backend): no session exists, let everything through.
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    // A logged-in user opening a plain /login goes on to ?next= or Home (S01).
    // With ?reason / ?error the page must show its message, so stay.
    const params = request.nextUrl.searchParams;
    if (pathname === "/login" && hasSession && !params.has("reason") && !params.has("error")) {
      return NextResponse.redirect(new URL(safeNext(params.get("next")), request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    // The browser had a session before → it expired (S01 ?reason=expired).
    if (request.cookies.get(SEEN_COOKIE)?.value) url.searchParams.set("reason", "expired");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n\\]/.test(next)) {
    return "/";
  }
  if (next.startsWith("/api/") || next.startsWith("/login") || next.startsWith("/signed-out")) return "/";
  return next;
}

export const config = {
  // Everything except the API (rewritten to Go), Next internals and static files.
  matcher: ["/((?!api/|health/|_next/static|_next/image|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
