import { z } from "zod";

export const profileSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  duration: z.number(),
});
export type Service = z.infer<typeof serviceSchema>;

export const professionalSchema = z.object({
  id: z.string(),
  professionalId: z.string().optional(),
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

/**
 * Franjas de media hora entre las 8 y las 18.
 *
 * Solo se usa con la opcion "cualquier profesional": ahi no hay una agenda
 * concreta que consultar, asi que se ofrece el horario comercial y el backend
 * rechaza la reserva si al confirmar ya no queda hueco.
 */
export function generateFallbackSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour < 18) slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return slots;
}
