import { BadRequestException } from "@nestjs/common";
import {
  IsOptional,
  IsBoolean,
  Validate,
  ValidatorConstraint,
} from "class-validator";
import type { ValidatorConstraintInterface } from "class-validator";
import { Transform } from "class-transformer";
import { esFechaValida } from "@beautyspot/shared-utils";

/**
 * Comprueba que el día exista de verdad.
 *
 * Un `2026-02-30` tiene la forma de una fecha y no lo es; colarlo produce un
 * rango que Postgres rechaza o, peor, uno que compara contra una fecha inválida
 * y devuelve cifras vacías sin decir por qué.
 */
@ValidatorConstraint({ name: "esDiaDelCalendario" })
class EsDiaDelCalendario implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === "string" && esFechaValida(valor);
  }

  defaultMessage(): string {
    return "Debe ser una fecha real en formato AAAA-MM-DD";
  }
}

/**
 * Periodo sobre el que se piden las cifras.
 *
 * Los dos extremos son opcionales y van juntos: quien no elige periodo recibe
 * el de por defecto de cada endpoint, y quien elige uno tiene que decir dónde
 * empieza y dónde acaba.
 */
export class RangoQueryDto {
  @IsOptional()
  @Validate(EsDiaDelCalendario)
  from?: string;

  @IsOptional()
  @Validate(EsDiaDelCalendario)
  to?: string;

  /** Si además se quieren las cifras del periodo anterior, para comparar. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  comparar?: boolean;
}

/** Periodo ya resuelto y comprobado, tal como lo consumen los agregados. */
export interface Rango {
  from: string;
  to: string;
}

/**
 * Valida el par de fechas que llega por la consulta.
 *
 * Un rango invertido no se corrige dando la vuelta a los extremos: quien lo
 * envía cree estar pidiendo otra cosa, y unas cifras que no se parecen a lo que
 * pidió son peores que un error.
 */
export function rangoPedido(query: RangoQueryDto): Rango | null {
  if (!query.from && !query.to) return null;

  if (!query.from || !query.to) {
    throw new BadRequestException(
      "El periodo necesita fecha de inicio y de fin"
    );
  }

  if (query.from > query.to) {
    throw new BadRequestException(
      "La fecha de inicio del periodo es posterior a la de fin"
    );
  }

  return { from: query.from, to: query.to };
}

/**
 * Periodo inmediatamente anterior y de la misma duración, que es contra el que
 * se compara.
 *
 * Se cuenta en días y no en meses a propósito: comparar febrero contra enero
 * mezcla un mes de 28 días con uno de 31, y la diferencia que sale no es la del
 * negocio sino la del calendario.
 */
export function periodoAnterior(rango: Rango): Rango {
  const dias = diasEntre(rango.from, rango.to);
  return {
    from: sumarDias(rango.from, -dias),
    to: sumarDias(rango.from, -1),
  };
}

/** Días que abarca el periodo, extremos incluidos. */
export function diasEntre(from: string, to: string): number {
  const unDia = 24 * 60 * 60 * 1000;
  const inicio = Date.parse(`${from}T00:00:00Z`);
  const fin = Date.parse(`${to}T00:00:00Z`);
  return Math.round((fin - inicio) / unDia) + 1;
}

/** Día resultante de sumar (o restar) días a una fecha de calendario. */
export function sumarDias(fecha: string, dias: number): string {
  const movida = new Date(`${fecha}T00:00:00Z`);
  movida.setUTCDate(movida.getUTCDate() + dias);
  return movida.toISOString().slice(0, 10);
}
