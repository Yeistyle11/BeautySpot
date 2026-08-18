import { Transform } from "class-transformer";
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEmail,
  IsObject,
  IsUUID,
  Matches,
  ValidateIf,
  MaxLength,
  Validate,
  ValidatorConstraint,
} from "class-validator";
import type { ValidatorConstraintInterface } from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";
import { PATRON_FECHA, esFechaValida } from "@beautyspot/shared-utils";

/**
 * Un nacimiento en un día que no existe.
 *
 * Se comprueba aparte del formato porque `2026-02-30` tiene los ocho dígitos y
 * los dos guiones: el patrón lo deja pasar y lo rechaza Postgres al guardarlo,
 * que es un 500 en vez de un "corrige la fecha".
 */
@ValidatorConstraint({ name: "esDiaDeNacimiento" })
class EsDiaDeNacimiento implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) return true;
    return esFechaValida(valor);
  }

  defaultMessage(): string {
    return "Esa fecha de nacimiento no existe en el calendario";
  }
}

/**
 * Datos para registrar un cliente: nombre, contacto, notas y etiquetas.
 *
 * El teléfono se valida de formato porque es el canal por el que el negocio
 * avisa y recuerda las citas: un texto libre ahí es un cliente inalcanzable.
 */
export class CreateClientDto {
  @IsString({ message: "El nombre es obligatorio" })
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  name!: string;
  @IsOptional()
  @ValidateIf((o: { email?: string }) => !!o.email)
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  @MaxLength(255, { message: "El email no puede pasar de 255 caracteres" })
  email?: string;
  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida el formato de lo
  // que se haya escrito.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "El documento no puede pasar de 30 caracteres" })
  documento?: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Las notas no pueden pasar de 1000 caracteres" })
  notes?: string;
  /** Fecha de nacimiento, de la que sale la felicitación de cumpleaños. */
  @IsOptional()
  @Matches(PATRON_FECHA, {
    message: "La fecha de nacimiento debe tener el formato AAAA-MM-DD",
  })
  @Validate(EsDiaDeNacimiento)
  birthDate?: string | null;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsArray() tags?: string[];
  /**
   * Valores de la ficha que el negocio se haya definido, por id de campo. Se
   * declara aquí porque el `ValidationPipe` global descarta lo que no esté en el
   * DTO; el contenido lo contrasta `ClientsService` con los campos del negocio.
   */
  @IsOptional() @IsObject() ficha?: Record<string, unknown>;
}

/** Tope de identificadores por consulta; la agenda pinta como mucho una página de citas. */
const MAXIMO_IDS = 200;

/**
 * Identificadores de los clientes cuyo nombre se pide.
 *
 * Llegan como lista separada por comas y se acotan: sin tope, un `?ids=` largo
 * arma un `IN (...)` de miles de elementos con una sola petición.
 */
export class ClientNamesDto {
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, MAXIMO_IDS)
      : []
  )
  @IsArray()
  @IsUUID("4", { each: true, message: "Cada id debe ser un UUID" })
  ids!: string[];
}

/** Campos editables de un cliente (todos opcionales). */
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  name?: string;
  @IsOptional()
  @ValidateIf((o: { email?: string }) => !!o.email)
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  @MaxLength(255, { message: "El email no puede pasar de 255 caracteres" })
  email?: string;
  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida el formato de lo
  // que se haya escrito.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "El documento no puede pasar de 30 caracteres" })
  documento?: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Las notas no pueden pasar de 1000 caracteres" })
  notes?: string;
  /** Fecha de nacimiento, de la que sale la felicitación de cumpleaños. */
  @IsOptional()
  @Matches(PATRON_FECHA, {
    message: "La fecha de nacimiento debe tener el formato AAAA-MM-DD",
  })
  @Validate(EsDiaDeNacimiento)
  birthDate?: string | null;
  @IsOptional() @IsArray() tags?: string[];
  /**
   * Valores de la ficha que el negocio se haya definido, por id de campo. Se
   * declara aquí porque el `ValidationPipe` global descarta lo que no esté en el
   * DTO; el contenido lo contrasta `ClientsService` con los campos del negocio.
   */
  @IsOptional() @IsObject() ficha?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}
