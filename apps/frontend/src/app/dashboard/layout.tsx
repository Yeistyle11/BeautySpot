"use client";
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/lib/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrated, hydrate, token } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  // Defensa en profundidad: middleware.ts ya redirige antes de renderizar
  // si no hay token valido, pero cubrimos el caso de estado desincronizado
  // (ej. cookie borrada manualmente sin recargar).
  if (!token) return null;

  return (
    <div className="bg-muted/30 min-h-screen">
      <Sidebar />
      <main className="ml-64 p-6">{children}</main>
    </div>
  );
}
