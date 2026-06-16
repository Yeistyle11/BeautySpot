import { IsOptional, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

export class KpiQueryDto {
  // Futuros filtros de KPIs pueden agregarse aquí
}

export class TopProfessionalsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class RevenueChartQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  days?: number;
}
