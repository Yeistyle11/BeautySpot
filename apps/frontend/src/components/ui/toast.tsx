"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/** Avisos efímeros de la interfaz, compartidos por todo el panel. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  const retirar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const añadir = useCallback(
    (tono: Tono, mensaje: string) => {
      const id = siguienteId();
      setAvisos((actuales) => [...actuales, { id, tono, mensaje }]);
      const temporizador = setTimeout(() => {
        temporizadores.current.delete(temporizador);
        retirar(id);
      }, DURACION_MS);
      temporizadores.current.add(temporizador);
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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {/* Cada tono tiene su region: un error interrumpe la lectura en curso,
            pero un «guardado» que hiciera lo mismo cortaria al usuario sin
            necesidad, asi que espera a que haya una pausa. */}
        <Region tono="exito" avisos={avisos} onCerrar={retirar} />
        <Region tono="error" avisos={avisos} onCerrar={retirar} />
      </div>
    </Contexto.Provider>
  );
}

/** Region viva de un tono, con los avisos de ese tono que siguen en pantalla. */
function Region({
  tono,
  avisos,
  onCerrar,
}: {
  tono: Tono;
  avisos: Aviso[];
  onCerrar: (id: number) => void;
}) {
  const esError = tono === "error";

  return (
    <div
      role={esError ? "alert" : "status"}
      aria-live={esError ? "assertive" : "polite"}
      className="flex flex-col gap-2 empty:hidden"
    >
      {avisos
        .filter((a) => a.tono === tono)
        .map((aviso) => (
          <ToastItem key={aviso.id} aviso={aviso} onCerrar={onCerrar} />
        ))}
    </div>
  );
}

/** Tarjeta de un aviso, con su icono segun el tono y su boton de cierre. */
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
      className={`shadow-raised pointer-events-auto flex items-start gap-3 rounded-lg border p-4 ${
        esError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-success/30 bg-success-soft text-success-soft-foreground"
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
/** Identificador del siguiente aviso. */
function siguienteId(): number {
  contador += 1;
  return contador;
}

/** Acceso a los avisos; fuera del proveedor devuelve funciones vacías. */
export function useToast(): ContextoAvisos {
  const contexto = useContext(Contexto);
  return (
    contexto ?? {
      error: () => undefined,
      exito: () => undefined,
    }
  );
}
