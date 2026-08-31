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
  /**
   * El precio depende del profesional y todavia no hay ninguno elegido: lo que
   * se enseña es el del catalogo, y se dice «desde».
   */
  precioVariable: z.boolean().nullish(),
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

/**
 * Lo que hace falta para reservar. Al menos una via de contacto: sin telefono
 * ni correo el negocio no puede confirmar la vispera, ni avisar de un retraso,
 * ni recolocar el hueco si el cliente cancela, y el cliente no puede recuperar
 * su cita porque no dejo rastro con el que identificarse.
 */
export function datosDeReservaCompletos(guest: {
  name: string;
  email: string;
  phone: string;
}): boolean {
  return Boolean(
    guest.name.trim() && (guest.email.trim() || guest.phone.trim())
  );
}

export const BOOKING_STEPS = [
  { n: 1, label: "Servicios" },
  { n: 2, label: "Profesional" },
  { n: 3, label: "Horario" },
  { n: 4, label: "Tus datos" },
];
