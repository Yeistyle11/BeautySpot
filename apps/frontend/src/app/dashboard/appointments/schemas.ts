// Esquemas Zod y tipos de las citas usados en la seccion de agenda.
import { z } from "zod";

export const appointmentSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  // Decimal en la base que el numericTransformer entrega como número.
  totalAmount: z.number(),
  professionalId: z.string(),
  clientId: z.string(),
  appointmentServices: z.array(
    z.object({
      serviceName: z.string(),
      // Decimal en la base que el numericTransformer entrega como número.
      price: z.number(),
      duration: z.number(),
    })
  ),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  duration: z.number(),
});
export type Service = z.infer<typeof serviceSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Client = z.infer<typeof clientSchema>;

export const emptyForm = {
  professionalId: "",
  clientId: "",
  date: "",
  startTime: "",
  notes: "",
};

export type AppointmentForm = typeof emptyForm;

export const APPOINTMENTS_KEY = "/booking/appointments";
export const PROFESSIONALS_KEY = "/core/professionals";
export const SERVICES_KEY = "/core/services";
// El endpoint pagina de 20 en 20; el desplegable necesita la lista completa.
export const CLIENTS_KEY = "/core/clients?limit=100";
