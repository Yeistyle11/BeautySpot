"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type Tono = "error" | "exito";

interface Aviso {
  id: number;
  tono: Tono;
  mensaje: string;
}

interface ContextoAvisos {
  error: (mensaje: string) => void;
  exito: (mensaje: string) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

/** Cuánto permanece un aviso antes de retirarse solo. */
const DURACION_MS = 6000;

/**
 * Avisos efímeros de la interfaz.
 *
 * Los formularios del panel informan por aquí del resultado de guardar. Es un
 * punto único y no un estado por página porque el mismo mensaje hace falta en
 * las ~25 operaciones de creación, edición y borrado del dashboard.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const retirar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const añadir = useCallback(
    (tono: Tono, mensaje: string) => {
      // El id sale de un contador monótono: dos avisos del mismo milisegundo
      // compartirían clave si se usara la fecha.
      const id = siguienteId();
      setAvisos((actuales) => [...actuales, { id, tono, mensaje }]);
      setTimeout(() => retirar(id), DURACION_MS);
    },
    [retirar]
  );

  const valor = useMemo<ContextoAvisos>(
    () => ({
      error: (mensaje) => añadir("error", mensaje),
      exito: (mensaje) => añadir("exito", mensaje),
    }),
    [añadir]
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        // `assertive` para los errores de guardado: un lector de pantalla debe
        // anunciarlos en cuanto aparecen, no al terminar lo que esté leyendo.
        role="alert"
        aria-live="assertive"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {avisos.map((aviso) => (
          <ToastItem key={aviso.id} aviso={aviso} onCerrar={retirar} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

function ToastItem({
  aviso,
  onCerrar,
}: {
  aviso: Aviso;
  onCerrar: (id: number) => void;
}) {
  const esError = aviso.tono === "error";
  const Icono = esError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg ${
        esError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      <Icono className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{aviso.mensaje}</p>
      <button
        type="button"
        onClick={() => onCerrar(aviso.id)}
        aria-label="Cerrar aviso"
        className="opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

let contador = 0;
function siguienteId(): number {
  contador += 1;
  return contador;
}

/**
 * Acceso a los avisos.
 *
 * Fuera del proveedor devuelve funciones vacías en lugar de lanzar: un aviso
 * que no se pinta no debe tumbar la pantalla que intentaba mostrarlo.
 */
export function useToast(): ContextoAvisos {
  const contexto = useContext(Contexto);
  return (
    contexto ?? {
      error: () => undefined,
      exito: () => undefined,
    }
  );
}
