/** Estados por los que pasa una cita a lo largo de su ciclo de vida. */
export enum AppointmentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

/**
 * Cada cuanto se repite un bloqueo de agenda: `SEMANAL` cae en el mismo dia de
 * la semana y `DIARIA` cubre dias seguidos.
 */
export enum RepeticionDeBloqueo {
  DIARIA = "DIARIA",
  SEMANAL = "SEMANAL",
}

/** Motivos por los que se cancela una cita. */
export enum CancelReason {
  CLIENTE_CANCELA = "CLIENTE_CANCELA",
  NEGOCIO_CANCELA = "NEGOCIO_CANCELA",
  PROFESIONAL_NO_DISPONIBLE = "PROFESIONAL_NO_DISPONIBLE",
  DUPLICADA = "DUPLICADA",
  OTRO = "OTRO",
}

/**
 * Cómo se le explica al cliente por qué se canceló su cita, redactado desde su
 * lado y no como el desplegable del personal. Lo comparten el correo y el panel,
 * para que no digan cosas distintas del mismo motivo.
 */
export const MOTIVO_PARA_EL_CLIENTE: Record<CancelReason, string> = {
  [CancelReason.CLIENTE_CANCELA]: "Cancelaste la cita",
  [CancelReason.NEGOCIO_CANCELA]: "El negocio canceló la cita",
  [CancelReason.PROFESIONAL_NO_DISPONIBLE]: "El profesional no está disponible",
  [CancelReason.DUPLICADA]: "La cita estaba duplicada",
  [CancelReason.OTRO]: "Otro motivo",
};

/**
 * Motivo tipificado, redactado para el cliente. Nunca devuelve la nota interna:
 * ese texto se escribe «para el historial» y no está pensado para salir del
 * negocio.
 */
export function motivoParaElCliente(motivo?: string | null): string {
  return (
    MOTIVO_PARA_EL_CLIENTE[motivo as CancelReason] ?? "Sin motivo especificado"
  );
}
