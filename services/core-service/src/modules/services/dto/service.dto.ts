import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
  MaxLength,
  IsUUID,
} from "class-validator";

/**
 * Datos para crear un servicio. Solo el nombre, el precio y la duración son
 * obligatorios; la descripción y la categoría se rellenan si se quiere.
 */
export class CreateServiceDto {
  @IsString({ message: "El nombre es obligatorio" })
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  name!: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: "La descripción no puede pasar de 1000 caracteres",
  })
  description?: string;
  @IsNumber({}, { message: "El precio debe ser un número" })
  @Min(0, { message: "El precio no puede ser negativo" })
  price!: number;
  @IsNumber({}, { message: "La duración debe ser un número" })
  @Min(5, { message: "La duración mínima es de 5 minutos" })
  duration!: number;
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "La categoría no puede pasar de 100 caracteres" })
  category?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsNumber() @Min(0) procesadoDesde?: number;
  @IsOptional() @IsNumber() @Min(1) procesadoMinutos?: number;
  @IsOptional() @IsNumber() @Min(0) bufferDespues?: number;
}

/** Campos editables de un servicio (todos opcionales). */
export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(5) duration?: number;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  // La coherencia con `duration` la comprueba `ServicesService`.
  @IsOptional() @IsNumber() @Min(0) procesadoDesde?: number | null;
  @IsOptional() @IsNumber() @Min(1) procesadoMinutos?: number | null;
  @IsOptional() @IsNumber() @Min(0) bufferDespues?: number;
}
