// Esquemas Zod y tipos de la pantalla de clientes.
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

export const CLIENTS_KEY = "/core/clients";
export const CLIENT_FIELDS_KEY = "/core/client-fields";
