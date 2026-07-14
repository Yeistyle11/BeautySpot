import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DashboardService } from "./dashboard.service";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

describe("DashboardService", () => {
  let service: DashboardService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;

  const mockDailyMetric: DailyMetricEntity = {
    id: "metrics-123",
    businessId: "business-123",
    date: "2024-01-15",
    totalAppointments: 10,
    completedAppointments: 8,
    cancelledAppointments: 1,
    noShowAppointments: 1,
    totalRevenue: 500000,
    newClients: 3,
    returningClients: 7,
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
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    mockDailyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockProfRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
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

    service = module.get<DashboardService>(DashboardService);
  });

  describe("getKPIs", () => {
    it("debería retornar KPIs usando SQL aggregation", async () => {
      const aggResult = {
        totalRevenue: "1100000",
        totalAppointments: "22",
        completedAppointments: "18",
        cancelledAppointments: "2",
        noShowAppointments: "2",
        newClients: "6",
        returningClients: "14",
      };

      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(aggResult)
      );
      mockDailyRepo.findOne.mockResolvedValue(mockDailyMetric as any);
      mockDailyRepo.count.mockResolvedValue(2);

      const result = await service.getKPIs("business-123");

      expect(result.today as any).toEqual({
        totalAppointments: 10,
        totalRevenue: 500000,
        completedAppointments: 8,
      });
      expect(result.last30Days.totalRevenue).toBe(1100000);
      expect(result.last30Days.totalAppointments).toBe(22);
      expect(result.last30Days.completionRate).toBe(82);
      expect(result.last30Days.cancellationRate).toBe(9);
      expect(result.last30Days.noShowRate).toBe(9);
      expect(result.last30Days.avgDailyRevenue).toBe(550000);
    });

    it("debería retornar KPIs vacíos si no hay datos", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          totalRevenue: "0",
          totalAppointments: "0",
          completedAppointments: "0",
          cancelledAppointments: "0",
          noShowAppointments: "0",
          newClients: "0",
          returningClients: "0",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);
      mockDailyRepo.count.mockResolvedValue(0);

      const result = await service.getKPIs("business-123");

      expect(result.today as any).toEqual({
        totalAppointments: 0,
        totalRevenue: 0,
        completedAppointments: 0,
      });
      expect(result.last30Days.totalRevenue).toBe(0);
      expect(result.last30Days.completionRate).toBe(0);
    });

    it("debería calcular tasas correctamente cuando no hay citas", async () => {
      (mockDailyRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder({
          totalRevenue: "0",
          totalAppointments: "0",
          completedAppointments: "0",
          cancelledAppointments: "0",
          noShowAppointments: "0",
          newClients: "0",
          returningClients: "0",
        })
      );
      mockDailyRepo.findOne.mockResolvedValue(null);
      mockDailyRepo.count.mockResolvedValue(0);

      const result = await service.getKPIs("business-123");

      expect(result.last30Days.completionRate).toBe(0);
      expect(result.last30Days.cancellationRate).toBe(0);
      expect(result.last30Days.noShowRate).toBe(0);
    });
  });

  describe("getTopProfessionals", () => {
    it("debería retornar profesionales top con SQL aggregation", async () => {
      const topProfessionals = [
        {
          professionalId: "prof-123",
          totalAppointments: "20",
          totalRevenue: "800000",
          avgRating: "4.8",
        },
        {
          professionalId: "prof-456",
          totalAppointments: "15",
          totalRevenue: "600000",
          avgRating: "4.9",
        },
      ];

      (mockProfRepo.createQueryBuilder as any).mockReturnValue(
        buildQueryBuilder(topProfessionals)
      );

      const result = await service.getTopProfessionals("business-123", 10);

      expect(result).toEqual(topProfessionals);
    });

    it("debería usar límite por defecto de 10", async () => {
      const qb = buildQueryBuilder([]);
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(qb);

      await service.getTopProfessionals("business-123");

      expect(qb.limit).toHaveBeenCalledWith(10);
    });

    it("debería usar límite personalizado", async () => {
      const qb = buildQueryBuilder([]);
      (mockProfRepo.createQueryBuilder as any).mockReturnValue(qb);

      await service.getTopProfessionals("business-123", 5);

      expect(qb.limit).toHaveBeenCalledWith(5);
    });
  });

  describe("getRevenueChart", () => {
    it("debería retornar datos de ingresos ordenados por fecha", async () => {
      const revenueData = [
        { ...mockDailyMetric, date: "2024-01-15", totalRevenue: 500000 } as any,
        { ...mockDailyMetric, date: "2024-01-16", totalRevenue: 600000 } as any,
      ];

      mockDailyRepo.find.mockResolvedValue(revenueData);

      const result = await service.getRevenueChart("business-123", 30);

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", date: expect.any(Object) },
        order: { date: "ASC" },
      });
      expect(result).toEqual(revenueData);
    });

    it("debería retornar array vacío si no hay datos", async () => {
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueChart("business-123", 30);

      expect(result).toEqual([]);
    });
  });
});
