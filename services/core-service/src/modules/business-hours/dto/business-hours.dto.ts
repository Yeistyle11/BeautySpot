import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

/** Un tramo horario: día de la semana (0-6) y horas de apertura y cierre. */
export class BusinessHourItemDto {
  @IsOptional() @IsString() branchId?: string;

  @Type(() => Number) @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;

  @IsString() @MaxLength(5) openTime!: string;

  @IsString() @MaxLength(5) closeTime!: string;

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

  @IsOptional() @IsString() @MaxLength(5) openTime?: string;

  @IsOptional() @IsString() @MaxLength(5) closeTime?: string;

  @IsOptional() @IsBoolean() active?: boolean;
}

/** Conjunto completo de tramos horarios que reemplaza el horario del negocio. */
export class BatchUpsertDto {
  @ValidateNested({ each: true })
  @Type(() => BusinessHourItemDto)
  hours!: BusinessHourItemDto[];
}
