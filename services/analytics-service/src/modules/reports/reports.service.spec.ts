import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { DailyMetricEntity } from '../../entities/daily-metric.entity';
import { ProfessionalMetricEntity } from '../../entities/professional-metric.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockDailyRepo: jest.Mocked<Repository<DailyMetricEntity>>;
  let mockProfRepo: jest.Mocked<Repository<ProfessionalMetricEntity>>;

  const mockDailyMetric: DailyMetricEntity = {
    id: 'daily-1',
    businessId: 'business-123',
    date: '2026-06-15',
    totalRevenue: 50000,
    totalAppointments: 10,
    completedAppointments: 8,
    cancelledAppointments: 1,
    noShowAppointments: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfMetric: ProfessionalMetricEntity = {
    id: 'prof-1',
    businessId: 'business-123',
    professionalId: 'prof-123',
    date: '2026-06-15',
    appointments: 5,
    revenue: 25000,
    rating: 4.5,
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

  describe('getRevenueReport', () => {
    it('debería calcular el reporte de ingresos correctamente', async () => {
      const metrics = [
        { ...mockDailyMetric, date: '2026-06-14', totalRevenue: 40000, totalAppointments: 8 },
        { ...mockDailyMetric, totalRevenue: 50000, totalAppointments: 10 },
      ];

      mockDailyRepo.find.mockResolvedValue(metrics as any);

      const result = await service.getRevenueReport('business-123', '2026-06-14', '2026-06-15');

      expect(mockDailyRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', date: expect.anything() },
        order: { date: 'ASC' },
      });
      expect(result.summary.totalRevenue).toBe(90000);
      expect(result.summary.totalAppointments).toBe(18);
      expect(result.summary.avgTicket).toBe(5000); // 90000 / 18 = 5000
      expect(result.summary.days).toBe(2);
    });

    it('debería manejar avgTicket 0 si no hay citas', async () => {
      const metrics = [{ ...mockDailyMetric, totalRevenue: 0, totalAppointments: 0 }];

      mockDailyRepo.find.mockResolvedValue(metrics as any);

      const result = await service.getRevenueReport('business-123', '2026-06-15', '2026-06-15');

      expect(result.summary.avgTicket).toBe(0);
    });

    it('debería retornar el periodo correctamente', async () => {
      mockDailyRepo.find.mockResolvedValue([]);

      const result = await service.getRevenueReport('business-123', '2026-06-01', '2026-06-30');

      expect(result.period).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    });
  });

  describe('getProfessionalsReport', () => {
    it('debería agrupar métricas por profesional', async () => {
      const metrics = [
        { ...mockProfMetric, professionalId: 'prof-1', date: '2026-06-14', appointments: 4, revenue: 20000, rating: 4.0 },
        { ...mockProfMetric, professionalId: 'prof-1', date: '2026-06-15', appointments: 5, revenue: 25000, rating: 5.0 },
        { ...mockProfMetric, professionalId: 'prof-2', date: '2026-06-15', appointments: 3, revenue: 15000, rating: 4.5 },
      ];

      mockProfRepo.find.mockResolvedValue(metrics as any);

      const result = await service.getProfessionalsReport('business-123', '2026-06-14', '2026-06-15');

      expect(result.professionals).toHaveLength(2);
      
      const prof1 = result.professionals.find(p => p.professionalId === 'prof-1');
      expect(prof1).toBeDefined();
      expect(prof1?.appointments).toBe(9);
      expect(prof1?.revenue).toBe(45000);
      expect(prof1?.avgRating).toBe(4.5); // (4.0 + 5.0) / 2
      expect(prof1?.days).toBe(2);

      const prof2 = result.professionals.find(p => p.professionalId === 'prof-2');
      expect(prof2).toBeDefined();
      expect(prof2?.appointments).toBe(3);
      expect(prof2?.revenue).toBe(15000);
      expect(prof2?.avgRating).toBe(4.5);
      expect(prof2?.days).toBe(1);
    });

    it('debería retornar array vacío si no hay métricas', async () => {
      mockProfRepo.find.mockResolvedValue([]);

      const result = await service.getProfessionalsReport('business-123', '2026-06-01', '2026-06-30');

      expect(result.professionals).toHaveLength(0);
    });

    it('debería ordenar por professionalId ASC', async () => {
      mockProfRepo.find.mockResolvedValue([
        { ...mockProfMetric, professionalId: 'prof-1' },
        { ...mockProfMetric, professionalId: 'prof-2' },
      ] as any);

      const result = await service.getProfessionalsReport('business-123', '2026-06-01', '2026-06-30');

      expect(mockProfRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', date: expect.anything() },
        order: { professionalId: 'ASC', date: 'ASC' },
      });
      expect(result.professionals[0].professionalId).toBe('prof-1');
      expect(result.professionals[1].professionalId).toBe('prof-2');
    });
  });

  describe('getAppointmentsReport', () => {
    it('debería calcular tasas de completion y cancellation', async () => {
      const metrics = [
        { ...mockDailyMetric, totalAppointments: 10, completedAppointments: 8, cancelledAppointments: 1, noShowAppointments: 1 },
        { ...mockDailyMetric, totalAppointments: 20, completedAppointments: 15, cancelledAppointments: 3, noShowAppointments: 2 },
      ];

      mockDailyRepo.find.mockResolvedValue(metrics as any);

      const result = await service.getAppointmentsReport('business-123', '2026-06-14', '2026-06-15');

      expect(result.summary.total).toBe(30);
      expect(result.summary.completed).toBe(23);
      expect(result.summary.cancelled).toBe(4);
      expect(result.summary.noShow).toBe(3);
      
      // Completion rate: 23/30 = 76.66% -> 77%
      expect(result.completionRate).toBe(77);
      // Cancellation rate: 4/30 = 13.33% -> 13%
      expect(result.cancellationRate).toBe(13);
      // No-show rate: 3/30 = 10%
      expect(result.noShowRate).toBe(10);
    });

    it('debería manejar división por cero en tasas', async () => {
      const metrics = [{ ...mockDailyMetric, totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, noShowAppointments: 0 }];

      mockDailyRepo.find.mockResolvedValue(metrics as any);

      const result = await service.getAppointmentsReport('business-123', '2026-06-15', '2026-06-15');

      expect(result.completionRate).toBe(0);
      expect(result.cancellationRate).toBe(0);
      expect(result.noShowRate).toBe(0);
    });
  });
});