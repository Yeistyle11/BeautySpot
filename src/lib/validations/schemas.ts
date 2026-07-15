import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const passwordField = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  );

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: passwordField,
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token es requerido"),
  password: passwordField,
});

export const profileSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordField.optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: "Debes ingresar tu contraseña actual",
      path: ["currentPassword"],
    }
  );

export const serviceSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  description: z
    .string()
    .min(10, "La descripción debe tener al menos 10 caracteres"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  duration: z.number().positive("La duración debe ser mayor a 0"),
  category: z.string().min(1, "Selecciona una categoría"),
  image: z.string().optional(),
});

export const serviceUpdateSchema = serviceSchema
  .extend({
    name: z.string().min(2).optional(),
    description: z.string().min(10).optional(),
    price: z.number().positive().optional(),
    duration: z.number().positive().optional(),
    category: z.string().min(1).optional(),
    active: z.boolean().optional(),
  })
  .partial();

export const professionalCreateSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  password: passwordField,
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  yearsExp: z.number().min(0).max(50).optional(),
  image: z.string().optional(),
});

export const professionalUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  yearsExp: z.number().min(0).max(50).optional(),
  image: z.string().optional(),
  active: z.boolean().optional(),
  password: passwordField.optional(),
});

export const appointmentCreateSchema = z.object({
  serviceIds: z.array(z.number()).min(1, "Selecciona al menos un servicio"),
  professionalId: z.number().min(1, "Selecciona un profesional"),
  date: z.string().min(1, "Selecciona una fecha"),
  startTime: z.string().min(1, "Selecciona una hora"),
  notes: z.string().optional(),
});

export const appointmentUpdateSchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().optional(),
});

export const appointmentRescheduleSchema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  startTime: z.string().min(1, "Selecciona una hora"),
});

export const appointmentCancelSchema = z.object({
  cancelReason: z.string().optional(),
});

export const reviewSchema = z.object({
  appointmentId: z.number().min(1, "Selecciona una cita"),
  professionalId: z.number().min(1, "Selecciona un profesional"),
  rating: z
    .number()
    .min(1, "La calificación mínima es 1")
    .max(5, "La calificación máxima es 5"),
  comment: z.string().optional(),
});

export const professionalServiceSchema = z.object({
  professionalId: z.number().min(1, "Selecciona un profesional"),
  serviceId: z.number().min(1, "Selecciona un servicio"),
});

export const blockedSlotSchema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  startTime: z.string().min(1, "Selecciona una hora de inicio"),
  endTime: z.string().min(1, "Selecciona una hora de fin"),
  reason: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type ProfessionalCreateInput = z.infer<typeof professionalCreateSchema>;
export type ProfessionalUpdateInput = z.infer<typeof professionalUpdateSchema>;
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
