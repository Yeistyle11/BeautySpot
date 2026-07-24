// Esquemas Zod, tipos y constantes de los profesionales.
import { z } from "zod";

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  photo: z.string().nullable(),
  bio: z.string().nullable(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
  specialties: z.array(z.string()),
  yearsExp: z.number(),
  rating: z.string(),
  totalReviews: z.number(),
  active: z.boolean(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

export interface AvailabilitySlot {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
}

export type DayHours = { active: boolean; startTime: string; endTime: string };

// La semana arranca en lunes (1) y cierra en domingo (0), que es como la
// numera getDay() y como espera el backend.
export const DAYS_MAP = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" },
];

export const emptyForm = {
  name: "",
  bio: "",
  specialties: "",
  yearsExp: "0",
  category: "",
  categoryId: "",
  photo: "",
  active: "true",
};

export type ProfessionalForm = typeof emptyForm;

/** Convierte el formulario (todo strings) al cuerpo que espera el backend. */
export function toProfessionalPayload(
  form: ProfessionalForm,
  categories: Category[],
  includeActive = false
) {
  const categoryName = form.categoryId
    ? categories.find((c) => c.id === form.categoryId)?.name || form.category
    : form.category;

  return {
    name: form.name,
    bio: form.bio || undefined,
    specialties: form.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    yearsExp: Number(form.yearsExp),
    category: categoryName || undefined,
    categoryId: form.categoryId || undefined,
    photo: form.photo || undefined,
    ...(includeActive ? { active: form.active === "true" } : {}),
  };
}
