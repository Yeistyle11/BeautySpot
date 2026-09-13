import { ConflictException } from "@nestjs/common";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";

/**
 * Rechaza la escritura si la fila cambió desde que quien edita la cargó. Sin
 * `esperado` no hay nada que cotejar y se escribe sin más, que es como se
 * comportan las rutas de un solo editor.
 *
 * El cotejo solo vale acompañado de un bloqueo sobre la fila: entre leerla y
 * escribirla cabe otro guardado, y sin bloqueo los dos pasarían la comprobación.
 */
export function rechazarSiOtroGuardoAntes(actual: Date, esperado?: Date): void {
  if (!esperado || actual.getTime() === esperado.getTime()) return;

  throw new ConflictException({
    error: {
      code: CODIGO_EDICION_SIMULTANEA,
      message:
        "Otra persona guardó cambios mientras editabas. Recarga para ver cómo ha quedado.",
    },
  });
}
