// Esquemas Zod y tipos de la configuracion (cuenta, negocio y horarios).
import { z } from "zod";

// Los campos opcionales admiten null o ausencia.

export const businessDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: z.string().nullish(),
  businessType: z.string().nullish(),
  logo: z.string().nullish(),
  coverImage: z.string().nullish(),
});
export type BusinessData = z.infer<typeof businessDataSchema>;

export const businessHourSchema = z.object({
  id: z.string().nullish(),
  dayOfWeek: z.number(),
  openTime: z.string(),
  closeTime: z.string(),
  active: z.boolean(),
});
export type BusinessHour = z.infer<typeof businessHourSchema>;

// La semana arranca en lunes (1) y cierra en domingo (0), como los numera
// getDay() y como los espera el backend.
export const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export const defaultHours: BusinessHour[] = DAYS.map((d) => ({
  dayOfWeek: d.value,
  openTime: "08:00",
  closeTime: "18:00",
  active: d.value >= 1 && d.value <= 5,
}));

export interface Feedback {
  type: "error" | "success";
  message: string;
}
