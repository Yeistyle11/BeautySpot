// Middleware de Edge: guarda las rutas /dashboard antes de renderizar. Lee el rol
// de la cookie de sesión para redirigir a login si no hay sesión válida, o a la
// página por defecto del rol si intenta entrar a una sección sin permiso. La
// autorización real la sigue validando el api-gateway; esto solo mejora la UX.
import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt, AUTH_COOKIE_NAME, SESSION_HINT_COOKIE } from "@/lib/auth";
import { canAccess, getDefaultPath } from "@/lib/permissions";

/**
 * Indica si la sesión aún puede renovarse.
 *
 * La cookie de refresco está acotada a la ruta que la canjea, así que este guard
 * no la ve. Su testigo es la pista de sesión, que el gateway emite con la misma
 * vida que el refresco: mientras exista, un access token caducado se renueva en
 * la primera llamada a la API, y si esa renovación falla la sesión se cierra
 * desde allí.
 *
 * Lo que decide es que la cookie exista; la caducidad que lleva dentro es la del
 * propio access token.
 */
function puedeRenovarse(request: NextRequest): boolean {
  return !!request.cookies.get(SESSION_HINT_COOKIE)?.value;
}

/** Redirige según sesión y rol antes de servir /dashboard y /login. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? decodeJwt(token) : null;
  const isExpired = !!payload?.exp && payload.exp * 1000 < Date.now();
  const isAuthenticated = !!payload && (!isExpired || puedeRenovarse(request));
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

  // Las dos pantallas de sesión son para quien no la tiene.
  if ((pathname === "/login" || pathname === "/registro") && isAuthenticated) {
    return NextResponse.redirect(new URL(getDefaultPath(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/registro"],
};
