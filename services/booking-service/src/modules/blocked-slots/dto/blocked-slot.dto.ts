import { IsString, IsOptional, IsEnum, MaxLength } from "class-validator";
import { RepeticionDeBloqueo } from "@beautyspot/shared-types";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";
import { EsHoraDelDia } from "../../../common/es-hora-del-dia.decorator";

/** Datos para bloquear la agenda: fecha, horas y motivo opcional. */
export class CreateBlockedSlotDto {
  @EsFechaSola() date!: string;
  @EsHoraDelDia() startTime!: string;
  @EsHoraDelDia() endTime!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
  /** Ausente, el bloqueo es de un solo dia. */
  @IsOptional()
  @IsEnum(RepeticionDeBloqueo, { message: "La repetición no es válida" })
  repeticion?: RepeticionDeBloqueo;
  /** Último día que cubre la repetición, incluido. Obligatorio si hay `repeticion`. */
  @IsOptional() @EsFechaSola() repetirHasta?: string;
}

/** Día del que se piden los bloqueos de todo el equipo. */
export class BlockedSlotsDelDiaDto {
  @EsFechaSola() date!: string;
}
