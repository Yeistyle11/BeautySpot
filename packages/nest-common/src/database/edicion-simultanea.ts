import { ConflictException } from "@nestjs/common";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";

/**
 * Rechaza la escritura si la fila cambió desde que quien edita la cargó. Sin
 * `esperado` escribe sin cotejar. Va sobre la fila bloqueada.
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
