import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt, AUTH_COOKIE_NAME } from "@/lib/auth";
import { canAccess, getDefaultPath } from "@/lib/permissions";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? decodeJwt(token) : null;
  const isExpired = !!payload?.exp && payload.exp * 1000 < Date.now();
  const isAuthenticated = !!payload && !isExpired;
  const role = payload?.role ?? null;

  if (pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!canAccess(role, pathname)) {
      return NextResponse.redirect(new URL(getDefaultPath(role), request.url));
    }
  }

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL(getDefaultPath(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
