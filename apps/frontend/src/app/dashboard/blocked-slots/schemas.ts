import { z } from "zod";

/** Bloqueo de agenda tal y como lo devuelve booking. */
export const blockedSlotSchema = z.object({
  id: z.string(),
  professionalId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().nullable().default(null),
  /** Presente solo si el bloqueo se creó repetido. */
  serieId: z.string().nullable().default(null),
});
export type BlockedSlot = z.infer<typeof blockedSlotSchema>;

/** Profesional del negocio, para elegir de quién es la agenda. */
export const professionalSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const PROFESSIONALS_KEY = "/core/professionals";

/** Ruta de los bloqueos de un profesional; el negocio lo pone el gateway. */
export const blockedSlotsPath = (professionalId: string) =>
  `/booking/professionals/${professionalId}/blocked-slots`;

export const emptyForm = {
  date: "",
  startTime: "",
  endTime: "",
  reason: "",
  /** Vacío = un solo día. */
  repeticion: "",
  repetirHasta: "",
};
export type BlockedSlotForm = typeof emptyForm;

/** Lo que espera el backend; los campos vacíos no se mandan. */
export function toBlockedSlotPayload(form: BlockedSlotForm) {
  return {
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    reason: form.reason || undefined,
    repeticion: form.repeticion || undefined,
    repetirHasta: form.repeticion ? form.repetirHasta : undefined,
  };
}
