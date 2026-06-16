import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { DailyMetricEntity } from '../../entities/daily-metric.entity';
import { ProfessionalMetricEntity } from '../../entities/professional-metric.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;

  const mockDailyMetric: DailyMetricEntity = {
    id: 'metrics-123',
    businessId: 'business-123',
    date: '2024-01-15',
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

  beforeEach(async () => {
    mockDailyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockProfRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    } as any;

    (mockProfRepo.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

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

  describe('getKPIs', () => {
    it('debería retornar KPIs completos', async () => {
      const last30DaysData = [
        mockDailyMetric,
        { ...mockDailyMetric, date: '2024-01-16', totalAppointments: 12, completedAppointments: 10, totalRevenue: 600000, generateId: () => {} } as any,
      ];

      const todayMetrics = {
        totalAppointments: 10,
        totalRevenue: 500000,
        completedAppointments: 8,
      };

      mockDailyRepo.find.mockResolvedValue(last30DaysData);
      mockDailyRepo.findOne.mockResolvedValue(todayMetrics as any);

      const result = await service.getKPIs('business-123');

      expect(result.today as any).toEqual({
        totalAppointments: 10,
        totalRevenue: 500000,
        completedAppointments: 8,
      });
      expect(result.last30Days as any).toEqual({
        totalRevenue: 1100000,
        totalAppointments: 22,
        completedAppointments: 18,
        cancelledAppointments: 2,
        noShowAppointments: 2,
        completionRate: 82,
        cancellationRate: 9,
        noShowRate: 9,
        newClients: 6,
        returningClients: 14,
        avgDailyRevenue: 550000,
      });
    });

    it('debería retornar KPIs vacíos si no hay datos de hoy', async () => {
      mockDailyRepo.find.mockResolvedValue([]);
      mockDailyRepo.findOne.mockResolvedValue(null);

      const result = await service.getKPIs('business-123');

      expect(result.today as any).toEqual({
        totalAppointments: 0,
        totalRevenue: 0,
        completedAppointments: 0,
      });
      expect((result.last30Days as any).totalRevenue).toBe(0);
    });

    it('debería calcular tasas correctamente cuando no hay citas', async () => {
      mockDailyRepo.find.mockResolvedValue([{ ...mockDailyMetric, totalAppointments: 0 } as any]);
      mockDailyRepo.findOne.mockResolvedValue(null);

      const result = await service.getKPIs('business-123');

      expect((result.last30Days as any).completionRate).toBe(0);
      expect((result.last30Days as any).cancellationRate).toBe(0);
      expect((result.last30Days as any).noShowRate).toBe(0);
    });
  });

  describe('getTopProfessionals', () => {
    it('debería retornar profesionales top por ingresos', async () => {
      const topProfessionals = [
        {
          professionalId: 'prof-123',
          totalAppointments: 20,
          totalRevenue: 800000,
          avgRating: 4.8,
        },
        {
          professionalId: 'prof-456',
          totalAppointments: 15,
          totalRevenue: 600000,
          avgRating: 4.9,
        },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(topProfessionals),
      } as any;

      (mockProfRepo.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

      const result = await service.getTopProfessionals('business-123', 10);

      expect(result).toEqual(topProfessionals);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('debería usar límite por defecto de 10', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any;

      (mockProfRepo.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

      await service.getTopProfessionals('business-123');

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('debería usar límite personalizado', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      } as any;

      (mockProfRepo.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

      await service.getTopProfessionals('business-123', 5);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('getRevenueChart', () => {
    it('debería retornar datos de ingresos ordenados por fecha', async () => {
      const revenueData = [
        { ...mockDailyMetric, date: '2024-01-15', totalRevenue: 500000 } as any,
        { ...mockDailyMetric, date: '2024-01-16', totalRevenue: 600000 } as any,
      ];

      mockDailyRepo.find.mockResolvedValue(revenueData);

      const result = await service.getRevenueChart('business-123', 30);

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', date: expect.any(Object) },
        order: { date: 'ASC' },
      });
      expect(result).toEqual(revenueData);
    });

    it('debería usar días personalizados', async () => {
      mockDailyRepo.find.mockResolvedValue([]);

      await service.getRevenueChart('business-123', 7);

      expect(mockDailyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'business-123',
            date: expect.any(Object),
          }),
        })
      );
    });

    it('debería retornar array vacío si no hay datos', async () => {
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueChart('business-123', 30);

      expect(result).toEqual([]);
    });
  });
});