import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

interface ProfessionalAggRow {
  professionalId: string;
  appointments: string;
  revenue: string;
  avgRating: string;
  days: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>
  ) {}

  async getRevenueReport(businessId: string, from: string, to: string) {
    const [aggregates, daily, dayCount] = await Promise.all([
      this.dailyRepo
        .createQueryBuilder("m")
        .select("COALESCE(SUM(m.total_revenue), 0)", "totalRevenue")
        .addSelect(
          "COALESCE(SUM(m.total_appointments), 0)",
          "totalAppointments"
        )
        .where("m.business_id = :businessId", { businessId })
        .andWhere("m.date BETWEEN :from AND :to", { from, to })
        .getRawOne<{ totalRevenue: string; totalAppointments: string }>(),
      this.dailyRepo.find({
        where: { businessId, date: Between(from, to) },
        order: { date: "ASC" },
      }),
      this.dailyRepo.count({
        where: { businessId, date: Between(from, to) },
      }),
    ]);

    const totalRevenue = Number(aggregates?.totalRevenue ?? 0);
    const totalAppointments = Number(aggregates?.totalAppointments ?? 0);
    const avgTicket =
      totalAppointments > 0 ? Math.round(totalRevenue / totalAppointments) : 0;

    return {
      period: { from, to },
      summary: { totalRevenue, totalAppointments, avgTicket, days: dayCount },
      daily,
    };
  }

  async getProfessionalsReport(businessId: string, from: string, to: string) {
    const rows = await this.profRepo
      .createQueryBuilder("pm")
      .select("pm.professional_id", "professionalId")
      .addSelect("SUM(pm.appointments)", "appointments")
      .addSelect("SUM(pm.revenue)", "revenue")
      .addSelect("AVG(pm.rating)", "avgRating")
      .addSelect("COUNT(*)", "days")
      .where("pm.business_id = :businessId", { businessId })
      .andWhere("pm.date BETWEEN :from AND :to", { from, to })
      .groupBy("pm.professional_id")
      .orderBy("pm.professional_id", "ASC")
      .getRawMany<ProfessionalAggRow>();

    return {
      period: { from, to },
      professionals: rows.map((row) => ({
        professionalId: row.professionalId,
        appointments: Number(row.appointments),
        revenue: Number(row.revenue),
        avgRating: Math.round(Number(row.avgRating) * 100) / 100,
        days: Number(row.days),
      })),
    };
  }

  async getAppointmentsReport(businessId: string, from: string, to: string) {
    const [aggregates, daily] = await Promise.all([
      this.dailyRepo
        .createQueryBuilder("m")
        .select("COALESCE(SUM(m.total_appointments), 0)", "total")
        .addSelect("COALESCE(SUM(m.completed_appointments), 0)", "completed")
        .addSelect("COALESCE(SUM(m.cancelled_appointments), 0)", "cancelled")
        .addSelect("COALESCE(SUM(m.no_show_appointments), 0)", "noShow")
        .where("m.business_id = :businessId", { businessId })
        .andWhere("m.date BETWEEN :from AND :to", { from, to })
        .getRawOne<{
          total: string;
          completed: string;
          cancelled: string;
          noShow: string;
        }>(),
      this.dailyRepo.find({
        where: { businessId, date: Between(from, to) },
        order: { date: "ASC" },
      }),
    ]);

    const total = Number(aggregates?.total ?? 0);
    const completed = Number(aggregates?.completed ?? 0);
    const cancelled = Number(aggregates?.cancelled ?? 0);
    const noShow = Number(aggregates?.noShow ?? 0);

    return {
      period: { from, to },
      summary: { total, completed, cancelled, noShow },
      completionRate: this.percentage(completed, total),
      cancellationRate: this.percentage(cancelled, total),
      noShowRate: this.percentage(noShow, total),
      daily,
    };
  }

  private percentage(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }
}
