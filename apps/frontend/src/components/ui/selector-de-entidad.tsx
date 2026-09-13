"use client";

// Selector de una ficha del negocio: se busca escribiendo y se puede crear una
// nueva sin salir del formulario.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpcionDeEntidad {
  id: string;
  /** Lo que se ve y sobre lo que se busca. */
  nombre: string;
  /** Segunda linea de la opcion: telefono, precio, lo que distinga a dos homonimos. */
  detalle?: string;
}

interface SelectorDeEntidadProps {
  opciones: OpcionDeEntidad[];
  value: string;
  onChange: (id: string) => void;
  /** Lo que se lee cuando no hay nada elegido. */
  placeholder?: string;
  /** Primera opcion de la lista, para los selectores que admiten vacio. */
  etiquetaDeVacio?: string;
  /** Modulo donde se da de alta la ficha. Sin ruta no se ofrece el alta. */
  rutaDeAlta?: string;
  /** Texto del enlace de alta. */
  etiquetaDeAlta?: string;
  /** Vuelve a pedir las opciones cada vez que se despliega la lista. */
  onRecargarOpciones?: () => Promise<unknown>;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  className?: string;
}

/**
 * Combo con buscador. El disparador abre la lista con el cursor ya en el
 * buscador, y el boton de al lado da de alta una ficha nueva.
 */
export function SelectorDeEntidad({
  opciones,
  value,
  onChange,
  placeholder = "Seleccionar...",
  etiquetaDeVacio,
  rutaDeAlta,
  etiquetaDeAlta,
  onRecargarOpciones,
  id,
  required,
  disabled,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-label": ariaLabel,
  className,
}: SelectorDeEntidadProps) {
  const generado = useId();
  const idLista = `${generado}-lista`;
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const elegida = opciones.find((o) => o.id === value);
  const etiqueta =
    elegida?.nombre ?? (value === "" ? etiquetaDeVacio : undefined);

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return opciones;
    return opciones.filter(
      (o) =>
        o.nombre.toLowerCase().includes(t) ||
        (o.detalle ?? "").toLowerCase().includes(t)
    );
  }, [opciones, busqueda]);

  // Cierra la lista al pulsar o tabular fuera del conjunto.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    // Con la lista abierta, el Escape la cierra a ella y no al dialogo.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!contenedor.current?.contains(e.target as Node)) return;
      e.preventDefault();
      setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("focusin", fuera);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("focusin", fuera);
      window.removeEventListener("keydown", escape, true);
    };
  }, [abierto]);

  // Lleva el foco al buscador al desplegar la lista.
  useEffect(() => {
    if (abierto) buscador.current?.focus();
  }, [abierto]);

  const abrir = () => {
    if (disabled) return;
    setBusqueda("");
    setResaltada(0);
    setAbierto(true);
    // Las opciones se vuelven a pedir al desplegar.
    void onRecargarOpciones?.();
  };

  const elegir = (idElegido: string) => {
    onChange(idElegido);
    setAbierto(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const total = filtradas.length + (etiquetaDeVacio ? 1 : 0);
      if (total === 0) return;
      setResaltada((i) => {
        const siguiente = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (siguiente + total) % total;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const conVacio = etiquetaDeVacio
        ? ["", ...filtradas.map((o) => o.id)]
        : filtradas.map((o) => o.id);
      const destino = conVacio[resaltada];
      if (destino !== undefined) elegir(destino);
    }
  };

  const items = etiquetaDeVacio
    ? [{ id: "", nombre: etiquetaDeVacio, detalle: undefined }, ...filtradas]
    : filtradas;

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div ref={contenedor} className="relative min-w-0 flex-1">
        {/* El disparador es el boton de busqueda: abre la lista con el cursor
            ya puesto en el buscador. */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={abierto ? idLista : undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          className={cn(
            "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-destructive",
            !etiqueta && "text-muted-foreground"
          )}
        >
          <Search
            className="text-muted-foreground h-4 w-4 shrink-0"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">
            {etiqueta ?? placeholder}
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
              abierto && "rotate-180"
            )}
            aria-hidden
          />
        </button>

        {/* El valor viaja en un input oculto, que es lo que valida `required`. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden
            aria-invalid={invalid}
            required
            value={value}
            onChange={() => {}}
            onFocus={abrir}
            className="pointer-events-none absolute bottom-1 left-3 h-0 w-0 opacity-0"
          />
        )}

        {abierto && (
          <div className="bg-popover animate-aparecer-lista shadow-raised absolute z-50 mt-1 w-full overflow-hidden rounded-lg border">
            <div className="border-b p-2">
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden
                />
                <input
                  ref={buscador}
                  type="text"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setResaltada(0);
                  }}
                  onKeyDown={teclas}
                  placeholder="Buscar..."
                  aria-label="Buscar"
                  aria-controls={idLista}
                  className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                />
              </div>
            </div>

            <ul
              id={idLista}
              role="listbox"
              className="max-h-56 overflow-y-auto py-1"
            >
              {items.map((o, i) => (
                <li key={o.id || "__vacio"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.id === value}
                    onMouseEnter={() => setResaltada(i)}
                    onClick={() => elegir(o.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      i === resaltada && "bg-muted",
                      o.id === value && "font-medium"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.nombre}</span>
                      {o.detalle && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {o.detalle}
                        </span>
                      )}
                    </span>
                    {o.id === value && (
                      <Check
                        className="text-primary h-4 w-4 shrink-0"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              ))}

              {items.length === 0 && (
                <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                  {busqueda.trim()
                    ? `Sin resultados para «${busqueda.trim()}»`
                    : "No hay nada que elegir todavía"}
                </li>
              )}
            </ul>

            {/* El alta, repetida al pie de la lista. */}
            {rutaDeAlta && (
              <a
                href={rutaDeAlta}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAbierto(false)}
                className="text-primary hover:bg-muted flex w-full items-center gap-2 border-t px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="flex-1">{etiquetaDeAlta ?? "Crear"}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            )}
          </div>
        )}
      </div>

      {rutaDeAlta && (
        <a
          href={rutaDeAlta}
          target="_blank"
          rel="noopener noreferrer"
          title={`${etiquetaDeAlta ?? "Crear"} (otra pestaña)`}
          aria-label={`${etiquetaDeAlta ?? "Crear"} (se abre en otra pestaña)`}
          className="border-input bg-background text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </a>
      )}
    </div>
  );
}
