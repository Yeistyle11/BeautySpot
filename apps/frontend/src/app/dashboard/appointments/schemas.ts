// Esquemas Zod y tipos de las citas usados en la seccion de agenda.
import { z } from "zod";

export { appointmentSchema, type Appointment } from "@/lib/schemas/appointment";

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  duration: z.number(),
});
export type Service = z.infer<typeof serviceSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Citas a las que no se presento; el formulario avisa antes de reservarle. */
  noShowCount: z.number().nullish(),
});
export type Client = z.infer<typeof clientSchema>;

/** Solo lo que hace falta para poner nombre a una cita de la lista. */
export const clientNameSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ClientName = z.infer<typeof clientNameSchema>;

export const emptyForm = {
  professionalId: "",
  clientId: "",
  date: "",
  startTime: "",
  notes: "",
};

export type AppointmentForm = typeof emptyForm;

/**
 * Alta de un walk-in: quien entro sin cita, ya se atendio y se anota despues.
 * Sin fecha, porque solo se registra el dia en que se atendio, y con el cobro
 * en el mismo paso, que es como ocurre en el mostrador.
 */
export const emptyWalkInForm = {
  professionalId: "",
  clientId: "",
  /** Hora a la que se le atendio, ya pasada. */
  startTime: "",
  notes: "",
  cobrar: true,
  metodo: "CASH",
  referencia: "",
};

export type WalkInForm = typeof emptyWalkInForm;

/** Hora actual en formato `HH:MM`, que es a la que se propone anotarlo. */
export function horaActual(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

/** Si el walk-in esta listo para registrarse. */
export function walkInCompleto(form: WalkInForm, servicios: string[]): boolean {
  return Boolean(
    form.professionalId && form.clientId && form.startTime && servicios.length
  );
}

/** Cuerpo del alta del walk-in; la fecha la pone el servicio. */
export function walkInParaEnviar(
  form: WalkInForm,
  serviceIds: string[],
  asignaciones: Record<string, string>
) {
  const propias = Object.entries(asignaciones)
    .filter(([serviceId, professionalId]) =>
      Boolean(professionalId && serviceIds.includes(serviceId))
    )
    .map(([serviceId, professionalId]) => ({ serviceId, professionalId }));

  return {
    professionalId: form.professionalId,
    clientId: form.clientId,
    serviceIds,
    startTime: form.startTime,
    notes: form.notes || undefined,
    asignaciones: propias.length ? propias : undefined,
  };
}

/** Motivos de cancelacion que acepta el backend, en el orden en que se ofrecen. */
export const MOTIVOS_DE_CANCELACION = [
  { value: "CLIENTE_CANCELA", label: "El cliente canceló" },
  { value: "NEGOCIO_CANCELA", label: "Cancela el negocio" },
  { value: "PROFESIONAL_NO_DISPONIBLE", label: "El profesional no está" },
  { value: "DUPLICADA", label: "Cita duplicada" },
  { value: "OTRO", label: "Otro motivo" },
] as const;

/** Etiqueta del motivo con el que se cancelo una cita. */
export function etiquetaDeMotivo(motivo: string | null | undefined): string {
  return (
    MOTIVOS_DE_CANCELACION.find((m) => m.value === motivo)?.label ??
    "Sin motivo registrado"
  );
}

export const APPOINTMENTS_KEY = "/booking/appointments";
export const PROFESSIONALS_KEY = "/core/professionals";
export const SERVICES_KEY = "/core/services";
export const CLIENTS_KEY = "/core/clients?limit=100";
/** Nombres de los clientes que hay en pantalla, por lista de ids. */
export const CLIENT_NAMES_KEY = "/core/clients/names";
