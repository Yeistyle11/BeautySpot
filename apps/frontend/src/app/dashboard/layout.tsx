"use client";

// Layout del dashboard: rehidrata la sesion, exige sesion activa y monta el sidebar alrededor de las paginas.
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/lib/store";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrated, hydrate, role } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner variant="inline" className="h-8 w-8 border-4" />
      </div>
    );
  }

  // Defensa en profundidad: middleware.ts ya redirige antes de renderizar si
  // no hay sesion valida, pero cubrimos el caso de estado desincronizado (ej.
  // cookie borrada manualmente sin recargar). El rol es el indicio de sesion
  // del que dispone el cliente: la credencial es httpOnly y no se puede leer.
  if (!role) return null;

  return (
    <div className="bg-muted/30 min-h-screen">
      {/* Solo visible al enfocarlo con el tabulador: permite saltarse el menu
          lateral, que son mas de diez enlaces antes del contenido. */}
      <a
        href="#contenido"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2 focus:ring-2"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      {/* pt-14 deja hueco para la barra superior movil; a partir de lg el
          sidebar es fijo y el contenido se desplaza a su derecha. */}
      <main
        id="contenido"
        className="p-4 pt-[4.5rem] sm:p-6 sm:pt-[4.5rem] lg:ml-64 lg:pt-6"
      >
        {children}
      </main>
    </div>
  );
}
