"use client";

// Dialogo para registrar un walk-in: alguien que entro sin cita y ya se atendio.
import { rutaDeAlta } from "@/lib/alta-por-url";
import { UserPlus } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SelectorDeEntidad } from "@/components/ui/selector-de-entidad";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_OPTIONS } from "./complete-appointment-dialog";
import {
  horaActual,
  walkInCompleto,
  type Client,
  type Professional,
  type Service,
  type WalkInForm,
} from "./schemas";

interface WalkInDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: WalkInForm;
  onChange: (form: WalkInForm) => void;
  professionals: Professional[];
  clients: Client[];
  services: Service[];
  selectedServices: string[];
  onToggleService: (id: string) => void;
  saving: boolean;
  error?: string;
  /** Recarga la cartera tras dar de alta un cliente desde aqui. */
  onRecargarClientes?: () => Promise<unknown>;
  /** Recarga el equipo tras dar de alta un profesional desde aqui. */
  onRecargarProfesionales?: () => Promise<unknown>;
}

/**
 * Alta de un walk-in: se atiende primero y se anota despues, cuando hay un
 * hueco. Nace atendida y se cobra en el mismo paso, que es lo que liga el cobro
 * al servicio y al profesional y da metricas por uno y por otro.
 */
export function WalkInDialog({
  open,
  onClose,
  onSubmit,
  form,
  onChange,
  professionals,
  clients,
  services,
  selectedServices,
  onToggleService,
  saving,
  onRecargarClientes,
  onRecargarProfesionales,
  error,
}: WalkInDialogProps) {
  const set = (patch: Partial<WalkInForm>) => onChange({ ...form, ...patch });
  const total = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((suma, s) => suma + s.price, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar walk-in"
      descripcion="Alguien a quien ya se atendió hoy sin cita previa."
      icono={UserPlus}
      wide
      pie={
        <>
          <BotonDeCancelar />
          <SubmitButton
            form="walk-in"
            label={form.cobrar ? "Registrar y cobrar" : "Registrar"}
            pendingLabel="Registrando..."
            pending={saving}
            disabled={!walkInCompleto(form, selectedServices)}
          />
        </>
      }
    >
      <form id="walk-in" onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Queda como atendida, con sus puntos, y cuenta en los informes del día.
        </p>

        {/* Dos columnas: el selector necesita el ancho del nombre. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Profesional">
            <SelectorDeEntidad
              opciones={professionals.map((p) => ({
                id: p.id,
                nombre: p.name || "Sin nombre",
              }))}
              value={form.professionalId}
              onChange={(id) => set({ professionalId: id })}
              placeholder="Buscar profesional..."
              etiquetaDeAlta="Crear profesional"
              rutaDeAlta={rutaDeAlta("/dashboard/professionals")}
              onRecargarOpciones={onRecargarProfesionales}
              required
            />
          </Field>
          <Field label="Cliente">
            <SelectorDeEntidad
              opciones={clients.map((c) => ({ id: c.id, nombre: c.name }))}
              value={form.clientId}
              onChange={(id) => set({ clientId: id })}
              placeholder="Buscar cliente..."
              etiquetaDeAlta="Crear cliente"
              rutaDeAlta={rutaDeAlta("/dashboard/clients")}
              onRecargarOpciones={onRecargarClientes}
              required
            />
          </Field>
          <Field label="Hora a la que se atendió" className="sm:col-span-2">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              // Solo hacia atrás: un walk-in se anota después de atenderlo.
              max={horaActual()}
              required
            />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium" id="walkin-servicios">
            Servicios
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="walkin-servicios"
          >
            {services.map((s) => {
              const elegido = selectedServices.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onToggleService(s.id)}
                  aria-pressed={elegido}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    elegido
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-primary"
                  }`}
                >
                  {s.name} — {formatCurrency(s.price)}
                </button>
              );
            })}
            {services.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No hay servicios disponibles
              </p>
            )}
          </div>
        </div>

        <Field label="Notas">
          <Textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
          />
        </Field>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" id="walkin-cobrar">
                Cobrar ahora
              </p>
              <p className="text-muted-foreground text-xs">
                {/* Cobrar sin cita deja el cobro desligado del servicio y del
                    profesional, que es de donde salen las métricas. */}
                Deja el cobro ligado a lo que se hizo y a quién lo hizo.
              </p>
            </div>
            <Switch
              checked={form.cobrar}
              onCheckedChange={(cobrar) => set({ cobrar })}
              aria-labelledby="walkin-cobrar"
            />
          </div>

          {form.cobrar && (
            <>
              <RadioGroup
                options={PAYMENT_METHOD_OPTIONS}
                value={form.metodo}
                onChange={(metodo) => set({ metodo })}
                label="Método de pago"
              />
              {form.metodo === "TRANSFER" && (
                <Field label="Referencia">
                  <Input
                    placeholder="#123456789"
                    value={form.referencia}
                    onChange={(e) => set({ referencia: e.target.value })}
                  />
                </Field>
              )}
              <p className="text-sm">
                <span className="font-medium">Total:</span>{" "}
                {formatCurrency(total)}
              </p>
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
}
