// Esquemas Zod, tipos y formularios de los miembros del equipo.
import { z } from "zod";

export const staffMemberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  avatar: z.string().nullable(),
  active: z.boolean(),
  membershipId: z.string(),
  role: z.string(),
  membershipActive: z.boolean(),
  joinedAt: z.string(),
  professionalId: z.string().nullable().optional(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  userId: z.string().nullable(),
  active: z.boolean(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Dueno",
  ADMIN: "Administrador",
  PROFESSIONAL: "Profesional",
  RECEPTIONIST: "Recepcionista",
  CLIENT: "Cliente",
};

// Paleta categorica por rol (no semantica): cada rol tiene su color para
// distinguirlos de un vistazo en la tabla.
export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  OWNER: "bg-amber-100 text-amber-700",
  ADMIN: "bg-blue-100 text-blue-700",
  PROFESSIONAL: "bg-green-100 text-green-700",
  RECEPTIONIST: "bg-cyan-100 text-cyan-700",
  CLIENT: "bg-muted text-muted-foreground",
};

/** Roles que forman el equipo del negocio; el resto se lista como clientes. */
export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "PROFESSIONAL",
  "RECEPTIONIST",
];

export type SortField = "name" | "email" | "role" | "active" | "joinedAt";
export type SortDir = "asc" | "desc";

export const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  role: "PROFESSIONAL",
  professionalId: "",
};

export const emptyEditForm = {
  name: "",
  email: "",
  phone: "",
  newPassword: "",
  confirmPassword: "",
  role: "" as string,
  active: true,
  professionalId: "",
  unlinkProfessional: false,
};

export type EditForm = typeof emptyEditForm;
