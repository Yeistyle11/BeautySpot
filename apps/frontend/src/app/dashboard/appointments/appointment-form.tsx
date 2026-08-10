"use client";

// Formulario de creacion/edicion de una cita: cliente, profesional, servicios y horario.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { formatCurrency, toLocalDateKey } from "@/lib/utils";
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
  /** Servicio -> profesional propio; vacio = lo atiende el titular. */
  asignaciones: Record<string, string>;
  onAsignar: (serviceId: string, professionalId: string) => void;
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
  asignaciones,
  onAsignar,
  submitting,
  error,
}: AppointmentFormProps) {
  const set = (patch: Partial<FormValues>) => onChange({ ...form, ...patch });
  const faltas = clients.find((c) => c.id === form.clientId)?.noShowCount ?? 0;

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
            {faltas > 0 && (
              <p role="status" className="text-warning mt-1.5 text-xs">
                Este cliente no se presentó {faltas}{" "}
                {faltas === 1 ? "vez" : "veces"}.
              </p>
            )}
          </Field>
          <Field label="Fecha">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
              min={toLocalDateKey(new Date())}
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

            {selectedServices.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  Los servicios se atienden en el orden en que se eligieron.
                  Asigna otro profesional a los que no haga el titular.
                </p>
                {selectedServices.map((id, i) => {
                  const servicio = services.find((s) => s.id === id);
                  return (
                    <div
                      key={id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="text-muted-foreground w-5">
                        {i + 1}.
                      </span>
                      <span className="min-w-32 flex-1">
                        {servicio?.name ?? "Servicio"}
                      </span>
                      <Select
                        aria-label={`Profesional de ${servicio?.name ?? "el servicio"}`}
                        className="w-48"
                        value={asignaciones[id] ?? ""}
                        onChange={(e) => onAsignar(id, e.target.value)}
                      >
                        <option value="">El titular de la cita</option>
                        {professionals.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || "Sin nombre"}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
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
