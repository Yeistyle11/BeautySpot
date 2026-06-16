import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from './businesses.service';
import { Business } from '../../entities/business.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let mockRepository: jest.Mocked<Repository<Business>>;

  const mockBusiness: Business = {
    id: 'business-123',
    name: 'Test Barber Shop',
    slug: 'test-barber-shop',
    description: 'A great barber shop',
    city: 'Bogotá',
    businessType: 'BARBERIA',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    branches: [],
    services: [],
    professionals: [],
    configs: [],
    hours: [],
    timezone: 'America/Bogota',
    currency: 'COP',
    locale: 'es-CO',
    logo: '',
    coverImage: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    state: '',
    country: '',
    latitude: 0,
    longitude: 0,
    verified: false,
    planId: '',
    clients: [],
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBusiness], 1]),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
  });

  describe('create', () => {
    it('debería crear un negocio exitosamente', async () => {
      const createData = {
        name: 'Test Barber Shop',
        description: 'A great barber shop',
        city: 'Bogotá',
        businessType: 'barbershop',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);

      const result = await service.create(createData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-barber-shop' },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createData,
        slug: 'test-barber-shop',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockBusiness);
      expect(result).toEqual(mockBusiness);
    });

    it('debería lanzar ConflictException si el slug ya existe', async () => {
      const createData = {
        name: 'Test Barber Shop',
        description: 'A great barber shop',
        city: 'Bogotá',
      };

      mockRepository.findOne.mockResolvedValue(mockBusiness);

      await expect(service.create(createData)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createData)).rejects.toThrow(
        'El slug "test-barber-shop" ya existe'
      );
    });

    it('debería generar el slug correctamente desde el nombre', async () => {
      const createData = {
        name: 'Barbería Elite 2024',
        description: 'Test',
        city: 'Medellín',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);

      await service.create(createData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createData,
        slug: 'barberia-elite-2024',
      });
    });
  });

  describe('findAll', () => {
    it('debería retornar todos los negocios con paginación', async () => {
      const result = await service.findAll({});

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('b');
      expect(mockRepository.createQueryBuilder('').leftJoinAndSelect).toHaveBeenCalledWith('b.branches', 'branches');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('debería filtrar por ciudad', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ city: 'Bogotá' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'b.city ILIKE :city',
        { city: '%Bogotá%' }
      );
    });

    it('debería filtrar por tipo de negocio', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ businessType: 'barbershop' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'b.business_type = :type',
        { type: 'barbershop' }
      );
    });

    it('debería filtrar por estado activo', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ active: 'true' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'b.active = :active',
        { active: true }
      );
    });

    it('debería filtrar por estado inactivo', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ active: 'false' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'b.active = :active',
        { active: false }
      );
    });

    it('debería buscar por nombre o descripción', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ search: 'barber' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(b.name ILIKE :search OR b.description ILIKE :search)',
        { search: '%barber%' }
      );
    });

    it('debería manejar caracteres especiales en búsqueda', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ search: 'barber%shop' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(b.name ILIKE :search OR b.description ILIKE :search)',
        { search: '%barber\\%shop%' }
      );
    });

    it('debería ordenar por nombre ascendente', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ sort: 'name', order: 'ASC' });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('b.name', 'ASC');
    });

    it('debería manejar paginación correctamente', async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ page: '2', limit: '20' });

      expect(queryBuilder.skip).toHaveBeenCalledWith(20);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });
  });

  describe('findById', () => {
    it('debería retornar el negocio cuando existe', async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.findById('business-123');

      expect(result).toEqual(mockBusiness);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'business-123' },
        relations: {
          branches: true,
          services: true,
          professionals: true,
          configs: true,
          hours: true,
        },
      });
    });

    it('debería lanzar NotFoundException cuando el negocio no existe', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Negocio no encontrado'
      );
    });
  });

  describe('findBySlug', () => {
    it('debería retornar el negocio cuando existe', async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.findBySlug('test-barber-shop');

      expect(result).toEqual(mockBusiness);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-barber-shop' },
        relations: {
          branches: true,
          services: true,
          professionals: true,
        },
      });
    });

    it('debería lanzar NotFoundException cuando el slug no existe', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        'Negocio "non-existent" no encontrado'
      );
    });
  });

  describe('update', () => {
    it('debería actualizar el negocio correctamente', async () => {
      const updateData = {
        name: 'Updated Barber Shop',
        description: 'Updated description',
      };

      const updatedBusiness = { ...mockBusiness, ...updateData } as any;

      mockRepository.findOne.mockResolvedValue(updatedBusiness);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('business-123', updateData);

      expect(mockRepository.update).toHaveBeenCalledWith('business-123', updateData);
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(result.name).toBe('Updated Barber Shop');
      expect(result.description).toBe('Updated description');
    });

    it('debería manejar actualización parcial', async () => {
      const updateData = { city: 'Medellín' };

      const updatedBusiness = { ...mockBusiness, city: 'Medellín' } as any;

      mockRepository.findOne.mockResolvedValue(updatedBusiness);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update('business-123', updateData);

      expect(mockRepository.update).toHaveBeenCalledWith('business-123', updateData);
      expect(result.city).toBe('Medellín');
    });
  });

  describe('deactivate', () => {
    it('debería desactivar el negocio correctamente', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate('business-123');

      expect(mockRepository.update).toHaveBeenCalledWith('business-123', {
        active: false,
      });
    });

    it('debería manejar negocios ya desactivados', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.deactivate('business-123')).resolves.not.toThrow();
    });
  });

  describe('manejo de errores', () => {
    it('debería propagar errores del repositorio', async () => {
      mockRepository.findOne.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.findById('business-123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('configuración', () => {
    it('debería ser instanciable correctamente', () => {
      expect(service).toBeInstanceOf(BusinessesService);
    });

    it('debería tener los métodos necesarios', () => {
      expect(typeof service.create).toBe('function');
      expect(typeof service.findAll).toBe('function');
      expect(typeof service.findById).toBe('function');
      expect(typeof service.findBySlug).toBe('function');
      expect(typeof service.update).toBe('function');
      expect(typeof service.deactivate).toBe('function');
    });
  });
});