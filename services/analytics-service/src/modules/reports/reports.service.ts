import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>,
  ) {}

  async getRevenueReport(businessId: string, from: string, to: string) {
    const metrics = await this.dailyRepo.find({
      where: { businessId, date: Between(from, to) },
      order: { date: "ASC" },
    });

    const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.totalRevenue), 0);
    const totalAppointments = metrics.reduce((sum, m) => sum + m.totalAppointments, 0);
    const avgTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

    return {
      period: { from, to },
      summary: {
        totalRevenue,
        totalAppointments,
        avgTicket: Math.round(avgTicket),
        days: metrics.length,
      },
      daily: metrics,
    };
  }

  async getProfessionalsReport(businessId: string, from: string, to: string) {
    const metrics = await this.profRepo.find({
      where: { businessId, date: Between(from, to) },
      order: { professionalId: "ASC", date: "ASC" },
    });

    const byProfessional: Record<string, { appointments: number; revenue: number; avgRating: number; days: number }> = {};

    for (const m of metrics) {
      if (!byProfessional[m.professionalId]) {
        byProfessional[m.professionalId] = { appointments: 0, revenue: 0, avgRating: 0, days: 0 };
      }
      byProfessional[m.professionalId].appointments += m.appointments;
      byProfessional[m.professionalId].revenue += Number(m.revenue);
      byProfessional[m.professionalId].avgRating += Number(m.rating);
      byProfessional[m.professionalId].days += 1;
    }

    for (const id of Object.keys(byProfessional)) {
      const p = byProfessional[id];
      p.avgRating = p.days > 0 ? Math.round((p.avgRating / p.days) * 100) / 100 : 0;
    }

    return {
      period: { from, to },
      professionals: Object.entries(byProfessional).map(([professionalId, data]) => ({
        professionalId,
        ...data,
      })),
    };
  }

  async getAppointmentsReport(businessId: string, from: string, to: string) {
    const metrics = await this.dailyRepo.find({
      where: { businessId, date: Between(from, to) },
      order: { date: "ASC" },
    });

    const total = metrics.reduce((sum, m) => sum + m.totalAppointments, 0);
    const completed = metrics.reduce((sum, m) => sum + m.completedAppointments, 0);
    const cancelled = metrics.reduce((sum, m) => sum + m.cancelledAppointments, 0);
    const noShow = metrics.reduce((sum, m) => sum + m.noShowAppointments, 0);

    return {
      period: { from, to },
      summary: { total, completed, cancelled, noShow },
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
      daily: metrics,
    };
  }
}
