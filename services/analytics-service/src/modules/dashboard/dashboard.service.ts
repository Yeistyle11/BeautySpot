import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>,
  ) {}

  async getKPIs(businessId: string): Promise<Record<string, unknown>> {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const last30Days = await this.dailyRepo.find({
      where: { businessId, date: Between(thirtyDaysAgo, today) },
    });

    const todayMetrics = await this.dailyRepo.findOne({ where: { businessId, date: today } });

    const totalRevenue = last30Days.reduce((sum, m) => sum + Number(m.totalRevenue), 0);
    const totalAppointments = last30Days.reduce((sum, m) => sum + m.totalAppointments, 0);
    const completedAppointments = last30Days.reduce((sum, m) => sum + m.completedAppointments, 0);
    const cancelledAppointments = last30Days.reduce((sum, m) => sum + m.cancelledAppointments, 0);
    const noShowAppointments = last30Days.reduce((sum, m) => sum + m.noShowAppointments, 0);
    const newClients = last30Days.reduce((sum, m) => sum + m.newClients, 0);
    const returningClients = last30Days.reduce((sum, m) => sum + m.returningClients, 0);

    return {
      today: todayMetrics || { totalAppointments: 0, totalRevenue: 0, completedAppointments: 0 },
      last30Days: {
        totalRevenue,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        completionRate: totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0,
        cancellationRate: totalAppointments > 0 ? Math.round((cancelledAppointments / totalAppointments) * 100) : 0,
        noShowRate: totalAppointments > 0 ? Math.round((noShowAppointments / totalAppointments) * 100) : 0,
        newClients,
        returningClients,
        avgDailyRevenue: last30Days.length > 0 ? Math.round(totalRevenue / last30Days.length) : 0,
      },
    };
  }

  async getTopProfessionals(businessId: string, limit = 10): Promise<ProfessionalMetricEntity[]> {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    return this.profRepo
      .createQueryBuilder("pm")
      .select("pm.professional_id", "professionalId")
      .addSelect("SUM(pm.appointments)", "totalAppointments")
      .addSelect("SUM(pm.revenue)", "totalRevenue")
      .addSelect("AVG(pm.rating)", "avgRating")
      .where("pm.business_id = :businessId", { businessId })
      .andWhere("pm.date BETWEEN :from AND :to", { from: thirtyDaysAgo, to: today })
      .groupBy("pm.professional_id")
      .orderBy("totalRevenue", "DESC")
      .limit(limit)
      .getRawMany();
  }

  async getRevenueChart(businessId: string, days = 30): Promise<DailyMetricEntity[]> {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    return this.dailyRepo.find({
      where: { businessId, date: Between(from, to) },
      order: { date: "ASC" },
    });
  }
}
