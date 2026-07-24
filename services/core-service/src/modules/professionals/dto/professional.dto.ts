import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsUrl,
  IsBoolean,
  MaxLength,
} from "class-validator";

/** Datos para dar de alta un profesional: nombre, bio, categoría y especialidades. */
export class CreateProfessionalDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsArray() specialties!: string[];
  @IsOptional() @IsNumber() yearsExp?: number;
  @IsOptional() @IsUrl() photo?: string;
}

/** Campos editables de un profesional (todos opcionales). */
export class UpdateProfessionalDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsArray() specialties?: string[];
  @IsOptional() @IsNumber() yearsExp?: number;
  @IsOptional() @IsUrl() photo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Datos para asignar un servicio a un profesional, con precio/duración propios opcionales. */
export class AssignServiceDto {
  @IsString() serviceId!: string;
  @IsOptional() @IsNumber() customPrice?: number;
  @IsOptional() @IsNumber() customDuration?: number;
}
