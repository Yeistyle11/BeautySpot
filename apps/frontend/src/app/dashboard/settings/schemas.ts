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

/** Tipos de dato que puede pedir un campo de la ficha del cliente. */
export const TIPOS_DE_CAMPO = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "fecha", label: "Fecha" },
  { value: "si_no", label: "Sí / No" },
  { value: "opciones", label: "Lista de opciones" },
] as const;

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

/** Servicio del catálogo, para elegir a cuáles aplica un campo. */
export const servicioBreveSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ServicioBreve = z.infer<typeof servicioBreveSchema>;

export interface Feedback {
  type: "error" | "success";
  message: string;
}

/** Datos fiscales con los que el negocio emite sus facturas. */
export const facturacionSchema = z.object({
  razonSocial: z.string().nullish(),
  nit: z.string().nullish(),
  direccionFiscal: z.string().nullish(),
  serie: z.string().nullish(),
});
export type Facturacion = z.infer<typeof facturacionSchema>;

export const FACTURACION_KEY = "/core/business-config/facturacion";

/** Reglas de reserva y cancelación del negocio. */
export const reservasSchema = z.object({
  horasMinimasCancelacion: z.number().nullish(),
});
export type Reservas = z.infer<typeof reservasSchema>;

export const RESERVAS_KEY = "/core/business-config/reservas";
