import {
  IsOptional,
  IsString,
  IsNumber,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

/** Datos fiscales con los que se emiten las facturas del negocio. */
export class FacturacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: "La razón social no puede pasar de 200 caracteres",
  })
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "El NIT no puede pasar de 30 caracteres" })
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, {
    message: "La dirección fiscal no puede pasar de 300 caracteres",
  })
  direccionFiscal?: string;

  /** Prefijo de la numeración de las facturas. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,10}$/, {
    message: "La serie admite hasta 10 letras o números, sin espacios",
  })
  serie?: string;
}

/** Reglas de reserva y cancelación del negocio. */
export class ReservasDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  horasMinimasCancelacion?: number;
}
