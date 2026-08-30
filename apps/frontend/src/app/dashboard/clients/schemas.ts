import type { ClientForm } from "./client-form-dialog";
import { z } from "zod";

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  loyaltyPoints: z.number(),
  notes: z.string().nullable(),
  /** Fecha de nacimiento en `YYYY-MM-DD`, de la que sale la felicitación. */
  birthDate: z.string().nullish(),
  active: z.boolean(),
  /** Valores de la ficha configurable, indexados por id de campo. */
  ficha: z.record(z.string(), z.unknown()).nullish(),
  anonymizedAt: z.string().nullish(),
});
export type Client = z.infer<typeof clientSchema>;

/** Campo de la ficha, tal como lo define el negocio en Ajustes. */
export const campoDeFichaSchema = z.object({
  id: z.string(),
  etiqueta: z.string(),
  tipo: z.enum(["texto", "numero", "fecha", "si_no", "opciones"]),
  opciones: z.array(z.string()).nullish(),
  obligatorio: z.boolean(),
  orden: z.number(),
  serviceIds: z.array(z.string()).nullish(),
  active: z.boolean(),
});
export type CampoDeFicha = z.infer<typeof campoDeFichaSchema>;

export const servicioBreveSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ServicioBreve = z.infer<typeof servicioBreveSchema>;

/** Lo que el PATCH de un cliente admite cambiar. */
export interface CambiosDelCliente {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  /** Vaciar el campo borra la fecha, asi que va `null` y no `undefined`. */
  birthDate?: string | null;
}

/**
 * Compara el formulario con la ficha que se cargo y devuelve solo lo que
 * cambio. Enviar la ficha entera revertia en silencio lo que otra persona
 * hubiera guardado mientras tanto: con dos pestanas abiertas, guardar el
 * nombre devolvia el telefono a su valor viejo.
 */
export function cambiosDelCliente(
  original: ClientForm,
  actual: ClientForm
): CambiosDelCliente {
  const cambios: CambiosDelCliente = {};
  // El nombre viaja recortado: los espacios de los extremos no distinguen a
  // nadie y un nombre que solo son espacios deja la ficha sin identidad.
  if (actual.name.trim() !== original.name.trim()) {
    cambios.name = actual.name.trim();
  }
  if (actual.email !== original.email)
    cambios.email = actual.email || undefined;
  if (actual.phone !== original.phone)
    cambios.phone = actual.phone || undefined;
  if ((actual.notes ?? "") !== (original.notes ?? "")) {
    cambios.notes = actual.notes || undefined;
  }
  if (actual.birthDate !== original.birthDate) {
    cambios.birthDate = actual.birthDate || null;
  }
  return cambios;
}

export const CLIENTS_KEY = "/core/clients";
export const CLIENT_FIELDS_KEY = "/core/client-fields";
