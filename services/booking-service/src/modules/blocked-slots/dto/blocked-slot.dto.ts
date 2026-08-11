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
  /** Sin esto el bloqueo es de un solo día. */
  @IsOptional()
  @IsEnum(RepeticionDeBloqueo, { message: "La repetición no es válida" })
  repeticion?: RepeticionDeBloqueo;
  /** Último día que cubre la repetición, incluido. Obligatorio si hay `repeticion`. */
  @IsOptional() @EsFechaSola() repetirHasta?: string;
}
