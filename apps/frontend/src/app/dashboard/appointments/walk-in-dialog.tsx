"use client";

// Dialogo para registrar un walk-in: alguien que entro sin cita y ya se atendio.
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
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
}

/**
 * Alta de un walk-in. Buena parte de la clientela de una barberia entra sin
 * cita: se atiende primero y se anota despues, cuando hay un hueco. Nace
 * atendida y se cobra en el mismo paso, que es la unica forma de que el cobro
 * quede ligado al servicio y al profesional —y de que las metricas por uno y
 * por otro dejen de estar vacias—.
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
  error,
}: WalkInDialogProps) {
  const set = (patch: Partial<WalkInForm>) => onChange({ ...form, ...patch });
  const total = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((suma, s) => suma + s.price, 0);

  return (
    <Dialog open={open} onClose={onClose} title="Registrar walk-in" wide>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          Para alguien a quien ya se atendió hoy sin cita previa. Queda como
          atendida, con sus puntos, y cuenta en los informes del día.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Profesional">
            <Select
              value={form.professionalId}
              onChange={(e) => set({ professionalId: e.target.value })}
              required
            >
              <option value="">Seleccionar...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Sin nombre"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cliente">
            <Select
              value={form.clientId}
              onChange={(e) => set({ clientId: e.target.value })}
              required
            >
              <option value="">Seleccionar...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hora a la que se atendió">
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

        <div className="flex gap-3 pt-2">
          <SubmitButton
            label={form.cobrar ? "Registrar y cobrar" : "Registrar"}
            pendingLabel="Registrando..."
            pending={saving}
            disabled={!walkInCompleto(form, selectedServices)}
          />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
