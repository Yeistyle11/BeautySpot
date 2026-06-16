import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityService } from './availability.service';
import { Availability } from '../../entities/availability.entity';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let mockRepo: jest.Mocked<Repository<Availability>>;

  const mockAvailability: Availability = {
    id: 'avail-123',
    businessId: 'business-123',
    professionalId: 'prof-123',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '18:00',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Availability),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  describe('findByProfessional', () => {
    it('debería retornar disponibilidad activa del profesional', async () => {
      mockRepo.find.mockResolvedValue([mockAvailability]);

      const result = await service.findByProfessional('business-123', 'prof-123');

      expect(result).toEqual([mockAvailability]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', professionalId: 'prof-123', active: true },
        order: { dayOfWeek: 'ASC' },
      });
    });

    it('debería retornar array vacío si no hay disponibilidad', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByProfessional('business-123', 'prof-123');

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', professionalId: 'prof-123', active: true },
        order: { dayOfWeek: 'ASC' },
      });
    });
  });

  describe('replaceWeekly', () => {
    it('debería reemplazar toda la disponibilidad semanal', async () => {
      const slots = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      ];

      mockRepo.delete.mockResolvedValue({ affected: 3 } as any);
      mockRepo.create.mockReturnValue(mockAvailability as any);
      mockRepo.save.mockResolvedValue([mockAvailability] as any);

      const result = await service.replaceWeekly('business-123', 'prof-123', slots);

      expect(mockRepo.delete).toHaveBeenCalledWith({
        businessId: 'business-123',
        professionalId: 'prof-123',
      });
      expect(mockRepo.create).toHaveBeenCalledTimes(3);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('debería manejar reemplazo vacío', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 5 } as any);
      mockRepo.save.mockResolvedValue({} as any);

      const result = await service.replaceWeekly('business-123', 'prof-123', []);

      expect(mockRepo.delete).toHaveBeenCalledWith({
        businessId: 'business-123',
        professionalId: 'prof-123',
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });
  });

  describe('configuración', () => {
    it('debería ser instanciable correctamente', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AvailabilityService);
    });

    it('debería tener los métodos necesarios', () => {
      expect(typeof service.findByProfessional).toBe('function');
      expect(typeof service.replaceWeekly).toBe('function');
    });
  });
});