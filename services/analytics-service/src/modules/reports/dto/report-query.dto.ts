import { IsDateString } from "class-validator";

/** Rango de fechas (desde/hasta) que acota los reportes y consultas de métricas. */
export class DateRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
