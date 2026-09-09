"use client";

// Dialogo para emitir una factura a partir de un cobro ya registrado.
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ETIQUETAS_DE_METODO } from "@/lib/metodos-de-pago";
import { formatCurrency, formatDateTimeStamp } from "@/lib/utils";
import { mensajeDeError } from "@/lib/error-message";
import type { CobroFacturable } from "./schemas";

interface EmitirDialogProps {
  open: boolean;
  onClose: () => void;
  onEmitir: (cobro: CobroFacturable) => void;
  /** Cobros completados del negocio, de los que sale la factura. */
  cobros: CobroFacturable[];
  /** Nombre de cada cliente por id; el cobro solo trae el identificador. */
  clientes: Record<string, string>;
  cargando: boolean;
  /** Fallo al pedir los cobros; distinto de que no haya ninguno. */
  errorAlCargar?: unknown;
  emitiendo: string | null;
  error?: string;
}

/**
 * Emitir una factura es elegir el cobro que la origina: el importe, el cliente
 * y los servicios salen de él, en vez de teclear otra vez lo que ya está en el
 * sistema. Así la factura queda ligada al cobro y se puede responder de dónde
 * salió cada una.
 */
export function EmitirDialog({
  open,
  onClose,
  onEmitir,
  cobros,
  clientes,
  cargando,
  errorAlCargar,
  emitiendo,
  error,
}: EmitirDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Emitir factura" wide>
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Elige el cobro que se factura. El importe y los servicios salen de él;
          el impuesto va incluido en lo que ya se cobró.
        </p>

        {cargando ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Cargando cobros...
          </p>
        ) : errorAlCargar ? (
          // Un fallo al pedirlos no es «no hay ninguno»: presentarlo como lista
          // vacía dejaba la facturación inservible sin que nadie lo reportara,
          // porque el dueño concluía que aún no tenía nada que facturar.
          <p role="alert" className="text-destructive py-6 text-center text-sm">
            No se pudieron cargar los cobros. {mensajeDeError(errorAlCargar)}
          </p>
        ) : cobros.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No hay cobros completados que facturar.
          </p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {cobros.map((cobro) => (
              <div
                key={cobro.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {clientes[cobro.clientId ?? ""] || "Cliente"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTimeStamp(cobro.createdAt)} ·{" "}
                    {ETIQUETAS_DE_METODO[cobro.method] ?? cobro.method}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {formatCurrency(cobro.amount)}
                  </span>
                  <Button
                    size="sm"
                    disabled={emitiendo !== null}
                    onClick={() => onEmitir(cobro)}
                  >
                    {emitiendo === cobro.id ? "Emitiendo..." : "Facturar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialog>
  );
}
