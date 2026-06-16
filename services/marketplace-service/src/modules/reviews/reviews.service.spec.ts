import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewEntity } from '../../entities/review.entity';
import { ReviewHelpfulEntity } from '../../entities/review-helpful.entity';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BusinessProfilesService } from '../business-profiles/business-profiles.service';
import { ProfessionalProfilesService } from '../professional-profiles/professional-profiles.service';
import { EventBusService } from '@beautyspot/nest-common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockRepo: jest.Mocked<Repository<ReviewEntity>>;
  let mockHelpfulRepo: jest.Mocked<Repository<ReviewHelpfulEntity>>;
  let mockProfilesService: jest.Mocked<BusinessProfilesService>;
  let mockProfessionalService: jest.Mocked<ProfessionalProfilesService>;
  let mockEventBus: jest.Mocked<EventBusService>;

  const mockReview: ReviewEntity = {
    id: 'review-123',
    businessId: 'business-123',
    clientId: 'client-123',
    professionalId: 'prof-123',
    appointmentId: 'appointment-123',
    rating: 5,
    comment: 'Excelente servicio',
    photos: ['photo1.jpg', 'photo2.jpg'],
    isVerified: true,
    helpfulCount: 3,
    response: null,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => undefined,
  } as any;

  const mockHelpful: ReviewHelpfulEntity = {
    id: 'helpful-123',
    reviewId: 'review-123',
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => undefined,
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    } as any;

    mockHelpfulRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockProfilesService = {
      updateRating: jest.fn(),
    } as any;

    mockProfessionalService = {
      updateRating: jest.fn(),
    } as any;

    mockEventBus = {
      emit: jest.fn(),
    } as any;

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as any;

    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(ReviewEntity),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(ReviewHelpfulEntity),
          useValue: mockHelpfulRepo,
        },
        {
          provide: BusinessProfilesService,
          useValue: mockProfilesService,
        },
        {
          provide: ProfessionalProfilesService,
          useValue: mockProfessionalService,
        },
        {
          provide: EventBusService,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('create', () => {
    it('debería crear una reseña exitosamente', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        appointmentId: 'appointment-123',
        rating: 5,
        comment: 'Excelente servicio',
        photos: ['photo1.jpg', 'photo2.jpg'],
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toEqual(mockReview);
      expect(mockProfilesService.updateRating).toHaveBeenCalledWith('business-123');
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith('prof-123');
      expect(mockEventBus.emit).toHaveBeenCalledWith('marketplace.review.created', expect.any(Object));
    });

    it('debería lanzar ConflictException si ya existe reseña para cita', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        appointmentId: 'appointment-123',
        rating: 5,
        comment: 'Excelente servicio',
      };

      mockRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Ya existe una reseña para esta cita');
    });

    it('debería lanzar BadRequestException si rating < 4 sin comentario', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        rating: 3,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow('El comentario es obligatorio para calificaciones menores a 4 estrellas');
    });

    it('debería permitir rating ≥ 4 sin comentario', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        rating: 4,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toEqual(mockReview);
      expect(mockEventBus.emit).toHaveBeenCalled();
    });

    it('debería limitar a 3 fotos si viene de cita', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        appointmentId: 'appointment-123',
        rating: 5,
        comment: 'Excelente servicio',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg'],
      };

      mockRepo.findOne.mockResolvedValue(null);
      const limitedPhotos = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'];
      mockRepo.create.mockImplementation((data) => {
        const review = { ...data, photos: data.photos?.slice(0, 3) };
        return review as any;
      });
      mockRepo.save.mockResolvedValue({ ...mockReview, photos: limitedPhotos } as any);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.photos).toHaveLength(3);
    });

    it('no debería limitar fotos si no viene de cita', async () => {
      const dto = {
        businessId: 'business-123',
        clientId: 'client-123',
        professionalId: 'prof-123',
        rating: 5,
        comment: 'Excelente servicio',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'],
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      const allPhotos = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'];
      mockRepo.save.mockResolvedValue({ ...mockReview, photos: allPhotos } as any);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);
      mockEventBus.emit.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.photos).toHaveLength(5);
    });
  });

  describe('findByBusiness', () => {
    it('debería retornar reseñas del negocio con paginación', async () => {
      const reviews = [mockReview, { ...mockReview, id: 'review-456' } as any];
      const total = 10;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([reviews, total]),
      } as any;

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByBusiness('business-123', { page: 1, limit: 20 });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'r.business_id = :businessId',
        { businessId: 'business-123' }
      );
      expect(result).toEqual({ items: reviews, total: 10 });
    });

    it('debería filtrar por rating', async () => {
      const reviews = [mockReview];
      const total = 1;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([reviews, total]),
      } as any;

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findByBusiness('business-123', { rating: 5, page: 1, limit: 20 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'r.rating = :rating',
        { rating: 5 }
      );
    });

    it('debería filtrar solo reseñas con fotos', async () => {
      const reviews = [mockReview];
      const total = 1;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([reviews, total]),
      } as any;

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findByBusiness('business-123', { withPhotos: 'true', page: 1, limit: 20 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.photos IS NOT NULL');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('jsonb_array_length(r.photos) > 0');
    });

    it('debería limitar a 50 resultados máximo', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReview], 75]),
      } as any;

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findByBusiness('business-123', { limit: 100 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });
  });

  describe('getSummary', () => {
    it('debería calcular distribución de ratings correctamente', async () => {
      const reviews = [
        { ...mockReview, rating: 5, generateId: () => {} },
        { ...mockReview, rating: 4, id: 'review-456', generateId: () => {} },
        { ...mockReview, rating: 3, id: 'review-789', generateId: () => {} },
        { ...mockReview, rating: 2, id: 'review-999', generateId: () => {} },
        { ...mockReview, rating: 1, id: 'review-000', generateId: () => {} },
      ] as any;

      mockRepo.find.mockResolvedValue(reviews);

      const result = await service.getSummary('business-123');

      expect(result.total).toBe(5);
      expect(result.average).toBeCloseTo(3, 0.01);
      expect(result.distribution).toEqual({
        5: 1,
        4: 1,
        3: 1,
        2: 1,
        1: 1,
      });
    });

    it('debería calcular promedio 0 si no hay reseñas', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getSummary('business-123');

      expect(result.total).toBe(0);
      expect(result.average).toBe(0);
      expect(result.distribution).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    });

    it('debería manejar ratings extremos', async () => {
      const reviews = [
        { ...mockReview, rating: 5, generateId: () => {} },
        { ...mockReview, rating: 5, id: 'review-456', generateId: () => {} },
        { ...mockReview, rating: 1, id: 'review-789', generateId: () => {} },
        { ...mockReview, rating: 1, id: 'review-999', generateId: () => {} },
      ] as any;

      mockRepo.find.mockResolvedValue(reviews);

      const result = await service.getSummary('business-123');

      expect(result.average).toBeCloseTo(3, 0.01);
      expect(result.distribution).toEqual({ 5: 2, 4: 0, 3: 0, 2: 0, 1: 2 });
    });
  });

  describe('findById', () => {
    it('debería retornar reseña por ID', async () => {
      mockRepo.findOne.mockResolvedValue(mockReview);

      const result = await service.findById('review-123');

      expect(result).toEqual(mockReview);
    });

    it('debería lanzar NotFoundException si la reseña no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent')).rejects.toThrow('Reseña no encontrada');
    });
  });

  describe('respond', () => {
    it('debería agregar respuesta a reseña existente', async () => {
      const freshReview = {
        ...mockReview,
        response: null,
        respondedAt: null,
        generateId: () => undefined,
      } as any;

      mockRepo.findOne.mockResolvedValue(freshReview);
      mockRepo.save.mockResolvedValue(freshReview);

      const result = await service.respond('review-123', 'Gracias por tu reseña!');

      expect(freshReview.response).toBe('Gracias por tu reseña!');
      expect(freshReview.respondedAt).toBeInstanceOf(Date);
      expect(mockRepo.save).toHaveBeenCalledWith(freshReview);
      expect(result).toEqual(freshReview);
    });

    it('debería lanzar BadRequestException si ya tiene respuesta', async () => {
      const reviewWithResponse = {
        ...mockReview,
        response: 'Ya respondido',
        respondedAt: new Date(),
        generateId: () => undefined,
      } as any;

      mockRepo.findOne.mockResolvedValue(reviewWithResponse);

      await expect(service.respond('review-123', 'Nueva respuesta')).rejects.toThrow(BadRequestException);
      await expect(service.respond('review-123', 'Nueva respuesta')).rejects.toThrow('Esta reseña ya tiene respuesta');
    });
  });

  describe('markHelpful', () => {
    it('debería marcar reseña como helpful', async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(null);
      mockHelpfulRepo.create.mockReturnValue(mockHelpful);
      mockHelpfulRepo.save.mockResolvedValue(mockHelpful);
      mockRepo.increment.mockResolvedValue({ affected: 1 } as any);

      await service.markHelpful('review-123', 'user-123');

      expect(mockHelpfulRepo.create).toHaveBeenCalledWith({
        reviewId: 'review-123',
        userId: 'user-123',
      });
      expect(mockHelpfulRepo.save).toHaveBeenCalledWith(mockHelpful);
      expect(mockRepo.increment).toHaveBeenCalledWith({ id: 'review-123' }, 'helpfulCount', 1);
    });

    it('debería ser idempotente - mismo usuario no puede marcar dos veces', async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(mockHelpful);

      await service.markHelpful('review-123', 'user-123');

      expect(mockHelpfulRepo.save).not.toHaveBeenCalled();
      expect(mockRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe('unmarkHelpful', () => {
    it('debería quitar marca helpful del usuario', async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(mockHelpful);
      mockHelpfulRepo.remove.mockResolvedValue(mockHelpful);
      mockRepo.decrement.mockResolvedValue({ affected: 1 } as any);

      await service.unmarkHelpful('review-123', 'user-123');

      expect(mockHelpfulRepo.remove).toHaveBeenCalledWith(mockHelpful);
      expect(mockRepo.decrement).toHaveBeenCalledWith({ id: 'review-123' }, 'helpfulCount', 1);
    });

    it('no debería hacer nada si el usuario no marcó helpful', async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(null);

      await service.unmarkHelpful('review-123', 'user-123');

      expect(mockHelpfulRepo.remove).not.toHaveBeenCalled();
      expect(mockRepo.decrement).not.toHaveBeenCalled();
    });
  });
});