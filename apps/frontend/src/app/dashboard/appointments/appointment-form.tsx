"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type {
  AppointmentForm as FormValues,
  Client,
  Professional,
  Service,
} from "./schemas";

interface AppointmentFormProps {
  form: FormValues;
  onChange: (form: FormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  professionals: Professional[];
  clients: Client[];
  services: Service[];
  selectedServices: string[];
  onToggleService: (id: string) => void;
  submitting: boolean;
  error: string;
}

/**
 * Alta de cita. Los servicios se eligen como chips multiseleccion en vez de
 * con un select multiple, que en movil es practicamente inusable.
 */
export function AppointmentForm({
  form,
  onChange,
  onSubmit,
  professionals,
  clients,
  services,
  selectedServices,
  onToggleService,
  submitting,
  error,
}: AppointmentFormProps) {
  const set = (patch: Partial<FormValues>) => onChange({ ...form, ...patch });

  return (
    <Card className="mb-6 border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Nueva cita</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
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
          <Field label="Fecha">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
              required
            />
          </Field>
          <Field label="Hora inicio">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              required
            />
          </Field>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-medium" id="services-label">
              Servicios
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="services-label"
            >
              {services.map((s) => {
                const selected = selectedServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggleService(s.id)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
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

          <Field
            label="Notas (opcional)"
            className="sm:col-span-2 lg:col-span-3"
          >
            <Input
              placeholder="Notas sobre la cita..."
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>

          {error && (
            <p
              role="alert"
              className="text-destructive text-center text-sm sm:col-span-2 lg:col-span-3"
            >
              {error}
            </p>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button
              type="submit"
              disabled={submitting || selectedServices.length === 0}
            >
              {submitting ? "Creando..." : "Crear cita"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
