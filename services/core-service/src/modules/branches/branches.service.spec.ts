import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchesService } from './branches.service';
import { Branch } from '../../entities/branch.entity';
import { NotFoundException } from '@nestjs/common';

describe('BranchesService', () => {
  let service: BranchesService;
  let mockRepo: jest.Mocked<Repository<Branch>>;

  const mockBranch: Branch = {
    id: 'branch-123',
    businessId: 'business-123',
    name: 'Sucursal Centro',
    address: 'Calle 123',
    city: 'Bogotá',
    state: 'Cundinamarca',
    country: 'Colombia',
    latitude: 4.6097,
    longitude: -74.0817,
    phone: '+573001234567',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {} as any,
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: getRepositoryToken(Branch),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  describe('create', () => {
    it('debería crear una sucursal exitosamente', async () => {
      const data = {
        name: 'Sucursal Norte',
        address: 'Calle 456',
        city: 'Medellín',
      };

      mockRepo.create.mockReturnValue(mockBranch);
      mockRepo.save.mockResolvedValue(mockBranch);

      const result = await service.create('business-123', data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: 'business-123',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockBranch);
      expect(result).toEqual(mockBranch);
    });

    it('debería propagar errores del repositorio', async () => {
      mockRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create('business-123', {})).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findByBusiness', () => {
    it('debería retornar todas las sucursales activas del negocio', async () => {
      mockRepo.find.mockResolvedValue([mockBranch]);

      const result = await service.findByBusiness('business-123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', active: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual([mockBranch]);
    });

    it('debería retornar array vacío si no hay sucursales', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness('business-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('debería ordenar las sucursales por nombre', async () => {
      const branch2 = { ...mockBranch, id: 'branch-2', name: 'Sucursal Sur' } as any;

      mockRepo.find.mockResolvedValue([mockBranch, branch2]);

      const result = await service.findByBusiness('business-123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', active: true },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('debería retornar la sucursal cuando existe', async () => {
      mockRepo.findOne.mockResolvedValue(mockBranch);

      const result = await service.findById('branch-123', 'business-123');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'branch-123', businessId: 'business-123' },
      });
      expect(result).toEqual(mockBranch);
    });

    it('debería lanzar NotFoundException cuando la sucursal no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'business-123')
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById('non-existent', 'business-123')
      ).rejects.toThrow('Sucursal no encontrada');
    });
  });

  describe('update', () => {
    it('debería actualizar la sucursal correctamente', async () => {
      const updateData = {
        name: 'Sucursal Centro Actualizada',
        phone: '+573009876543',
      };

      const updatedBranch = { ...mockBranch, ...updateData } as any;

      mockRepo.findOne.mockResolvedValue(updatedBranch);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('branch-123', 'business-123', updateData);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'branch-123', businessId: 'business-123' },
        updateData
      );
      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result.name).toBe('Sucursal Centro Actualizada');
      expect(result.phone).toBe('+573009876543');
    });

    it('debería manejar actualización parcial', async () => {
      const updateData = { city: 'Cali' };

      const updatedBranch = { ...mockBranch, city: 'Cali' } as any;

      mockRepo.findOne.mockResolvedValue(updatedBranch);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('branch-123', 'business-123', updateData);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'branch-123', businessId: 'business-123' },
        updateData
      );
      expect(result.city).toBe('Cali');
    });
  });

  describe('deactivate', () => {
    it('debería desactivar la sucursal correctamente', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate('branch-123', 'business-123');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'branch-123', businessId: 'business-123' },
        { active: false }
      );
    });
  });

  describe('configuración', () => {
    it('debería ser instanciable correctamente', () => {
      expect(service).toBeInstanceOf(BranchesService);
    });

    it('debería tener los métodos necesarios', () => {
      expect(typeof service.create).toBe('function');
      expect(typeof service.findByBusiness).toBe('function');
      expect(typeof service.findById).toBe('function');
      expect(typeof service.update).toBe('function');
      expect(typeof service.deactivate).toBe('function');
    });
  });
});