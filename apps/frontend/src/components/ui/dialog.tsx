"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cierre del dialogo abierto, que piden los botones del pie. */
const CierreDelDialogo = createContext<() => void>(() => {});

/** El boton que cierra un dialogo sin guardar nada. */
export function BotonDeCancelar({
  children = "Cancelar",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick">) {
  const cerrar = useContext(CierreDelDialogo);

  return (
    <Button type="button" variant="outline" onClick={cerrar} {...props}>
      {children}
    </Button>
  );
}

/** Anchos del dialogo. `wide` equivale a `lg`. */
const ANCHOS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Segunda linea de la cabecera: que hace este dialogo. */
  descripcion?: string;
  /** Icono de la cabecera, en el cuadro de color de la marca. */
  icono?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  /** Barra inferior fija con las acciones. */
  pie?: React.ReactNode;
  size?: keyof typeof ANCHOS;
  wide?: boolean;
  /** Cierra sin preguntar por el descarte aunque haya campos tocados. */
  sinAvisoDeDescarte?: boolean;
}

/**
 * Modal de la app. Se apoya en Radix para atrapar el foco dentro del dialogo,
 * devolverlo al elemento que lo abrio al cerrar y exponer role/aria-modal a los
 * lectores de pantalla.
 */
export function Dialog({
  open,
  onClose,
  title,
  descripcion,
  icono: Icono,
  children,
  pie,
  size,
  wide,
  sinAvisoDeDescarte,
}: DialogProps) {
  const ancho = ANCHOS[size ?? (wide ? "lg" : "md")];

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        // Los cierres accidentales los ataja el cuerpo del dialogo.
        if (!isOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-aparecer-fondo fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        {open && (
          <CuerpoDelDialogo
            ancho={ancho}
            onClose={onClose}
            sinAvisoDeDescarte={sinAvisoDeDescarte}
            title={title}
            descripcion={descripcion}
            icono={Icono}
            pie={pie}
          >
            {children}
          </CuerpoDelDialogo>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** El dialogo, montado solo mientras esta abierto. */
function CuerpoDelDialogo({
  ancho,
  onClose,
  title,
  descripcion,
  icono: Icono,
  children,
  pie,
  sinAvisoDeDescarte,
}: {
  ancho: string;
  onClose: () => void;
  sinAvisoDeDescarte?: boolean;
  title?: string;
  descripcion?: string;
  icono?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  /** Lo que el usuario haya escrito aqui dentro y no este guardado. */
  const [sucio, setSucio] = useState(false);
  const [preguntando, setPreguntando] = useState(false);

  /** Cerrar con algo escrito pregunta antes; en vacio cierra directo. */
  const intentarCerrar = () => {
    if (sucio && !sinAvisoDeDescarte) setPreguntando(true);
    else onClose();
  };

  return (
    <CierreDelDialogo.Provider value={intentarCerrar}>
      <DialogPrimitive.Content
        className={cn(
          "bg-background data-[state=open]:animate-aparecer-dialogo shadow-overlay fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border focus:outline-none",
          ancho
        )}
        // Los contenidos varian y no tienen una descripcion unica que anunciar.
        aria-describedby={undefined}
        // Escape y el clic fuera pasan por la pregunta de descarte.
        onEscapeKeyDown={(e) => {
          if (sucio) {
            e.preventDefault();
            setPreguntando(true);
          }
        }}
        onInteractOutside={(e) => {
          if (sucio) {
            e.preventDefault();
            setPreguntando(true);
          }
        }}
        // Marca como escrito lo que el usuario teclea o elige aqui dentro.
        onInputCapture={() => setSucio(true)}
        onChangeCapture={() => setSucio(true)}
      >
        {title ? (
          <div className="flex items-start gap-3 border-b px-6 py-4">
            {Icono && (
              <span className="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Icono className="h-[18px] w-[18px]" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
                {title}
              </DialogPrimitive.Title>
              {descripcion && (
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {descripcion}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={intentarCerrar}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring -mr-1 rounded-lg p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          // Un dialogo sin titulo visible sigue necesitando nombre accesible.
          <VisuallyHiddenTitle />
        )}

        {/* El cuerpo es lo unico que se desplaza: la cabecera y el pie se
              quedan quietos, asi que las acciones siempre estan a la vista. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {pie && (
          <div className="bg-muted/30 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t px-6 py-3">
            {pie}
          </div>
        )}

        {preguntando && (
          <ConfirmarDescarte
            onSeguir={() => setPreguntando(false)}
            onDescartar={onClose}
          />
        )}
      </DialogPrimitive.Content>
    </CierreDelDialogo.Provider>
  );
}

/** Capa que tapa el dialogo al intentar cerrarlo con algo escrito. */
function ConfirmarDescarte({
  onSeguir,
  onDescartar,
}: {
  onSeguir: () => void;
  onDescartar: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Descartar lo escrito"
      className="bg-background/95 absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl p-6 text-center"
    >
      <span className="bg-warning-soft text-warning flex h-10 w-10 items-center justify-center rounded-xl">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="font-semibold">¿Descartar lo escrito?</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Has empezado a rellenar este formulario. Si lo cierras, se pierde lo
          que llevas.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onSeguir} autoFocus>
          Seguir aquí
        </Button>
        <Button variant="destructive" onClick={onDescartar}>
          Descartar
        </Button>
      </div>
    </div>
  );
}

function VisuallyHiddenTitle() {
  return (
    <DialogPrimitive.Title className="sr-only">Dialogo</DialogPrimitive.Title>
  );
}
