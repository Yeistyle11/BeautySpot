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
