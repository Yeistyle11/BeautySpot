import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

/** Fila del ranking de profesionales: citas, ingresos y valoración media agregados. */
export interface TopProfessionalResult {
  professionalId: string;
  totalAppointments: string;
  totalRevenue: string;
  avgRating: string;
}

/** Calcula los KPIs del dashboard a partir de las métricas agregadas del negocio. */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>
  ) {}

  /** KPIs del negocio: cifras de hoy y agregados/tasas de los últimos 30 días. */
  async getKPIs(businessId: string): Promise<{
    today: Pick<
      DailyMetricEntity,
      "totalAppointments" | "totalRevenue" | "completedAppointments"
    > | null;
    last30Days: {
      totalRevenue: number;
      totalAppointments: number;
      completedAppointments: number;
      cancelledAppointments: number;
      noShowAppointments: number;
      completionRate: number;
      cancellationRate: number;
      noShowRate: number;
      newClients: number;
      returningClients: number;
      avgDailyRevenue: number;
    };
  }> {
    const { today, thirtyDaysAgo } = this.dateRange(30);

    const [aggregates, todayMetrics, dayCount] = await Promise.all([
      this.dailyRepo
        .createQueryBuilder("m")
        .select("COALESCE(SUM(m.total_revenue), 0)", "totalRevenue")
        .addSelect(
          "COALESCE(SUM(m.total_appointments), 0)",
          "totalAppointments"
        )
        .addSelect(
          "COALESCE(SUM(m.completed_appointments), 0)",
          "completedAppointments"
        )
        .addSelect(
          "COALESCE(SUM(m.cancelled_appointments), 0)",
          "cancelledAppointments"
        )
        .addSelect(
          "COALESCE(SUM(m.no_show_appointments), 0)",
          "noShowAppointments"
        )
        .addSelect("COALESCE(SUM(m.new_clients), 0)", "newClients")
        .addSelect("COALESCE(SUM(m.returning_clients), 0)", "returningClients")
        .where("m.business_id = :businessId", { businessId })
        .andWhere("m.date BETWEEN :from AND :to", {
          from: thirtyDaysAgo,
          to: today,
        })
        .getRawOne<{
          totalRevenue: string;
          totalAppointments: string;
          completedAppointments: string;
          cancelledAppointments: string;
          noShowAppointments: string;
          newClients: string;
          returningClients: string;
        }>(),
      this.dailyRepo.findOne({
        where: { businessId, date: today },
      }),
      this.dailyRepo.count({
        where: { businessId, date: Between(thirtyDaysAgo, today) },
      }),
    ]);

    const agg = aggregates ?? {
      totalRevenue: "0",
      totalAppointments: "0",
      completedAppointments: "0",
      cancelledAppointments: "0",
      noShowAppointments: "0",
      newClients: "0",
      returningClients: "0",
    };
    const totalRevenue = Number(agg.totalRevenue);
    const totalAppointments = Number(agg.totalAppointments);
    const completedAppointments = Number(agg.completedAppointments);
    const cancelledAppointments = Number(agg.cancelledAppointments);
    const noShowAppointments = Number(agg.noShowAppointments);
    const newClients = Number(agg.newClients);
    const returningClients = Number(agg.returningClients);

    return {
      today: todayMetrics
        ? {
            totalAppointments: todayMetrics.totalAppointments,
            totalRevenue: todayMetrics.totalRevenue,
            completedAppointments: todayMetrics.completedAppointments,
          }
        : { totalAppointments: 0, totalRevenue: 0, completedAppointments: 0 },
      last30Days: {
        totalRevenue,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        completionRate: this.percentage(
          completedAppointments,
          totalAppointments
        ),
        cancellationRate: this.percentage(
          cancelledAppointments,
          totalAppointments
        ),
        noShowRate: this.percentage(noShowAppointments, totalAppointments),
        newClients,
        returningClients,
        avgDailyRevenue: dayCount > 0 ? Math.round(totalRevenue / dayCount) : 0,
      },
    };
  }

  /** Ranking de profesionales por ingresos en los últimos 30 días. */
  async getTopProfessionals(
    businessId: string,
    limit = 10
  ): Promise<TopProfessionalResult[]> {
    const { today, thirtyDaysAgo } = this.dateRange(30);

    const rows = await this.profRepo
      .createQueryBuilder("pm")
      .select("pm.professional_id", "professionalId")
      .addSelect("SUM(pm.appointments)", "totalAppointments")
      .addSelect("SUM(pm.revenue)", "totalRevenue")
      .addSelect("AVG(pm.rating)", "avgRating")
      .where("pm.business_id = :businessId", { businessId })
      .andWhere("pm.date BETWEEN :from AND :to", {
        from: thirtyDaysAgo,
        to: today,
      })
      .groupBy("pm.professional_id")
      .orderBy("totalRevenue", "DESC")
      .limit(limit)
      .getRawMany<TopProfessionalResult>();

    return rows;
  }

  /** Serie diaria de métricas para la gráfica de ingresos de los últimos N días. */
  async getRevenueChart(
    businessId: string,
    days = 30
  ): Promise<DailyMetricEntity[]> {
    const { today, from } = this.dateRange(days);

    return this.dailyRepo.find({
      where: { businessId, date: Between(from, today) },
      order: { date: "ASC" },
    });
  }

  /** Devuelve la fecha de hoy y la de hace N días en formato YYYY-MM-DD. */
  private dateRange(days: number): {
    today: string;
    from: string;
    thirtyDaysAgo: string;
  } {
    const today = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return { today, from, thirtyDaysAgo: from };
  }

  /** Porcentaje entero de `part` sobre `total`; 0 si el total es cero. */
  private percentage(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }
}
