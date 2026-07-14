import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { MetricsService } from "./metrics.service";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";

describe("MetricsService", () => {
  let service: MetricsService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;
  let mockDataSource: jest.Mocked<DataSource>;

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

  const mockProfessionalMetric: ProfessionalMetricEntity = {
    id: "prof-metrics-123",
    businessId: "business-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    appointments: 8,
    revenue: 400000,
    rating: 4.8,
    avgServiceTime: 45,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockDailyRepo = {
      find: jest.fn(),
    } as any;

    mockProfRepo = {
      find: jest.fn(),
    } as any;

    mockDataSource = {
      query: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: getRepositoryToken(DailyMetricEntity),
          useValue: mockDailyRepo,
        },
        {
          provide: getRepositoryToken(ProfessionalMetricEntity),
          useValue: mockProfRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  describe("incrementDailyMetric", () => {
    it("debería ejecutar query ON CONFLICT con incrementos", async () => {
      await service.incrementDailyMetric("business-123", "2024-01-15", {
        totalAppointments: 1,
        totalRevenue: 50000,
      });

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO daily_metrics");
      expect(sql).toContain("ON CONFLICT (business_id, date) DO UPDATE");
      expect(sql).toContain("total_appointments = COALESCE");
      expect(params).toContain("business-123");
      expect(params).toContain("2024-01-15");
      expect(params).toContain(1);
      expect(params).toContain(50000);
    });

    it("no debería ejecutar query si no hay incrementos", async () => {
      await service.incrementDailyMetric("business-123", "2024-01-15", {});

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it("debería incluir solo las columnas proporcionadas", async () => {
      await service.incrementDailyMetric("business-123", "2024-01-15", {
        completedAppointments: 1,
      });

      const [sql] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("completed_appointments");
      expect(sql).not.toContain("total_appointments");
      expect(sql).not.toContain("total_revenue");
    });
  });

  describe("incrementProfessionalMetric", () => {
    it("debería ejecutar query ON CONFLICT con incrementos", async () => {
      await service.incrementProfessionalMetric(
        "business-123",
        "prof-123",
        "2024-01-15",
        { appointments: 1, revenue: 40000 }
      );

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO professional_metrics");
      expect(sql).toContain(
        "ON CONFLICT (business_id, professional_id, date) DO UPDATE"
      );
      expect(params).toContain("business-123");
      expect(params).toContain("prof-123");
      expect(params).toContain("2024-01-15");
    });

    it("no debería ejecutar query si no hay incrementos", async () => {
      await service.incrementProfessionalMetric(
        "business-123",
        "prof-123",
        "2024-01-15",
        {}
      );

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe("setProfessionalRating", () => {
    it("debería ejecutar query ON CONFLICT con SET absoluto", async () => {
      await service.setProfessionalRating(
        "business-123",
        "prof-123",
        "2024-01-15",
        4.5
      );

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("INSERT INTO professional_metrics");
      expect(sql).toContain("ON CONFLICT");
      expect(sql).toContain("rating = EXCLUDED.rating");
      expect(params).toContain(4.5);
    });
  });

  describe("getMetrics", () => {
    it("debería retornar métricas diarias y profesionales", async () => {
      const dailyMetrics = [
        mockDailyMetric,
        { ...mockDailyMetric, date: "2024-01-16" } as any,
      ];
      const profMetrics = [
        mockProfessionalMetric,
        { ...mockProfessionalMetric, date: "2024-01-16" } as any,
      ];

      mockDailyRepo.find.mockResolvedValue(dailyMetrics);
      mockProfRepo.find.mockResolvedValue(profMetrics);

      const result = await service.getMetrics(
        "business-123",
        "2024-01-15",
        "2024-01-16"
      );

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", date: expect.any(Object) },
        order: { date: "DESC" },
      });
      expect(mockProfRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", date: expect.any(Object) },
        order: { date: "DESC", professionalId: "ASC" },
        take: 100,
      });
      expect(result).toEqual({
        daily: dailyMetrics,
        professional: profMetrics,
      });
    });

    it("debería retornar arrays vacíos si no hay datos", async () => {
      mockDailyRepo.find.mockResolvedValue([]);
      mockProfRepo.find.mockResolvedValue([]);

      const result = await service.getMetrics(
        "business-123",
        "2024-01-15",
        "2024-01-16"
      );

      expect(result.daily).toEqual([]);
      expect(result.professional).toEqual([]);
    });
  });
});
