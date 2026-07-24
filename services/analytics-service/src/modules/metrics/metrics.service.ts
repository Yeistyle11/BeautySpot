import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

/** Incrementos a aplicar sobre los contadores de la métrica diaria de un negocio. */
export interface DailyMetricIncrements {
  totalAppointments?: number;
  completedAppointments?: number;
  cancelledAppointments?: number;
  noShowAppointments?: number;
  totalRevenue?: number;
  newClients?: number;
  returningClients?: number;
}

/** Incrementos a aplicar sobre los contadores de la métrica de un profesional. */
export interface ProfessionalMetricIncrements {
  appointments?: number;
  revenue?: number;
}

/**
 * Acumula las métricas diarias del negocio y de cada profesional de forma atómica
 * (INSERT ... ON CONFLICT), y las consulta por rango de fechas para los reportes.
 */
@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  /**
   * Incrementa atomically contadores de la métrica diaria.
   * Usa INSERT ... ON CONFLICT DO UPDATE (atomic, race-free).
   * El unique constraint (business_id, date) garantiza idempotencia del target.
   */
  async incrementDailyMetric(
    businessId: string,
    date: string,
    increments: DailyMetricIncrements
  ): Promise<void> {
    const cols = this.buildDailyIncrementColumns(increments);
    if (cols.length === 0) return;

    const setClauses = cols.map(
      ([col]) => `${col} = COALESCE(daily_metrics.${col}, 0) + EXCLUDED.${col}`
    );

    await this.dataSource.query(
      `INSERT INTO daily_metrics (id, business_id, date, ${cols
        .map(([col]) => col)
        .join(", ")})
       VALUES (gen_random_uuid(), $1, $2, ${cols
         .map((_, i) => `$${i + 3}`)
         .join(", ")})
       ON CONFLICT (business_id, date) DO UPDATE SET
         ${setClauses.join(", ")}`,
      [businessId, date, ...cols.map(([, val]) => val)]
    );
  }

  /**
   * Incrementa atomically contadores de la métrica profesional.
   * Usa INSERT ... ON CONFLICT DO UPDATE (atomic, race-free).
   * El unique constraint (business_id, professional_id, date) garantiza idempotencia del target.
   */
  async incrementProfessionalMetric(
    businessId: string,
    professionalId: string,
    date: string,
    increments: ProfessionalMetricIncrements
  ): Promise<void> {
    const cols = this.buildProfIncrementColumns(increments);
    if (cols.length === 0) return;

    const setClauses = cols.map(
      ([col]) =>
        `${col} = COALESCE(professional_metrics.${col}, 0) + EXCLUDED.${col}`
    );

    await this.dataSource.query(
      `INSERT INTO professional_metrics (id, business_id, professional_id, date, ${cols
        .map(([col]) => col)
        .join(", ")})
       VALUES (gen_random_uuid(), $1, $2, $3, ${cols
         .map((_, i) => `$${i + 4}`)
         .join(", ")})
       ON CONFLICT (business_id, professional_id, date) DO UPDATE SET
         ${setClauses.join(", ")}`,
      [businessId, professionalId, date, ...cols.map(([, val]) => val)]
    );
  }

  /**
   * Set absoluto del rating promedio de un profesional en una fecha.
   * El rating es un valor absoluto (no acumulable), por lo que usa SET en vez de INCREMENT.
   */
  async setProfessionalRating(
    businessId: string,
    professionalId: string,
    date: string,
    rating: number
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO professional_metrics (id, business_id, professional_id, date, rating)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (business_id, professional_id, date) DO UPDATE SET
         rating = EXCLUDED.rating`,
      [businessId, professionalId, date, rating]
    );
  }

  /** Devuelve las métricas diarias del negocio y de sus profesionales en un rango de fechas. */
  async getMetrics(businessId: string, from: string, to: string) {
    const [daily, professional] = await Promise.all([
      this.dailyRepo.find({
        where: { businessId, date: Between(from, to) },
        order: { date: "DESC" },
      }),
      this.profRepo.find({
        where: { businessId, date: Between(from, to) },
        order: { date: "DESC", professionalId: "ASC" },
        take: 100,
      }),
    ]);

    return { daily, professional };
  }

  /** Traduce los incrementos diarios recibidos a pares [columna, valor] no vacíos. */
  private buildDailyIncrementColumns(
    inc: DailyMetricIncrements
  ): [string, number][] {
    const cols: [string, number][] = [];
    if (inc.totalAppointments)
      cols.push(["total_appointments", inc.totalAppointments]);
    if (inc.completedAppointments)
      cols.push(["completed_appointments", inc.completedAppointments]);
    if (inc.cancelledAppointments)
      cols.push(["cancelled_appointments", inc.cancelledAppointments]);
    if (inc.noShowAppointments)
      cols.push(["no_show_appointments", inc.noShowAppointments]);
    if (inc.totalRevenue) cols.push(["total_revenue", inc.totalRevenue]);
    if (inc.newClients) cols.push(["new_clients", inc.newClients]);
    if (inc.returningClients)
      cols.push(["returning_clients", inc.returningClients]);
    return cols;
  }

  /** Traduce los incrementos de profesional recibidos a pares [columna, valor] no vacíos. */
  private buildProfIncrementColumns(
    inc: ProfessionalMetricIncrements
  ): [string, number][] {
    const cols: [string, number][] = [];
    if (inc.appointments) cols.push(["appointments", inc.appointments]);
    if (inc.revenue) cols.push(["revenue", inc.revenue]);
    return cols;
  }
}
