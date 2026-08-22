import { EsFechaSola } from "@beautyspot/nest-common";

/** Rango de fechas (desde/hasta) que acota los reportes y consultas de métricas. */
export class DateRangeQueryDto {
  @EsFechaSola()
  from!: string;

  @EsFechaSola()
  to!: string;
}
