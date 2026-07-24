import { IsOptional, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

/** Parámetros de la consulta de KPIs del dashboard. */
export class KpiQueryDto {
  // Futuros filtros de KPIs pueden agregarse aquí
}

/** Parámetros del ranking de profesionales (límite de resultados). */
export class TopProfessionalsQueryDto {
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
