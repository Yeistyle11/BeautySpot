import { IsOptional, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";
import { RangoQueryDto } from "../../../common/rango.dto";

/** Parámetros de la consulta de KPIs del dashboard. */
export class KpiQueryDto {
  // Futuros filtros de KPIs pueden agregarse aquí
}

/** Parámetros del ranking de profesionales: cuántos y de qué periodo. */
export class TopProfessionalsQueryDto extends RangoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

/** Parámetros de la gráfica de ingresos (número de días). */
export class RevenueChartQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  days?: number;
}
