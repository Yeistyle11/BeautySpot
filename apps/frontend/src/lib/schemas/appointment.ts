// Forma de una cita tal y como la devuelve `GET /booking/appointments`.
// Schema canonico, compartido por la agenda del panel, el historial del cliente
// y el panel del rol CLIENT.
import { z } from "zod";

export const appointmentServiceSchema = z.object({
  serviceName: z.string(),
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
  totalAmount: z.number(),
  businessId: z.string(),
  professionalId: z.string(),
  clientId: z.string(),
  appointmentServices: z.array(appointmentServiceSchema),
});

export type Appointment = z.infer<typeof appointmentSchema>;

/**
 * Negocio tal como lo publica `GET /core/public/businesses`. El historial del
 * cliente lo usa para poner nombre al negocio de cada cita, que en la cita solo
 * viaja como identificador.
 */
export const negocioPublicoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  city: z.string().nullish(),
});
export type NegocioPublico = z.infer<typeof negocioPublicoSchema>;

/** Citas del negocio, paginadas en la forma `{ data, meta }`. */
export const APPOINTMENTS_KEY = "/booking/appointments";

/** Citas del cliente autenticado, de todos los negocios donde haya reservado. */
export const MY_APPOINTMENTS_KEY = "/booking/appointments/mine";

/**
 * Resena vinculada a una cita. Solo se consulta para saber si la cita ya tiene
 * resena, asi que basta con el id y la cita a la que apunta.
 */
export const reviewSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

/** Hueco de la jornada, con `available` a false si ya esta ocupado. */
export const availabilitySlotSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  available: z.boolean(),
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
