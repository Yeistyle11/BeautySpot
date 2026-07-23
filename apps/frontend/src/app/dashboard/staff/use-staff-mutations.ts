"use client";

import { api } from "@/lib/api";
import type { EditForm, Professional, StaffMember } from "./schemas";

/**
 * Guarda todos los cambios de una cuenta.
 *
 * Cada seccion del formulario pega contra un endpoint distinto (datos,
 * contrasena, estado, vinculo con el profesional), asi que se agrupan aqui.
 * Se lanzan en paralelo porque son independientes entre si; la validacion de
 * la contrasena va antes de disparar nada para no dejar el resto aplicado si
 * no coincide.
 *
 * Aviso: si una de las llamadas falla, las otras ya se habran aplicado. El
 * backend no expone una operacion transaccional para esto, asi que la pagina
 * recarga los datos tras el error para reflejar lo que si se guardo.
 */
export async function saveMemberChanges(
  member: StaffMember,
  form: EditForm,
  linkedPro: Professional | undefined
): Promise<void> {
  if (form.newPassword && form.newPassword !== form.confirmPassword) {
    throw new Error("Las contrasenas no coinciden");
  }

  const requests: Promise<unknown>[] = [
    api.patch(`/auth/users/${member.id}/staff`, {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
    }),
  ];

  if (form.newPassword) {
    requests.push(
      api.post(`/auth/users/${member.id}/reset-password`, {
        newPassword: form.newPassword,
      })
    );
  }

  // El OWNER no se puede desactivar: se quedaria sin acceso al negocio.
  if (form.active !== member.active && member.role !== "OWNER") {
    requests.push(
      api.patch(`/auth/users/${member.id}/status`, { active: form.active })
    );
  }

  if (
    form.professionalId &&
    form.role === "PROFESSIONAL" &&
    linkedPro?.id !== form.professionalId
  ) {
    requests.push(
      api.patch(`/core/professionals/${form.professionalId}/link-user`, {
        userId: member.id,
      })
    );
  }

  if (form.unlinkProfessional && linkedPro) {
    requests.push(
      api.patch(`/core/professionals/${linkedPro.id}/unlink-user`, {})
    );
  }

  await Promise.all(requests);
}

/** Alta de cuenta y, si procede, vinculo con un perfil profesional existente. */
export async function createMember(form: {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: string;
  professionalId: string;
}): Promise<void> {
  const created = await api.post<{ id: string; role: string }>(
    "/auth/users/staff",
    {
      email: form.email,
      password: form.password,
      name: form.name,
      phone: form.phone || undefined,
      role: form.role,
    }
  );

  if (form.professionalId && form.role === "PROFESSIONAL") {
    await api.patch(`/core/professionals/${form.professionalId}/link-user`, {
      userId: created.id,
    });
  }
}

/** Filtra y ordena la lista de cuentas segun la busqueda y la columna activa. */
export function filterAndSortStaff(
  staff: StaffMember[],
  search: string,
  sortField: keyof StaffMember | "active",
  sortDir: "asc" | "desc"
): StaffMember[] {
  const query = search.toLowerCase();
  return staff
    .filter(
      (s) =>
        !query ||
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query)
    )
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "active") cmp = Number(b.active) - Number(a.active);
      else {
        const left = String(a[sortField as keyof StaffMember] ?? "");
        const right = String(b[sortField as keyof StaffMember] ?? "");
        cmp = left.localeCompare(right);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
}
