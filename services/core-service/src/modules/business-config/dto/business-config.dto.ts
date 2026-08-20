import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  Matches,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";
import {
  COLORES_DE_NIVEL,
  MAXIMO_NIVELES_FIDELIDAD,
  type ColorDeNivel,
} from "@beautyspot/shared-constants";

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

/** Escalón del programa de fidelidad. */
export class NivelDto {
  /** Puntos a partir de los cuales se alcanza el nivel. */
  @IsInt()
  @Min(0)
  min!: number;

  @IsString()
  @MaxLength(30, {
    message: "El nombre del nivel no puede pasar de 30 caracteres",
  })
  label!: string;

  @IsIn(COLORES_DE_NIVEL, {
    message: `El color debe ser uno de: ${COLORES_DE_NIVEL.join(", ")}`,
  })
  color!: ColorDeNivel;
}

/**
 * Comprueba lo que no se puede expresar nivel a nivel: que el primero arranque
 * en cero, que los umbrales suban y que ningun nombre se repita.
 */
@ValidatorConstraint({ name: "escalaDeNiveles" })
export class EscalaDeNiveles implements ValidatorConstraintInterface {
  private mensaje = "";

  validate(niveles: NivelDto[]): boolean {
    if (!Array.isArray(niveles)) return false;

    if (niveles[0]?.min !== 0) {
      this.mensaje = "El primer nivel tiene que arrancar en 0 puntos";
      return false;
    }

    for (let i = 1; i < niveles.length; i++) {
      if (niveles[i].min <= niveles[i - 1].min) {
        this.mensaje = "Cada nivel tiene que pedir más puntos que el anterior";
        return false;
      }
    }

    const nombres = niveles.map((n) => n.label.trim().toLowerCase());
    if (new Set(nombres).size !== nombres.length) {
      this.mensaje = "Hay dos niveles con el mismo nombre";
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return this.mensaje;
  }
}

/** Programa de fidelidad del negocio: los escalones por los que pasa el cliente. */
export class FidelizacionDto {
  @IsArray()
  @ArrayNotEmpty({ message: "El programa necesita al menos un nivel" })
  @ArrayMaxSize(MAXIMO_NIVELES_FIDELIDAD, {
    message: `El programa no puede pasar de ${MAXIMO_NIVELES_FIDELIDAD} niveles`,
  })
  @ValidateNested({ each: true })
  @Type(() => NivelDto)
  @Validate(EscalaDeNiveles)
  niveles!: NivelDto[];
}
