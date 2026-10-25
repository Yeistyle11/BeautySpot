import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  MENSAJE_TELEFONO,
  PATRON_TELEFONO,
} from "@beautyspot/shared-constants";
import { EsFechaDeNacimiento } from "@beautyspot/nest-common";

/**
 * Campos editables del perfil propio: nombre, teléfono, avatar y fecha de
 * nacimiento. Se validan como en el registro.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: "El nombre es obligatorio" })
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  @MaxLength(120, { message: "El nombre no puede pasar de 120 caracteres" })
  name?: string;

  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida lo que se escriba.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  /** Para felicitar al cliente en su cumpleaños; `null` la quita. */
  @EsFechaDeNacimiento()
  birthDate?: string | null;
}
