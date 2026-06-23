import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfessionalsService } from './professionals.service';
import { Professional } from '../../entities/professional.entity';
import { ProfessionalService } from '../../entities/professional-service.entity';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('ProfessionalsService', () => {
  let service: ProfessionalsService;
  let mockRepo: jest.Mocked<Repository<Professional>>;
  let mockPsRepo: jest.Mocked<Repository<ProfessionalService>>;

  const mockProfessional: Professional = {
    id: 'prof-123',
    businessId: 'business-123',
    branchId: 'branch-123',
    userId: 'user-123',
    name: 'John Doe',
    photo: '',
    bio: 'Experienced barber',
    category: 'Barber',
    specialties: ['Haircut', 'Beard Trim'],
    yearsExp: 5,
    rating: 4.5,
    totalReviews: 100,
    portfolio: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {} as any,
    branch: {} as any,
    categoryRef: {} as any,
    categoryId: undefined as any,
    generateId: () => {},
  };

  const mockProfessionalService: ProfessionalService = {
    id: 'ps-123',
    professionalId: 'prof-123',
    serviceId: 'service-123',
    customPrice: 50000,
    customDuration: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
    professional: {} as any,
    service: {} as any,
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockPsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalsService,
        {
          provide: getRepositoryToken(Professional),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ProfessionalService),
          useValue: mockPsRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfessionalsService>(ProfessionalsService);
  });

  describe('create', () => {
    it('debería crear un profesional exitosamente', async () => {
      const data = {
        name: 'John Doe',
        category: 'Barber',
      };

      mockRepo.create.mockReturnValue(mockProfessional);
      mockRepo.save.mockResolvedValue(mockProfessional);

      const result = await service.create('business-123', data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: 'business-123',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessional);
      expect(result).toEqual(mockProfessional);
    });

    it('debería propagar errores del repositorio', async () => {
      mockRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create('business-123', {})).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findByBusiness', () => {
    it('debería retornar todos los profesionales activos del negocio', async () => {
      mockRepo.find.mockResolvedValue([mockProfessional]);

      const result = await service.findByBusiness('business-123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', active: true },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([mockProfessional]);
    });

    it('debería retornar todos los profesionales (incluyendo inactivos)', async () => {
      const inactiveProfessional = {
        ...mockProfessional,
        id: 'prof-456',
        active: false,
      } as any;

      mockRepo.find.mockResolvedValue([mockProfessional, inactiveProfessional]);

      const result = await service.findByBusiness('business-123', false);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debería retornar array vacío si no hay profesionales', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness('business-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('debería retornar el profesional cuando existe', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessional);

      const result = await service.findById('prof-123', 'business-123');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'prof-123', businessId: 'business-123' },
      });
      expect(result).toEqual(mockProfessional);
    });

    it('debería lanzar NotFoundException cuando el profesional no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'business-123')
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById('non-existent', 'business-123')
      ).rejects.toThrow('Profesional no encontrado');
    });
  });

  describe('update', () => {
    it('debería actualizar el profesional correctamente', async () => {
      const updateData = {
        name: 'Jane Doe',
        category: 'Estilista',
      };

      const updatedProfessional = { ...mockProfessional, ...updateData } as any;

      mockRepo.findOne.mockResolvedValue(updatedProfessional);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('prof-123', 'business-123', updateData);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'prof-123', businessId: 'business-123' },
        updateData
      );
      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result.name).toBe('Jane Doe');
      expect(result.category).toBe('Estilista');
    });

    it('debería manejar actualización parcial', async () => {
      const updateData = { specialties: ['Haircut', 'Beard', 'Color'] };

      const updatedProfessional = {
        ...mockProfessional,
        specialties: ['Haircut', 'Beard', 'Color'],
      } as any;

      mockRepo.findOne.mockResolvedValue(updatedProfessional);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('prof-123', 'business-123', updateData);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'prof-123', businessId: 'business-123' },
        updateData
      );
      expect(result.specialties).toEqual(['Haircut', 'Beard', 'Color']);
    });
  });

  describe('assignService', () => {
    it('debería asignar un servicio al profesional', async () => {
      const data = {
        customPrice: 60000,
        customDuration: 45,
      };

      mockPsRepo.create.mockReturnValue(mockProfessionalService);
      mockPsRepo.save.mockResolvedValue(mockProfessionalService);

      const result = await service.assignService(
        'prof-123',
        'service-123',
        data.customPrice,
        data.customDuration
      );

      expect(mockPsRepo.create).toHaveBeenCalledWith({
        professionalId: 'prof-123',
        serviceId: 'service-123',
        customPrice: 60000,
        customDuration: 45,
      });
      expect(mockPsRepo.save).toHaveBeenCalledWith(mockProfessionalService);
      expect(result).toEqual(mockProfessionalService);
    });

    it('debería asignar un servicio sin precio personalizado', async () => {
      mockPsRepo.create.mockReturnValue(mockProfessionalService);
      mockPsRepo.save.mockResolvedValue(mockProfessionalService);

      await service.assignService('prof-123', 'service-123');

      expect(mockPsRepo.create).toHaveBeenCalledWith({
        professionalId: 'prof-123',
        serviceId: 'service-123',
        customPrice: undefined,
        customDuration: undefined,
      });
    });
  });

  describe('removeServiceAssignment', () => {
    it('debería eliminar la asignación de servicio', async () => {
      mockPsRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await service.removeServiceAssignment('prof-123', 'service-123');

      expect(mockPsRepo.delete).toHaveBeenCalledWith({
        professionalId: 'prof-123',
        serviceId: 'service-123',
      });
    });
  });

  describe('getServices', () => {
    it('debería retornar todos los servicios del profesional', async () => {
      mockPsRepo.find.mockResolvedValue([mockProfessionalService]);

      const result = await service.getServices('prof-123');

      expect(mockPsRepo.find).toHaveBeenCalledWith({
        where: { professionalId: 'prof-123' },
      });
      expect(result).toEqual([mockProfessionalService]);
    });

    it('debería retornar array vacío si no hay servicios asignados', async () => {
      mockPsRepo.find.mockResolvedValue([]);

      const result = await service.getServices('prof-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('debería desactivar el profesional (soft delete)', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessional);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.remove('prof-123', 'business-123');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'prof-123', businessId: 'business-123' },
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'prof-123', businessId: 'business-123' },
        { active: false }
      );
    });

    it('debería lanzar NotFoundException si el profesional no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('non-existent', 'business-123')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('configuración', () => {
    it('debería ser instanciable correctamente', () => {
      expect(service).toBeInstanceOf(ProfessionalsService);
    });

    it('debería tener los métodos necesarios', () => {
      expect(typeof service.create).toBe('function');
      expect(typeof service.findByBusiness).toBe('function');
      expect(typeof service.findById).toBe('function');
      expect(typeof service.update).toBe('function');
      expect(typeof service.assignService).toBe('function');
      expect(typeof service.removeServiceAssignment).toBe('function');
      expect(typeof service.getServices).toBe('function');
      expect(typeof service.remove).toBe('function');
    });
  });
});