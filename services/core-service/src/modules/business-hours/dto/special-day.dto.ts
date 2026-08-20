import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";
import { PATRON_FECHA, esFechaValida } from "@beautyspot/shared-utils";

/** Un día que no existe en el calendario, como `2026-02-30`. */
@ValidatorConstraint({ name: "esDiaDelCalendario" })
class EsDiaDelCalendario implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) return true;
    return esFechaValida(valor);
  }

  defaultMessage(): string {
    return "Ese día no existe en el calendario";
  }
}

/** Día o rango con horario propio, o cerrado: un festivo, vacaciones, media jornada. */
export class CreateSpecialDayDto {
  @IsOptional() @IsUUID() branchId?: string;

  @Matches(PATRON_FECHA, {
    message: "La fecha debe tener el formato AAAA-MM-DD",
  })
  @Validate(EsDiaDelCalendario)
  startDate!: string;

  @Matches(PATRON_FECHA, {
    message: "La fecha debe tener el formato AAAA-MM-DD",
  })
  @Validate(EsDiaDelCalendario)
  endDate!: string;

  /** Cerrado todo el día; con `false` hacen falta las dos horas. */
  @IsOptional() @IsBoolean() closed?: boolean;

  @IsOptional() @IsString() @MaxLength(5) openTime?: string;

  @IsOptional() @IsString() @MaxLength(5) closeTime?: string;

  @IsString()
  @MinLength(2, { message: "Escribe el motivo: es lo que se lee en la agenda" })
  @MaxLength(120)
  motivo!: string;
}
