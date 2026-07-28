// Forma de una cita tal y como la devuelve `GET /booking/appointments`.
//
// Es el schema canonico: la agenda del panel, el historial del cliente y el
// panel del rol CLIENT consumen el mismo endpoint, y mantener una copia por
// pantalla hacia que se desincronizaran de una en una.
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
