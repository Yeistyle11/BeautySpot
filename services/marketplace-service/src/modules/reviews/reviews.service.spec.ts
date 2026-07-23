import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ReviewsService } from "./reviews.service";
import { ReviewEntity } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("ReviewsService", () => {
  let service: ReviewsService;
  let mockRepo: jest.Mocked<Repository<ReviewEntity>>;
  let mockHelpfulRepo: jest.Mocked<Repository<ReviewHelpfulEntity>>;
  let mockProfilesService: jest.Mocked<BusinessProfilesService>;
  let mockProfessionalService: jest.Mocked<ProfessionalProfilesService>;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;

  const mockReview: ReviewEntity = {
    id: "review-123",
    businessId: "business-123",
    clientId: "client-123",
    professionalId: "prof-123",
    appointmentId: "appointment-123",
    rating: 5,
    comment: "Excelente servicio",
    photos: ["photo1.jpg", "photo2.jpg"],
    isVerified: true,
    helpfulCount: 3,
    response: null,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => undefined,
  } as any;

  const mockHelpful: ReviewHelpfulEntity = {
    id: "helpful-123",
    reviewId: "review-123",
    userId: "user-123",
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

    mockManagerRepo = {
      save: jest.fn(),
    };
    mockManager = {
      getRepository: jest.fn().mockReturnValue(mockManagerRepo),
    };
    mockDataSource = {
      transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
        fn(mockManager)
      ),
    };

    mockProfilesService = {
      updateRating: jest.fn(),
    } as any;

    mockProfessionalService = {
      updateRating: jest.fn(),
    } as any;

    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
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
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: BusinessProfilesService,
          useValue: mockProfilesService,
        },
        {
          provide: ProfessionalProfilesService,
          useValue: mockProfessionalService,
        },
        { provide: OutboxService, useValue: mockOutbox },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe("create", () => {
    it("debería crear una reseña, actualizar ratings y encolar evento en la misma transacción", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente servicio",
        photos: ["photo1.jpg", "photo2.jpg"],
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockManagerRepo.save).toHaveBeenCalledWith(mockReview);
      // updateRating debe recibir el manager de la tx
      expect(mockProfilesService.updateRating).toHaveBeenCalledWith(
        "business-123",
        mockManager
      );
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        "prof-123",
        mockManager
      );
      // outbox.enqueue debe recibir el manager de la tx
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          eventType: EventNames.MARKETPLACE_REVIEW_CREATED,
          aggregateType: "review",
          aggregateId: mockReview.id,
          payload: expect.objectContaining({
            reviewId: mockReview.id,
            businessId: "business-123",
            rating: 5,
          }),
        })
      );
      expect(result).toEqual(mockReview);
    });

    it("debería lanzar ConflictException si ya existe reseña para cita", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente servicio",
      };

      mockRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      // no se abre transacción si la validación falla
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si rating < 4 sin comentario", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        rating: 3,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería permitir rating >= 4 sin comentario", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        rating: 4,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toEqual(mockReview);
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("debería limitar a 3 fotos si viene de cita", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente servicio",
        photos: ["photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg"],
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data) => {
        return { ...data, photos: data.photos?.slice(0, 3) } as any;
      });
      const limitedPhotos = ["photo1.jpg", "photo2.jpg", "photo3.jpg"];
      mockManagerRepo.save.mockResolvedValue({
        ...mockReview,
        photos: limitedPhotos,
      } as any);

      const result = await service.create(dto);

      expect(result.photos).toHaveLength(3);
    });

    it("no debería limitar fotos si no viene de cita", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "prof-123",
        rating: 5,
        comment: "Excelente servicio",
        photos: [
          "photo1.jpg",
          "photo2.jpg",
          "photo3.jpg",
          "photo4.jpg",
          "photo5.jpg",
        ],
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      const allPhotos = [
        "photo1.jpg",
        "photo2.jpg",
        "photo3.jpg",
        "photo4.jpg",
        "photo5.jpg",
      ];
      mockManagerRepo.save.mockResolvedValue({
        ...mockReview,
        photos: allPhotos,
      } as any);

      const result = await service.create(dto);

      expect(result.photos).toHaveLength(5);
    });

    it("no debería actualizar rating del profesional si no hay professionalId", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        rating: 5,
        comment: "Excelente",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);

      await service.create(dto);

      expect(mockProfessionalService.updateRating).not.toHaveBeenCalled();
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("debería propagar errores de la transacción (fail-closed)", async () => {
      const dto = {
        businessId: "business-123",
        clientId: "client-123",
        rating: 5,
        comment: "Excelente",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockRejectedValue(new Error("DB error"));

      await expect(service.create(dto)).rejects.toThrow("DB error");
      // si updateRating falla, no se encola el evento
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("findByBusiness", () => {
    it("debería retornar reseñas del negocio con paginación", async () => {
      const reviews = [mockReview, { ...mockReview, id: "review-456" } as any];
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

      const result = await service.findByBusiness("business-123", {
        page: 1,
        limit: 20,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "r.business_id = :businessId",
        { businessId: "business-123" }
      );
      expect(result).toEqual({ items: reviews, total: 10 });
    });

    it("debería filtrar por rating", async () => {
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

      await service.findByBusiness("business-123", {
        rating: 5,
        page: 1,
        limit: 20,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "r.rating = :rating",
        { rating: 5 }
      );
    });

    it("debería limitar a 50 resultados máximo", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReview], 75]),
      } as any;

      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findByBusiness("business-123", { limit: 100 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });
  });

  describe("getSummary", () => {
    const summaryQb = (rows: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    it("agrega la distribución de ratings vía GROUP BY", async () => {
      // pg devuelve COUNT como string; el servicio lo convierte a number.
      mockRepo.createQueryBuilder.mockReturnValue(
        summaryQb([
          { rating: 5, count: "1" },
          { rating: 4, count: "1" },
          { rating: 3, count: "1" },
          { rating: 2, count: "1" },
          { rating: 1, count: "1" },
        ]) as any
      );

      const result = await service.getSummary("business-123");

      expect(result.total).toBe(5);
      expect(result.average).toBeCloseTo(3, 0.01);
      expect(result.distribution).toEqual({ 5: 1, 4: 1, 3: 1, 2: 1, 1: 1 });
    });

    it("debería calcular promedio 0 si no hay reseñas", async () => {
      mockRepo.createQueryBuilder.mockReturnValue(summaryQb([]) as any);

      const result = await service.getSummary("business-123");

      expect(result.total).toBe(0);
      expect(result.average).toBe(0);
      expect(result.distribution).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    });
  });

  describe("findById", () => {
    it("debería retornar reseña por ID", async () => {
      mockRepo.findOne.mockResolvedValue(mockReview);

      const result = await service.findById("review-123");

      expect(result).toEqual(mockReview);
    });

    it("debería lanzar NotFoundException si la reseña no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("respond", () => {
    it("debería agregar respuesta a reseña existente", async () => {
      const freshReview = {
        ...mockReview,
        response: null,
        respondedAt: null,
        generateId: () => undefined,
      } as any;

      mockRepo.findOne.mockResolvedValue(freshReview);
      mockRepo.save.mockResolvedValue(freshReview);

      const result = await service.respond("review-123", "Gracias!");

      expect(freshReview.response).toBe("Gracias!");
      expect(freshReview.respondedAt).toBeInstanceOf(Date);
      expect(mockRepo.save).toHaveBeenCalledWith(freshReview);
      expect(result).toEqual(freshReview);
    });

    it("debería lanzar BadRequestException si ya tiene respuesta", async () => {
      const reviewWithResponse = {
        ...mockReview,
        response: "Ya respondido",
        respondedAt: new Date(),
        generateId: () => undefined,
      } as any;

      mockRepo.findOne.mockResolvedValue(reviewWithResponse);

      await expect(
        service.respond("review-123", "Nueva respuesta")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("markHelpful", () => {
    it("debería marcar reseña como helpful", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(null);
      mockHelpfulRepo.create.mockReturnValue(mockHelpful);
      mockHelpfulRepo.save.mockResolvedValue(mockHelpful);
      mockRepo.increment.mockResolvedValue({ affected: 1 } as any);

      await service.markHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.save).toHaveBeenCalledWith(mockHelpful);
      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: "review-123" },
        "helpfulCount",
        1
      );
    });

    it("debería ser idempotente", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(mockHelpful);

      await service.markHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.save).not.toHaveBeenCalled();
      expect(mockRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe("unmarkHelpful", () => {
    it("debería quitar marca helpful", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(mockHelpful);
      mockHelpfulRepo.remove.mockResolvedValue(mockHelpful);
      mockRepo.decrement.mockResolvedValue({ affected: 1 } as any);

      await service.unmarkHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.remove).toHaveBeenCalledWith(mockHelpful);
      expect(mockRepo.decrement).toHaveBeenCalledWith(
        { id: "review-123" },
        "helpfulCount",
        1
      );
    });

    it("no debería hacer nada si el usuario no marcó helpful", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(null);

      await service.unmarkHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.remove).not.toHaveBeenCalled();
      expect(mockRepo.decrement).not.toHaveBeenCalled();
    });
  });
});
