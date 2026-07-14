import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportsService } from "./reports.service";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

describe("ReportsService", () => {
  let service: ReportsService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;

  const mockDailyMetric: DailyMetricEntity = {
    id: "daily-1",
    businessId: "business-123",
    date: "2026-06-15",
    totalRevenue: 50000,
    totalAppointments: 10,
    completedAppointments: 8,
    cancelledAppointments: 1,
    noShowAppointments: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const buildQueryBuilder = (result: unknown) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    mockDailyRepo = {
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockProfRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(DailyMetricEntity),
          useValue: mockDailyRepo,
        },
        {
          provide: getRepositoryToken(ProfessionalMetricEntity),
          useValue: mockProfRepo,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe("getRevenueReport", () => {
    it("debería calcular el reporte de ingresos con SQL aggregation", async () => {
      const aggResult = { totalRevenue: "90000", totalAppointments: "18" };
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.count.mockResolvedValue(2);
      mockDailyRepo.find.mockResolvedValue([mockDailyMetric] as any);

      const result = await service.getRevenueReport(
        "business-123",
        "2026-06-14",
        "2026-06-15"
      );

      expect(result.summary.totalRevenue).toBe(90000);
      expect(result.summary.totalAppointments).toBe(18);
      expect(result.summary.avgTicket).toBe(5000);
      expect(result.summary.days).toBe(2);
      expect(result.period).toEqual({ from: "2026-06-14", to: "2026-06-15" });
    });

    it("debería manejar avgTicket 0 si no hay citas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({ totalRevenue: "0", totalAppointments: "0" })
      );
      mockDailyRepo.count.mockResolvedValue(1);
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueReport(
        "business-123",
        "2026-06-15",
        "2026-06-15"
      );

      expect(result.summary.avgTicket).toBe(0);
    });
  });

  describe("getProfessionalsReport", () => {
    it("debería agrupar métricas por profesional con SQL GROUP BY", async () => {
      const aggRows = [
        {
          professionalId: "prof-1",
          appointments: "9",
          revenue: "45000",
          avgRating: "4.5",
          days: "2",
        },
        {
          professionalId: "prof-2",
          appointments: "3",
          revenue: "15000",
          avgRating: "4.5",
          days: "1",
        },
      ];
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggRows)
      );

      const result = await service.getProfessionalsReport(
        "business-123",
        "2026-06-14",
        "2026-06-15"
      );

      expect(result.professionals).toHaveLength(2);
      expect(result.professionals[0].professionalId).toBe("prof-1");
      expect(result.professionals[0].appointments).toBe(9);
      expect(result.professionals[0].revenue).toBe(45000);
      expect(result.professionals[0].avgRating).toBe(4.5);
      expect(result.professionals[0].days).toBe(2);
      expect(result.professionals[1].professionalId).toBe("prof-2");
    });

    it("debería retornar array vacío si no hay métricas", async () => {
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder([])
      );

      const result = await service.getProfessionalsReport(
        "business-123",
        "2026-06-01",
        "2026-06-30"
      );

      expect(result.professionals).toHaveLength(0);
    });
  });

  describe("getAppointmentsReport", () => {
    it("debería calcular tasas con SQL aggregation", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          total: "30",
          completed: "23",
          cancelled: "4",
          noShow: "3",
        })
      );
      mockDailyRepo.find.mockResolvedValue([mockDailyMetric] as any);

      const result = await service.getAppointmentsReport(
        "business-123",
        "2026-06-14",
        "2026-06-15"
      );

      expect(result.summary.total).toBe(30);
      expect(result.summary.completed).toBe(23);
      expect(result.summary.cancelled).toBe(4);
      expect(result.summary.noShow).toBe(3);
      expect(result.completionRate).toBe(77);
      expect(result.cancellationRate).toBe(13);
      expect(result.noShowRate).toBe(10);
    });

    it("debería manejar división por cero en tasas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          total: "0",
          completed: "0",
          cancelled: "0",
          noShow: "0",
        })
      );
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getAppointmentsReport(
        "business-123",
        "2026-06-15",
        "2026-06-15"
      );

      expect(result.completionRate).toBe(0);
      expect(result.cancellationRate).toBe(0);
      expect(result.noShowRate).toBe(0);
    });
  });
});
