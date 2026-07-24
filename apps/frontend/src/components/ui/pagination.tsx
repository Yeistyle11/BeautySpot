"use client";

// Controles de paginacion: anterior/siguiente e indicador de pagina.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/swr";

interface PaginationProps {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  /** Nombre plural de lo que se lista, para el resumen ("clientes", "pagos"). */
  itemLabel?: string;
}

/**
 * Navegacion entre paginas del servidor. Se oculta cuando solo hay una pagina
 * para no añadir ruido a las listas cortas.
 */
export function Pagination({
  meta,
  onPageChange,
  itemLabel = "resultados",
}: PaginationProps) {
  if (!meta || meta.totalPages <= 1) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      className="mt-4 flex items-center justify-between gap-4"
      aria-label={`Paginacion de ${itemLabel}`}
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Mostrando {from}–{to} de {meta.total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!meta.hasPrev}
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Anterior</span>
        </Button>
        <span className="text-sm font-medium">
          Pagina {meta.page} de {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasNext}
          aria-label="Pagina siguiente"
        >
          <span className="mr-1 hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
