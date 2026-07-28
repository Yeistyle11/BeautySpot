// Forma de una cita tal y como la devuelve `GET /booking/appointments`.
//
// Es el schema canonico: la agenda del panel, el historial del cliente y el
// panel del rol CLIENT consumen el mismo endpoint, asi que comparten una sola
// definicion en vez de una copia por pantalla.
import { z } from "zod";

export const appointmentServiceSchema = z.object({
  serviceName: z.string(),
  // Decimal en la base que el numericTransformer entrega como número.
  price: z.number(),
  duration: z.number(),
});

export const appointmentSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  // Decimal en la base que el numericTransformer entrega como número.
  totalAmount: z.number(),
  professionalId: z.string(),
  clientId: z.string(),
  appointmentServices: z.array(appointmentServiceSchema),
});

export type Appointment = z.infer<typeof appointmentSchema>;

/** El endpoint de citas siempre pagina: nunca devuelve un array pelado. */
export const APPOINTMENTS_KEY = "/booking/appointments";

/**
 * Citas del cliente autenticado. Va por su propia ruta porque la de gestion
 * esta limitada al personal del negocio y filtra por tenant, y un cliente no
 * pertenece a ninguno.
 */
export const MY_APPOINTMENTS_KEY = "/booking/appointments/mine";

/**
 * Hueco devuelto por `GET /booking/appointments/availability`. El endpoint
 * enumera toda la jornada marcando cuales quedan libres, no solo las horas
 * disponibles.
 */
export const availabilitySlotSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  available: z.boolean(),
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
