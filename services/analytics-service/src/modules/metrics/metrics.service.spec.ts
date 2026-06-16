import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricsService } from './metrics.service';
import { DailyMetricEntity } from '../../entities/daily-metric.entity';
import { ProfessionalMetricEntity } from '../../entities/professional-metric.entity';

describe('MetricsService', () => {
  let service: MetricsService;
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

  const mockProfessionalMetric: ProfessionalMetricEntity = {
    id: 'prof-metrics-123',
    businessId: 'business-123',
    professionalId: 'prof-123',
    date: '2024-01-15',
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
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockProfRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
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
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  describe('upsertDailyMetric', () => {
    it('debería crear una nueva métrica diaria', async () => {
      const data = {
        businessId: 'business-123',
        date: '2024-01-15',
        totalAppointments: 10,
        completedAppointments: 8,
        cancelledAppointments: 1,
        noShowAppointments: 1,
        totalRevenue: 500000,
        newClients: 3,
        returningClients: 7,
      };

      mockDailyRepo.findOne.mockResolvedValue(null);
      mockDailyRepo.create.mockReturnValue(mockDailyMetric);
      mockDailyRepo.save.mockResolvedValue(mockDailyMetric);

      const result = await service.upsertDailyMetric(data);

      expect(mockDailyRepo.findOne).toHaveBeenCalledWith({
        where: { businessId: data.businessId, date: data.date },
      });
      expect(mockDailyRepo.create).toHaveBeenCalledWith(data);
      expect(mockDailyRepo.save).toHaveBeenCalledWith(mockDailyMetric);
      expect(result).toEqual(mockDailyMetric);
    });

    it('debería actualizar una métrica diaria existente', async () => {
      const data = {
        businessId: 'business-123',
        date: '2024-01-15',
        totalAppointments: 12,
        completedAppointments: 10,
      };

      mockDailyRepo.findOne.mockResolvedValue(mockDailyMetric);
      mockDailyRepo.save.mockResolvedValue(mockDailyMetric);

      const result = await service.upsertDailyMetric(data);

      expect(mockDailyMetric.totalAppointments).toBe(12);
      expect(mockDailyMetric.completedAppointments).toBe(10);
      expect(mockDailyRepo.save).toHaveBeenCalledWith(mockDailyMetric);
      expect(result).toEqual(mockDailyMetric);
    });

    it('debería actualizar solo campos proporcionados', async () => {
      const data = {
        businessId: 'business-123',
        date: '2024-01-15',
        totalRevenue: 600000,
      };

      const freshMetric = {
        ...mockDailyMetric,
        totalAppointments: 10,
        generateId: () => {},
      } as any;

      mockDailyRepo.findOne.mockResolvedValue(freshMetric);
      mockDailyRepo.save.mockResolvedValue(freshMetric);

      await service.upsertDailyMetric(data);

      const saveCallArg = mockDailyRepo.save.mock.calls[0][0];
      expect(saveCallArg.totalRevenue).toBe(600000);
      expect(saveCallArg.totalAppointments).toBe(10);
      expect(mockDailyRepo.save).toHaveBeenCalledWith(saveCallArg);
    });
  });

  describe('upsertProfessionalMetric', () => {
    it('debería crear una nueva métrica profesional', async () => {
      const data = {
        businessId: 'business-123',
        professionalId: 'prof-123',
        date: '2024-01-15',
        appointments: 8,
        revenue: 400000,
        rating: 4.8,
        avgServiceTime: 45,
      };

      mockProfRepo.findOne.mockResolvedValue(null);
      mockProfRepo.create.mockReturnValue(mockProfessionalMetric);
      mockProfRepo.save.mockResolvedValue(mockProfessionalMetric);

      const result = await service.upsertProfessionalMetric(data);

      expect(mockProfRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: data.businessId,
          professionalId: data.professionalId,
          date: data.date,
        },
      });
      expect(mockProfRepo.create).toHaveBeenCalledWith(data);
      expect(mockProfRepo.save).toHaveBeenCalledWith(mockProfessionalMetric);
      expect(result).toEqual(mockProfessionalMetric);
    });

    it('debería actualizar una métrica profesional existente', async () => {
      const data = {
        businessId: 'business-123',
        professionalId: 'prof-123',
        date: '2024-01-15',
        appointments: 10,
        revenue: 500000,
      };

      mockProfRepo.findOne.mockResolvedValue(mockProfessionalMetric);
      mockProfRepo.save.mockResolvedValue(mockProfessionalMetric);

      const result = await service.upsertProfessionalMetric(data);

      expect(mockProfessionalMetric.appointments).toBe(10);
      expect(mockProfessionalMetric.revenue).toBe(500000);
      expect(mockProfRepo.save).toHaveBeenCalledWith(mockProfessionalMetric);
      expect(result).toEqual(mockProfessionalMetric);
    });

    it('debería actualizar solo campos proporcionados en métrica profesional', async () => {
      const data = {
        businessId: 'business-123',
        professionalId: 'prof-123',
        date: '2024-01-15',
        rating: 5.0,
      };

      const freshMetric = {
        ...mockProfessionalMetric,
        appointments: 8,
        generateId: () => {},
      } as any;

      mockProfRepo.findOne.mockResolvedValue(freshMetric);
      mockProfRepo.save.mockResolvedValue(freshMetric);

      await service.upsertProfessionalMetric(data);

      const saveCallArg = mockProfRepo.save.mock.calls[0][0];
      expect(saveCallArg.rating).toBe(5.0);
      expect(saveCallArg.appointments).toBe(8);
      expect(mockProfRepo.save).toHaveBeenCalledWith(saveCallArg);
    });
  });

  describe('getMetrics', () => {
    it('debería retornar métricas diarias y profesionales', async () => {
      const dailyMetrics = [mockDailyMetric, { ...mockDailyMetric, date: '2024-01-16' } as any];
      const profMetrics = [mockProfessionalMetric, { ...mockProfessionalMetric, date: '2024-01-16' } as any];

      mockDailyRepo.find.mockResolvedValue(dailyMetrics);
      mockProfRepo.find.mockResolvedValue(profMetrics);

      const result = await service.getMetrics('business-123', '2024-01-15', '2024-01-16');

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', date: expect.any(Object) },
        order: { date: 'DESC' },
      });
      expect(mockProfRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', date: expect.any(Object) },
        order: { date: 'DESC', professionalId: 'ASC' },
        take: 100,
      });
      expect(result).toEqual({
        daily: dailyMetrics,
        professional: profMetrics,
      });
    });

    it('debería retornar arrays vacíos si no hay datos', async () => {
      mockDailyRepo.find.mockResolvedValue([]);
      mockProfRepo.find.mockResolvedValue([]);

      const result = await service.getMetrics('business-123', '2024-01-15', '2024-01-16');

      expect(result.daily).toEqual([]);
      expect(result.professional).toEqual([]);
    });

    it('debería limitar resultados profesionales a 100', async () => {
      mockDailyRepo.find.mockResolvedValue([mockDailyMetric]);
      mockProfRepo.find.mockResolvedValue([mockProfessionalMetric]);

      await service.getMetrics('business-123', '2024-01-15', '2024-01-16');

      expect(mockProfRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });
});