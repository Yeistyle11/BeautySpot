"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import { setUnauthorizedHandler } from "@/lib/api";
import { isAuthError } from "@/lib/api-error";
import { useAuthStore } from "@/lib/store";

/**
 * Cierra la sesion y manda a login cuando el backend rechaza el token.
 * Conserva la ruta actual en `next` para volver a ella despues de reentrar.
 */
function useUnauthorizedRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      const isPublic = !pathname.startsWith("/dashboard");
      router.replace(
        isPublic ? "/login" : `/login?next=${encodeURIComponent(pathname)}`
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [router, pathname, logout]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useUnauthorizedRedirect();

  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 1,
        // Un 401/403 no se arregla reintentando: hace falta otra sesion u
        // otros permisos.
        shouldRetryOnError: (err: unknown) => !isAuthError(err),
      }}
    >
      {children}
    </SWRConfig>
  );
}
