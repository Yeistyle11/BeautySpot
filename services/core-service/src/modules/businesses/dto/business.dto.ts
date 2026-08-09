import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  MaxLength,
} from "class-validator";

/** Negocios de los que se piden los nombres. */
export class ResolveBusinessNamesDto {
  @IsArray() @ArrayNotEmpty() @IsUUID("4", { each: true }) ids!: string[];
}

/** Datos para crear un negocio: nombre, contacto, ubicación y preferencias regionales. */
export class CreateBusinessDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(255) logo?: string;
  @IsOptional() @IsString() @MaxLength(255) coverImage?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(255) website?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
  @IsOptional() @IsString() @MaxLength(50) businessType?: string;
}

/** Campos editables de un negocio, incluido su estado activo (todos opcionales). */
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(255) logo?: string;
  @IsOptional() @IsString() @MaxLength(255) coverImage?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(255) website?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
  @IsOptional() @IsString() @MaxLength(50) businessType?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
