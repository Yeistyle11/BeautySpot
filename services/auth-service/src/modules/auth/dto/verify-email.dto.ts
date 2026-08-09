import { IsString } from "class-validator";

/** Token del enlace de confirmación de correo. */
export class VerifyEmailDto {
  @IsString()
  token!: string;
}
