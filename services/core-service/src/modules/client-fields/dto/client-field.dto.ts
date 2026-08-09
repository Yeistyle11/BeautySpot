import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
  IsUUID,
  Min,
  MaxLength,
  ArrayMaxSize,
  ValidateIf,
  ArrayNotEmpty,
} from "class-validator";
import { TipoDeCampo } from "../../../entities/campo-de-ficha.entity";

/** Opciones que admite una lista desplegable; el tope evita fichas ingobernables. */
const MAXIMO_OPCIONES = 30;

/** Campo nuevo de la ficha del cliente. */
export class CreateClientFieldDto {
  @IsString({ message: "La etiqueta es obligatoria" })
  @MaxLength(100, { message: "La etiqueta no puede pasar de 100 caracteres" })
  etiqueta!: string;

  @IsEnum(TipoDeCampo, { message: "El tipo de campo no es válido" })
  tipo!: TipoDeCampo;

  /** Solo tiene sentido con `tipo: opciones`, y ahí no puede venir vacía. */
  @ValidateIf((o: { tipo?: TipoDeCampo }) => o.tipo === TipoDeCampo.OPCIONES)
  @IsArray()
  @ArrayNotEmpty({ message: "Un campo de opciones necesita al menos una" })
  @ArrayMaxSize(MAXIMO_OPCIONES, {
    message: `No se pueden definir más de ${MAXIMO_OPCIONES} opciones`,
  })
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  opciones?: string[];

  @IsOptional() @IsBoolean() obligatorio?: boolean;

  @IsOptional() @IsInt() @Min(0) orden?: number;

  /** Vacío o ausente = el campo aplica a todo cliente del negocio. */
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  serviceIds?: string[];
}

/** Campos editables de un campo de ficha (todos opcionales). */
export class UpdateClientFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "La etiqueta no puede pasar de 100 caracteres" })
  etiqueta?: string;

  @IsOptional()
  @IsEnum(TipoDeCampo, { message: "El tipo de campo no es válido" })
  tipo?: TipoDeCampo;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAXIMO_OPCIONES, {
    message: `No se pueden definir más de ${MAXIMO_OPCIONES} opciones`,
  })
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  opciones?: string[];

  @IsOptional() @IsBoolean() obligatorio?: boolean;

  @IsOptional() @IsInt() @Min(0) orden?: number;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  serviceIds?: string[];

  @IsOptional() @IsBoolean() active?: boolean;
}
