import { Test } from '@nestjs/testing';
import { BusinessProfilesService } from '../business-profiles/business-profiles.service';
import { ProfessionalProfilesService } from '../professional-profiles/professional-profiles.service';
import { FeedService } from './feed.service';
import { BusinessProfileEntity } from '../../entities/business-profile.entity';
import { ProfessionalProfileEntity } from '../../entities/professional-profile.entity';

describe('FeedService', () => {
  let service: FeedService;
  let mockBusinessService: jest.Mocked<BusinessProfilesService>;
  let mockProfessionalService: jest.Mocked<ProfessionalProfilesService>;

  const mockBusinessProfile: BusinessProfileEntity = {
    id: 'profile-123',
    businessId: 'business-123',
    slug: 'elite-barbers',
    name: 'BeautySpot Center',
    rating: 4.8,
    totalReviews: 100,
    profileCompleteness: 85,
    active: true,
    isPublished: true,
    city: 'Bogotá',
    lat: 4.711,
    lng: -74.072,
    businessType: 'barbería',
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfessionalProfile: ProfessionalProfileEntity = {
    id: 'prof-profile-123',
    businessId: 'business-123',
    professionalId: 'prof-123',
    slug: 'juan-perez',
    name: 'Juan Pérez',
    specialties: ['Cortes', 'Barba'],
    rating: 4.9,
    totalReviews: 50,
    visibleOnProfile: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockBusinessService = {
      findPublished: jest.fn(),
      findTopRated: jest.fn(),
      findRecent: jest.fn(),
    } as any;

    mockProfessionalService = {
      findTopRated: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: BusinessProfilesService,
          useValue: mockBusinessService,
        },
        {
          provide: ProfessionalProfilesService,
          useValue: mockProfessionalService,
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  describe('getFeed', () => {
    it('debería retornar feed completo sin ubicación', async () => {
      mockBusinessService.findPublished.mockResolvedValue({ items: [mockBusinessProfile], total: 1 });
      mockBusinessService.findTopRated.mockResolvedValue([mockBusinessProfile]);
      mockBusinessService.findRecent.mockResolvedValue([mockBusinessProfile]);
      mockProfessionalService.findTopRated.mockResolvedValue([mockProfessionalProfile]);

      const result = await service.getFeed();

      expect(result.categories).toHaveLength(3);
      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].id).toBe('popular_nearby');
    });

    it('debería filtrar por ubicación si se proporciona', async () => {
      mockBusinessService.findPublished.mockResolvedValue({ items: [], total: 0 });
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed(4.711, -74.072, 'Bogotá');

      expect(mockBusinessService.findPublished).toHaveBeenCalledWith({
        lat: 4.711,
        lng: -74.072,
        city: 'Bogotá',
        radius: 25,
        limit: 10,
        page: 1,
        orderBy: 'rating',
      });
      expect(result).toBeDefined();
    });

    it('no debería incluir secciones vacías', async () => {
      mockBusinessService.findPublished.mockResolvedValue({ items: [], total: 0 });
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed();

      expect(result.sections).toHaveLength(0);
      expect(result.categories).toHaveLength(3);
    });

    it('debería calcular categorías correctamente', async () => {
      mockBusinessService.findPublished
        .mockResolvedValueOnce({ items: [], total: 0 })
        .mockResolvedValueOnce({ items: [mockBusinessProfile], total: 1 })
        .mockResolvedValue({ items: [], total: 0 });

      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed();

      expect(result.categories).toHaveLength(3);
      expect((result.categories as any)[0].id).toBe('BARBERIA');
    });
  });
});