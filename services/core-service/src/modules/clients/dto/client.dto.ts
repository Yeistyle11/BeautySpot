import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from "class-validator";

/** Datos para registrar un cliente: nombre, contacto, notas y etiquetas. */
export class CreateClientDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsArray() tags?: string[];
}

/** Campos editables de un cliente (todos opcionales). */
export class UpdateClientDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
