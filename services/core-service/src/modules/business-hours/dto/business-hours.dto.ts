import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  Min,
  Max,
  Matches,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Forma de una hora: cuatro digitos y dos puntos. El rango se comprueba en el
 * servicio, que distingue la apertura (hasta 23:59) del cierre (hasta 24:00,
 * el dia completo) y explica cada caso; aqui solo se descarta lo que no tiene
 * forma de hora.
 */
const FORMATO_DE_HORA = /^\d{2}:\d{2}$/;

const MENSAJE_DE_HORA = "Se espera una hora con formato HH:MM";

/**
 * Tope de tramos que admite un reemplazo del horario: siete dias por sede, con
 * varios tramos al dia y margen para negocios con muchas sedes.
 */
const MAXIMO_TRAMOS = 500;

/** Un tramo horario: día de la semana (0-6) y horas de apertura y cierre. */
export class BusinessHourItemDto {
  @IsOptional() @IsString() branchId?: string;

  @Type(() => Number) @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;

  @IsString()
  @MaxLength(5)
  @Matches(FORMATO_DE_HORA, { message: MENSAJE_DE_HORA })
  openTime!: string;

  @IsString()
  @MaxLength(5)
  @Matches(FORMATO_DE_HORA, { message: MENSAJE_DE_HORA })
  closeTime!: string;

  @IsOptional() @IsBoolean() active?: boolean;
}

/** Campos editables de un tramo horario (todos opcionales). */
export class UpdateBusinessHoursDto {
  @IsOptional() @IsString() branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(FORMATO_DE_HORA, { message: MENSAJE_DE_HORA })
  openTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(FORMATO_DE_HORA, { message: MENSAJE_DE_HORA })
  closeTime?: string;

  @IsOptional() @IsBoolean() active?: boolean;
}

/** Conjunto completo de tramos horarios que reemplaza el horario del negocio. */
export class BatchUpsertDto {
  /**
   * `@IsArray` antes que `@ValidateNested`: sin el, un `hours` que no sea una
   * lista entra igual en la validacion de cada elemento y llega al servicio sin
   * garantia de forma.
   */
  @IsArray({ message: "El horario se envia como una lista de tramos" })
  @ArrayMaxSize(MAXIMO_TRAMOS, {
    message: `El horario no admite mas de ${MAXIMO_TRAMOS} tramos`,
  })
  @ValidateNested({ each: true })
  @Type(() => BusinessHourItemDto)
  hours!: BusinessHourItemDto[];
}
