import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfessionalProfilesService } from './professional-profiles.service';
import { ProfessionalProfileEntity } from '../../entities/professional-profile.entity';
import { NotFoundException } from '@nestjs/common';

describe('ProfessionalProfilesService', () => {
  let service: ProfessionalProfilesService;
  let mockRepo: jest.Mocked<Repository<ProfessionalProfileEntity>>;

  const mockProfessionalProfile: ProfessionalProfileEntity = {
    id: 'prof-profile-123',
    businessId: 'business-123',
    professionalId: 'prof-123',
    slug: 'juan-perez',
    name: 'Juan Pérez',
    photo: 'photo.jpg',
    bio: 'Especialista en cortes modernos',
    specialties: ['Cortes', 'Barba'],
    yearsExp: 5,
    tagline: 'El mejor corte de la ciudad',
    portfolio: ['portfolio1.jpg', 'portfolio2.jpg'],
    socialInstagram: '@juanperez',
    active: true,
    visibleOnProfile: true,
    rating: 4.8,
    totalReviews: 50,
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
      manager: {
        createQueryBuilder: jest.fn(),
      },
    } as any;

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    } as any;

    (mockRepo.manager.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

    const module = await Test.createTestingModule({
      providers: [
        ProfessionalProfilesService,
        {
          provide: getRepositoryToken(ProfessionalProfileEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ProfessionalProfilesService>(ProfessionalProfilesService);
  });

  describe('syncFromCore', () => {
    it('debería crear un nuevo perfil profesional', async () => {
      const dto = {
        professionalId: 'prof-123',
        businessId: 'business-123',
        name: 'Juan Pérez',
        photo: 'photo.jpg',
        bio: 'Especialista en cortes',
        specialties: ['Cortes', 'Barba'],
        yearsExp: 5,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockProfessionalProfile);
      mockRepo.save.mockResolvedValue(mockProfessionalProfile);

      const result = await service.syncFromCore(dto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { professionalId: dto.professionalId } });
      expect(mockRepo.create).toHaveBeenCalledWith({
        ...dto,
        slug: 'juan-perez',
        specialties: dto.specialties || [],
        yearsExp: dto.yearsExp || 0,
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessionalProfile);
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería actualizar un perfil existente', async () => {
      const dto = {
        professionalId: 'prof-123',
        businessId: 'business-123',
        name: 'Juan Pérez Actualizado',
        photo: 'new-photo.jpg',
      };

      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);
      mockRepo.save.mockResolvedValue(mockProfessionalProfile);

      const result = await service.syncFromCore(dto);

      expect(mockProfessionalProfile.name).toBe(dto.name);
      expect(mockProfessionalProfile.photo).toBe(dto.photo);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessionalProfile);
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería mantener valores existentes si no se proporcionan', async () => {
      const dto = {
        professionalId: 'prof-123',
        businessId: 'business-123',
        name: 'Juan Pérez',
      };

      const freshProfile = {
        ...mockProfessionalProfile,
        photo: 'photo.jpg',
        bio: 'Especialista en cortes modernos',
        specialties: ['Cortes', 'Barba'],
        generateId: () => {},
      } as any;

      mockRepo.findOne.mockResolvedValue(freshProfile);
      mockRepo.save.mockResolvedValue(freshProfile);

      await service.syncFromCore(dto);

      expect(freshProfile.photo).toBe('photo.jpg');
      expect(freshProfile.bio).toBe('Especialista en cortes modernos');
      expect(freshProfile.specialties).toEqual(['Cortes', 'Barba']);
    });
  });

  describe('deactivateFromCore', () => {
    it('debería desactivar un profesional', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivateFromCore('prof-123');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { professionalId: 'prof-123' },
        { active: false, visibleOnProfile: false }
      );
    });
  });

  describe('updateProfile', () => {
    it('debería actualizar el perfil del profesional', async () => {
      const dto = {
        tagline: 'El mejor corte',
        socialInstagram: '@juanperez_new',
      };

      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);
      mockRepo.save.mockResolvedValue(mockProfessionalProfile);

      const result = await service.updateProfile('prof-123', 'business-123', dto);

      expect(mockProfessionalProfile.tagline).toBe(dto.tagline);
      expect(mockProfessionalProfile.socialInstagram).toBe(dto.socialInstagram);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessionalProfile);
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería lanzar NotFoundException si el perfil no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.updateProfile('non-existent', 'business-123', {})).rejects.toThrow(NotFoundException);
      await expect(service.updateProfile('non-existent', 'business-123', {})).rejects.toThrow('Perfil de profesional no encontrado');
    });
  });

  describe('toggleVisibility', () => {
    it('debería hacer visible un profesional', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);
      mockRepo.save.mockResolvedValue(mockProfessionalProfile);

      const result = await service.toggleVisibility('prof-123', 'business-123', true);

      expect(mockProfessionalProfile.visibleOnProfile).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessionalProfile);
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería hacer invisible un profesional', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);
      mockRepo.save.mockResolvedValue(mockProfessionalProfile);

      const result = await service.toggleVisibility('prof-123', 'business-123', false);

      expect(mockProfessionalProfile.visibleOnProfile).toBe(false);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfessionalProfile);
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería lanzar NotFoundException si el perfil no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleVisibility('non-existent', 'business-123', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findVisibleByBusiness', () => {
    it('debería retornar profesionales visibles del negocio', async () => {
      const professionals = [mockProfessionalProfile, { ...mockProfessionalProfile, professionalId: 'prof-456' } as any];
      mockRepo.find.mockResolvedValue(professionals);

      const result = await service.findVisibleByBusiness('business-123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: 'business-123', active: true, visibleOnProfile: true },
        order: { rating: 'DESC' },
      });
      expect(result).toEqual(professionals);
    });
  });

  describe('findBySlug', () => {
    it('debería retornar perfil por slug', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);

      const result = await service.findBySlug('juan-perez');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'juan-perez', active: true, visibleOnProfile: true },
      });
      expect(result).toEqual(mockProfessionalProfile);
    });

    it('debería lanzar NotFoundException si el perfil no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findTopRated', () => {
    it('debería retornar profesionales mejor calificados', async () => {
      const topRated = [mockProfessionalProfile, { ...mockProfessionalProfile, rating: 4.9 } as any];
      mockRepo.find.mockResolvedValue(topRated);

      const result = await service.findTopRated(10);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { active: true, visibleOnProfile: true },
        order: { rating: 'DESC', totalReviews: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(topRated);
    });
  });

  describe('updateRating', () => {
    it('debería actualizar el rating del profesional', async () => {
      mockRepo.findOne.mockResolvedValue(mockProfessionalProfile);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.8', count: '50' }),
      } as any;

      (mockRepo.manager.createQueryBuilder as any).mockReturnValue(mockQueryBuilder);

      await service.updateRating('prof-123');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { professionalId: 'prof-123' },
        {
          rating: 4.8,
          totalReviews: 50,
        }
      );
    });

    it('no debería hacer nada si el perfil no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.updateRating('non-existent');

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });
});