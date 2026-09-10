"use client";

// Dialogo de los servicios que presta un profesional, con su tarifa propia.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import type {
  FilaDeTarifa,
  Professional,
  ServicioDelCatalogo,
} from "./schemas";

interface ServicesDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  professional: Professional | null;
  /** Catálogo del negocio, que es lo que se puede asignar. */
  servicios: ServicioDelCatalogo[];
  filas: FilaDeTarifa[];
  onChange: (filas: FilaDeTarifa[]) => void;
  saving: boolean;
  cargando: boolean;
  error?: string;
}

/**
 * Qué servicios presta cada profesional y a qué precio. La tarifa propia es
 * opcional: en blanco, cobra y dura lo del catálogo. Es la regla más extendida
 * del sector, que el corte del senior no vale lo que el del junior.
 */
export function ServicesDialog({
  open,
  onClose,
  onSave,
  professional,
  servicios,
  filas,
  onChange,
  saving,
  cargando,
  error,
}: ServicesDialogProps) {
  const editar = (serviceId: string, cambio: Partial<FilaDeTarifa>) =>
    onChange(
      filas.map((fila) =>
        fila.serviceId === serviceId ? { ...fila, ...cambio } : fila
      )
    );

  const porId = new Map(filas.map((fila) => [fila.serviceId, fila]));
  const prestados = filas.filter((f) => f.presta).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Servicios de ${professional?.name || ""}`}
      wide
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Marca los servicios que presta. Deja el precio y la duración en blanco
          para cobrar y durar lo del catálogo.
        </p>

        {cargando ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Cargando servicios...
          </p>
        ) : servicios.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Este negocio todavía no tiene servicios en el catálogo.
          </p>
        ) : (
          <div className="space-y-2">
            {servicios.map((servicio) => {
              const fila = porId.get(servicio.id);
              if (!fila) return null;

              return (
                <div
                  key={servicio.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <Switch
                    checked={fila.presta}
                    onCheckedChange={(presta) =>
                      editar(servicio.id, {
                        presta,
                        // Al dejar de prestarlo, su tarifa deja de tener
                        // sentido: guardarla escondida seria una sorpresa.
                        ...(presta ? {} : { precio: "", duracion: "" }),
                      })
                    }
                    aria-label={`${servicio.name}: lo presta`}
                  />
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{servicio.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Catálogo: {formatCurrency(servicio.price)} ·{" "}
                      {servicio.duration} min
                    </p>
                  </div>

                  {fila.presta && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="h-8 w-32 text-sm"
                        placeholder={String(servicio.price)}
                        value={fila.precio}
                        onChange={(e) =>
                          editar(servicio.id, { precio: e.target.value })
                        }
                        aria-label={`Precio propio de ${servicio.name}`}
                      />
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="h-8 w-24 text-sm"
                        placeholder={String(servicio.duration)}
                        value={fila.duracion}
                        onChange={(e) =>
                          editar(servicio.id, { duracion: e.target.value })
                        }
                        aria-label={`Duración propia de ${servicio.name}, en minutos`}
                      />
                      <span className="text-muted-foreground text-xs">min</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving || cargando}>
            {saving ? "Guardando..." : "Guardar servicios"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <span className="text-muted-foreground ml-auto text-xs">
            {prestados} de {servicios.length}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
