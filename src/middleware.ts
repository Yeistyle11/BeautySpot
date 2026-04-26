import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Obtener el token JWT del usuario (si está logueado)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ========================================
  // RUTAS PÚBLICAS (no requieren autenticación)
  // ========================================
  const authRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];
  
  const publicAccessRoutes = [
    "/",
    "/barberos",
    "/servicios",
  ];
  
  const isAuthRoute = authRoutes.some((route) =>
    pathname.startsWith(route)
  );
  
  const isPublicAccessRoute = publicAccessRoutes.some((route) =>
    pathname === route || pathname.startsWith(route + "/")
  );

  // Si está en ruta de autenticación y YA está logueado → redirigir según rol
  if (isAuthRoute && token) {
    const userRole = token.role as string;
    if (userRole === "ADMIN") return NextResponse.redirect(new URL("/admin", request.url));
    if (userRole === "BARBER") return NextResponse.redirect(new URL("/barbero", request.url));
    if (userRole === "CLIENT") return NextResponse.redirect(new URL("/cliente", request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si está en ruta de autenticación y NO está logueado → permitir acceso
  if (isAuthRoute) {
    return NextResponse.next();
  }
  
  // Si está en ruta de acceso público → permitir acceso siempre (logueado o no)
  if (isPublicAccessRoute) {
    return NextResponse.next();
  }

  // ========================================
  // RUTAS PROTEGIDAS (requieren autenticación)
  // ========================================
  const protectedRoutes = ["/profile", "/admin", "/barbero", "/cliente"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Si está en ruta protegida y NO está logueado → redirigir al login
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ========================================
  // PROTECCIÓN POR ROL
  // ========================================
  if (token) {
    const userRole = token.role as string;

    // Solo ADMIN puede acceder a /admin/*
    if (pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Solo BARBER puede acceder a /barbero/*
    if (pathname.startsWith("/barbero") && userRole !== "BARBER") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Solo CLIENT puede acceder a /cliente/*
    if (pathname.startsWith("/cliente") && userRole !== "CLIENT") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Permitir acceso si pasa todas las validaciones
  return NextResponse.next();
}

// ========================================
// CONFIGURACIÓN: En qué rutas ejecutar el middleware
// ========================================
export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas EXCEPTO:
     * - API routes (_next)
     * - Archivos estáticos (images, css, js)
     * - favicon.ico
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
