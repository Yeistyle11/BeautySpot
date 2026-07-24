import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
  MaxLength,
} from "class-validator";

/** Datos para crear un servicio: nombre, descripción, precio, duración y categoría. */
export class CreateServiceDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(1000) description!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(5) duration!: number;
  @IsString() @MaxLength(100) category!: string;
  @IsOptional() @IsString() image?: string;
}

/** Campos editables de un servicio (todos opcionales). */
export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(5) duration?: number;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
