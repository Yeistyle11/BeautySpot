import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfilesService } from './business-profiles.service';
import { BusinessProfileEntity } from '../../entities/business-profile.entity';
import { ProfessionalProfileEntity } from '../../entities/professional-profile.entity';
import { ProfessionalProfilesService } from '../professional-profiles/professional-profiles.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('BusinessProfilesService', () => {
  let service: BusinessProfilesService;
  let mockRepo: jest.Mocked<Repository<BusinessProfileEntity>>;
  let mockProfessionalService: jest.Mocked<any>;

  const mockBusinessProfile: BusinessProfileEntity = {
    id: 'profile-123',
    businessId: 'business-123',
    slug: 'elite-barbers',
    name: 'BeautySpot Center',
    description: 'Mejores cortes de la ciudad',
    logo: 'logo.jpg',
    coverImage: 'cover.jpg',
    address: 'Calle 123',
    city: 'Bogotá',
    lat: 4.711,
    lng: -74.072,
    businessType: 'barbería',
    active: true,
    isPublished: true,
    rating: 4.8,
    totalReviews: 100,
    profileCompleteness: 85,
    sectionConfig: { sections: [{ id: 'story', enabled: true, order: 1 }] },
    galleryImages: [{ url: 'img1.jpg', title: 'Corte moderno', featured: true }],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfessional: ProfessionalProfileEntity = {
    id: 'prof-123',
    businessId: 'business-123',
    slug: 'juan-perez',
    name: 'Juan Pérez',
    specialties: ['Cortes', 'Barba'],
    rating: 4.9,
    totalReviews: 50,
    visible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn(),
      },
    } as any;

    mockProfessionalService = {
      findVisibleByBusiness: jest.fn(),
      findBySlug: jest.fn(),
    } as any;

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getRawOne: jest.fn(),
    } as any;

    (mockRepo.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);
    (mockRepo.manager.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

    const module = await Test.createTestingModule({
      providers: [
        BusinessProfilesService,
        {
          provide: getRepositoryToken(BusinessProfileEntity),
          useValue: mockRepo,
        },
        {
          provide: ProfessionalProfilesService,
          useValue: mockProfessionalService,
        },
      ],
    }).compile();

    service = module.get<BusinessProfilesService>(BusinessProfilesService);
  });

  describe('createOrUpdate', () => {
    it('debería crear un nuevo perfil', async () => {
      const dto = {
        businessId: 'business-123',
        name: 'BeautySpot Center',
        slug: 'elite-barbers',
        description: 'Mejores cortes',
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.createOrUpdate(dto);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        sectionConfig: { sections: expect.any(Array) },
        profileCompleteness: 0,
      });
      expect(result).toEqual(mockBusinessProfile);
    });

    it('debería actualizar un perfil existente', async () => {
      const dto = {
        businessId: 'business-123',
        name: 'BeautySpot Center Updated',
        slug: 'elite-barbers',
        description: 'Mejores cortes actualizados',
      };

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.createOrUpdate(dto);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockBusinessProfile);
    });
  });

  describe('findBySlug', () => {
    it('debería retornar perfil y profesionales por slug', async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([mockProfessional]);

      const result = await service.findBySlug('elite-barbers');

      expect(result).toEqual({
        profile: mockBusinessProfile,
        professionals: [mockProfessional],
      });
    });

    it('debería lanzar NotFoundException si el perfil no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug('non-existent')).rejects.toThrow('Perfil de negocio no encontrado');
    });

    it('no debería retornar profesionales si team section está deshabilitado', async () => {
      const profileWithDisabledTeam = {
        ...mockBusinessProfile,
        sectionConfig: {
          sections: [{ id: 'team', enabled: false, order: 3 }],
        },
        generateId: () => {},
      } as any;

      mockRepo.findOne.mockResolvedValue(profileWithDisabledTeam);

      const result = await service.findBySlug('elite-barbers');

      expect(result.professionals).toEqual([]);
      expect(mockProfessionalService.findVisibleByBusiness).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('debería publicar un perfil exitosamente', async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);

      const result = await service.publish('business-123');

      expect(mockBusinessProfile.isPublished).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(mockBusinessProfile);
      expect(result).toEqual(mockBusinessProfile);
    });

    it('debería lanzar BadRequestException si faltan datos requeridos', async () => {
      const incompleteProfile = {
        ...mockBusinessProfile,
        name: '',
        slug: '',
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(incompleteProfile);

      await expect(service.publish('business-123')).rejects.toThrow(BadRequestException);
      await expect(service.publish('business-123')).rejects.toThrow('El perfil debe tener nombre y slug para publicarse');
    });
  });

  describe('unpublish', () => {
    it('debería despublicar un perfil exitosamente', async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);

      const result = await service.unpublish('business-123');

      expect(mockBusinessProfile.isPublished).toBe(false);
      expect(mockRepo.save).toHaveBeenCalledWith(mockBusinessProfile);
      expect(result).toEqual(mockBusinessProfile);
    });
  });

  describe('addGalleryImages', () => {
    it('debería agregar imágenes a la galería', async () => {
      const dto = {
        images: [
          { url: 'img2.jpg', title: 'Nuevo corte' },
          { url: 'img3.jpg', title: 'Barba' },
        ],
      };

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.addGalleryImages('business-123', dto);

      expect(result.galleryImages).toHaveLength(3);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('removeGalleryImage', () => {
    it('debería eliminar una imagen de la galería', async () => {
      const updatedProfile = {
        ...mockBusinessProfile,
        galleryImages: [],
        generateId: () => {},
      } as any;

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(updatedProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.removeGalleryImage('business-123', 0);

      expect(result.galleryImages).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('debería lanzar BadRequestException si el índice es inválido', async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);

      await expect(service.removeGalleryImage('business-123', 10)).rejects.toThrow(BadRequestException);
      await expect(service.removeGalleryImage('business-123', 10)).rejects.toThrow('Indice de imagen invalido');
    });
  });

  describe('findTopRated', () => {
    it('debería retornar los perfiles mejor calificados', async () => {
      const topRated = [mockBusinessProfile];
      mockRepo.find.mockResolvedValue(topRated);

      const result = await service.findTopRated(10);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { active: true, isPublished: true },
        order: { rating: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(topRated);
    });
  });

  describe('findByBusinessId', () => {
    it('debería retornar perfil por businessId', async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);

      const result = await service.findByBusinessId('business-123');

      expect(result).toEqual(mockBusinessProfile);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByBusinessId('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});