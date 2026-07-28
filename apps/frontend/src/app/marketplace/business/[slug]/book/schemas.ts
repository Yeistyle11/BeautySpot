// Esquemas Zod y tipos del flujo de reserva publica.
import { z } from "zod";

export const profileSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

/** Respuesta de `GET /marketplace/profiles/:slug`, que envuelve el perfil. */
export const profileResponseSchema = z.object({
  profile: profileSchema,
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  duration: z.number(),
});
export type Service = z.infer<typeof serviceSchema>;

export const professionalSchema = z.object({
  id: z.string(),
  professionalId: z.string().nullish(),
  name: z.string(),
  photo: z.string().nullable(),
  specialties: z.array(z.string()),
});
export type Professional = z.infer<typeof professionalSchema>;

export interface BookingConfirmation {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  totalAmount?: number | string;
  services?: string[];
  [key: string]: unknown;
}

export const BOOKING_STEPS = [
  { n: 1, label: "Servicios" },
  { n: 2, label: "Profesional" },
  { n: 3, label: "Horario" },
  { n: 4, label: "Tus datos" },
];
