import { z } from "zod";

export const businessDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  businessType: z.string().optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
});
export type BusinessData = z.infer<typeof businessDataSchema>;

export const businessHourSchema = z.object({
  id: z.string().optional(),
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
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
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
