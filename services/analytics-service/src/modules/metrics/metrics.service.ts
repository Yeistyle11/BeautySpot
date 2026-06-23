import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

@Injectable()
export class MetricsService {

  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>,
  ) {}

  async upsertDailyMetric(data: {
    businessId: string;
    date: string;
    totalAppointments?: number;
    completedAppointments?: number;
    cancelledAppointments?: number;
    noShowAppointments?: number;
    totalRevenue?: number;
    newClients?: number;
    returningClients?: number;
  }): Promise<DailyMetricEntity> {
    const existing = await this.dailyRepo.findOne({
      where: { businessId: data.businessId, date: data.date },
    });

    if (existing) {
      if (data.totalAppointments !== undefined) existing.totalAppointments = data.totalAppointments;
      if (data.completedAppointments !== undefined) existing.completedAppointments = data.completedAppointments;
      if (data.cancelledAppointments !== undefined) existing.cancelledAppointments = data.cancelledAppointments;
      if (data.noShowAppointments !== undefined) existing.noShowAppointments = data.noShowAppointments;
      if (data.totalRevenue !== undefined) existing.totalRevenue = data.totalRevenue;
      if (data.newClients !== undefined) existing.newClients = data.newClients;
      if (data.returningClients !== undefined) existing.returningClients = data.returningClients;
      return this.dailyRepo.save(existing);
    }

    return this.dailyRepo.save(this.dailyRepo.create(data));
  }

  async upsertProfessionalMetric(data: {
    businessId: string;
    professionalId: string;
    date: string;
    appointments?: number;
    revenue?: number;
    rating?: number;
    avgServiceTime?: number;
  }): Promise<ProfessionalMetricEntity> {
    const existing = await this.profRepo.findOne({
      where: {
        businessId: data.businessId as any,
        professionalId: data.professionalId as any,
        date: data.date as any,
      } as any,
    });

    if (existing) {
      if (data.appointments !== undefined) existing.appointments = data.appointments;
      if (data.revenue !== undefined) existing.revenue = data.revenue;
      if (data.rating !== undefined) existing.rating = data.rating;
      if (data.avgServiceTime !== undefined) existing.avgServiceTime = data.avgServiceTime;
      return this.profRepo.save(existing);
    }

    return this.profRepo.save(this.profRepo.create(data));
  }

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
}
