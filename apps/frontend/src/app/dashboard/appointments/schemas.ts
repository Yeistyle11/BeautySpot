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
