// Esquemas Zod, tipos y formularios de los miembros del equipo.
import { z } from "zod";
import type { BadgeProps } from "@/components/ui/badge";

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

// Variante de `Badge` por rol. El uso es categorico, no semantico: son las seis
// que el sistema distingue entre si, y responden al tema claro y al oscuro.
export const ROLE_BADGE: Record<string, BadgeProps["variant"]> = {
  SUPER_ADMIN: "accent",
  OWNER: "warning",
  ADMIN: "info",
  PROFESSIONAL: "success",
  RECEPTIONIST: "muted",
  CLIENT: "outline",
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
