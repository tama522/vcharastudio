import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = new Set(["/sign-in"]);

function isPublicPagePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/builder" ||
    pathname.startsWith("/builder/complete/") ||
    pathname === "/studio" ||
    pathname.startsWith("/result/")
  );
}

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    request.cookies.get("vchara_session")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value ||
      request.cookies.get("next-auth.session-token")?.value,
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.has(pathname) ||
    isPublicPagePath(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
