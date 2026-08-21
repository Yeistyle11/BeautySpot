import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource, In, MoreThan } from "typeorm";
import { ReviewsService } from "./reviews.service";
import { ReviewEntity, ReviewStatus } from "../../entities/review.entity";
import { ReviewReportReason } from "../../entities/review-report.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { InternalHttpClient, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("ReviewsService", () => {
  let service: ReviewsService;
  let mockRepo: jest.Mocked<Repository<ReviewEntity>>;
  let mockHelpfulRepo: jest.Mocked<Repository<ReviewHelpfulEntity>>;
  let mockProfilesService: jest.Mocked<BusinessProfilesService>;
  let mockProfessionalService: jest.Mocked<ProfessionalProfilesService>;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockHttp: { pedirONulo: jest.Mock; pedir: jest.Mock };
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;

  const mockReview: ReviewEntity = {
    id: "review-123",
    businessId: "business-123",
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
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      update: jest.fn(),
    } as any;

    mockHelpfulRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    } as any;

    mockManagerRepo = {
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({}),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
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
      invalidarCache: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockProfessionalService = {
      updateRating: jest.fn(),
    } as any;

    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Por defecto, booking no confirma la cita: la reseña no sale verificada.
    mockHttp = {
      pedirONulo: jest.fn().mockResolvedValue({ resenable: false }),
      // Por defecto la cita es reseñable: cada test que quiera lo contrario lo
      // dice explícitamente.
      pedir: jest.fn().mockResolvedValue({
        resenable: true,
        professionalId: "prof-123",
        servicios: ["Corte"],
      }),
    };

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
        { provide: InternalHttpClient, useValue: mockHttp },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe("create", () => {
    it("debería crear una reseña, actualizar ratings y encolar evento en la misma transacción", async () => {
      const dto = {
        businessId: "business-123",
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

      const result = await service.create(dto, "client-123");

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

    it("invalida la caché después de confirmar, no dentro de la transacción", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente",
      };
      const orden: string[] = [];

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockDataSource.transaction.mockImplementation(
        async (fn: (m: unknown) => Promise<unknown>) => {
          orden.push("tx:inicio");
          const resultado = await fn(mockManager);
          orden.push("tx:fin");
          return resultado;
        }
      );
      (mockProfilesService.invalidarCache as jest.Mock).mockImplementation(
        async () => {
          orden.push("invalidar");
        }
      );

      await service.create(dto, "client-123");

      // Fuera de la transaccion: dentro alargaria los bloqueos con una
      // conversacion con Redis.
      expect(orden).toEqual(["tx:inicio", "tx:fin", "invalidar"]);
      expect(mockProfilesService.invalidarCache).toHaveBeenCalledWith(
        "business-123"
      );
    });

    it("firma la reseña con el usuario autenticado, no con el del cuerpo", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente",
        // Un cliente ajeno colado en el cuerpo no debe llegar a la entidad.
        clientId: "otro-cliente",
      } as never;

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);

      await service.create(dto, "client-123");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "client-123" })
      );
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          payload: expect.objectContaining({ clientId: "client-123" }),
        })
      );
    });

    it("acepta la reseña cuando booking confirma que la cita es del usuario", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "cita-real",
        rating: 5,
        comment: "Excelente",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);

      await service.create(dto, "client-123");

      expect(mockHttp.pedir).toHaveBeenCalledWith(
        "booking",
        expect.stringContaining("/internal/appointments/cita-real/resenable")
      );
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true })
      );
    });

    it("rechaza la reseña de una cita que no es del usuario o no se atendió", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "cita-ajena",
        rating: 1,
        comment: "Pésimo",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockHttp.pedir.mockResolvedValue({ resenable: false });

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        ForbiddenException
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("no publica la reseña si booking no responde", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "cita-real",
        rating: 1,
        comment: "Pésimo",
      };

      mockRepo.findOne.mockResolvedValue(null);
      // Con booking caído, publicar sin verificar permitiría hundir el rating
      // de un competidor.
      mockHttp.pedir.mockRejectedValue(
        new ServiceUnavailableException("booking no disponible")
      );

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        ServiceUnavailableException
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("califica al profesional de la cita, no al que diga el cuerpo", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "cita-real",
        rating: 1,
        comment: "Pésimo",
        // Un profesional ajeno colado en el cuerpo no debe llegar a la reseña.
        professionalId: "prof-de-la-competencia",
      } as never;

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);

      await service.create(dto, "client-123");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ professionalId: "prof-123" })
      );
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        "prof-123",
        mockManager
      );
    });

    it("traduce la carrera contra el índice único a un conflicto", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "cita-real",
        rating: 5,
        comment: "Excelente",
      };

      // El findOne previo no ve nada, pero otra alta simultánea gana la
      // carrera y la base rechaza la segunda.
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockDataSource.transaction.mockRejectedValue(
        Object.assign(new Error("duplicate key"), { code: "23505" })
      );

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        ConflictException
      );
    });

    it("debería lanzar ConflictException si ya existe reseña para cita", async () => {
      const dto = {
        businessId: "business-123",
        professionalId: "prof-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente servicio",
      };

      mockRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        ConflictException
      );
      // no se abre transacción si la validación falla
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si rating < 4 sin comentario", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 3,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        BadRequestException
      );
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería permitir rating >= 4 sin comentario", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 4,
        comment: undefined,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockProfessionalService.updateRating.mockResolvedValue(undefined);

      const result = await service.create(dto, "client-123");

      expect(result).toEqual(mockReview);
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("debería limitar a 3 fotos", async () => {
      const dto = {
        businessId: "business-123",
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

      const result = await service.create(dto, "client-123");

      expect(result.photos).toHaveLength(3);
    });

    it("no actualiza el rating del profesional si la cita no traía ninguno", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockResolvedValue(undefined);
      mockHttp.pedir.mockResolvedValue({ resenable: true });

      await service.create(dto, "client-123");

      expect(mockProfessionalService.updateRating).not.toHaveBeenCalled();
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("debería propagar errores de la transacción (fail-closed)", async () => {
      const dto = {
        businessId: "business-123",
        appointmentId: "appointment-123",
        rating: 5,
        comment: "Excelente",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockReview);
      mockManagerRepo.save.mockResolvedValue(mockReview);
      mockProfilesService.updateRating.mockRejectedValue(new Error("DB error"));

      await expect(service.create(dto, "client-123")).rejects.toThrow(
        "DB error"
      );
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
      andWhere: jest.fn().mockReturnThis(),
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

    // El resumen cuenta lo mismo que la media: las ocultas incluidas.
    it("no descarta las reseñas ocultas", async () => {
      const qb = summaryQb([{ rating: 1, count: "3" }]);
      mockRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.getSummary("business-123");

      expect(qb.andWhere).not.toHaveBeenCalled();
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

      expect(result).toEqual(
        expect.objectContaining({
          id: mockReview.id,
          rating: mockReview.rating,
          comment: mockReview.comment,
        })
      );
    });

    // La ruta es publica: quien escribio la resena y sobre que cita no salen de
    // aqui, ni el recuento de denuncias, que es de moderacion.
    it("no publica el vínculo con el usuario, la cita ni las denuncias", async () => {
      mockRepo.findOne.mockResolvedValue(mockReview);

      const result = await service.findById("review-123");

      expect(result).not.toHaveProperty("clientId");
      expect(result).not.toHaveProperty("appointmentId");
      expect(result).not.toHaveProperty("reportCount");
    });

    // Ocultar una resena la retira del escaparate; seguir sirviendola por su id
    // dejaba la moderacion sin efecto para quien conserve el enlace.
    it("solo busca entre las publicadas", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById("review-123")).rejects.toThrow(
        NotFoundException
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "review-123", status: ReviewStatus.PUBLICADA },
      });
    });

    it("debería lanzar NotFoundException si la reseña no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("findByClientUser", () => {
    const PAGINACION = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "createdAt",
      order: "DESC" as const,
    };

    it("debería filtrar por el usuario del token y ordenar por fecha", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockReview], 1]);

      const result = await service.findByClientUser("user-123", PAGINACION);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: "user-123" },
          order: { createdAt: "DESC" },
        })
      );
      expect(result.data).toEqual([mockReview]);
    });

    // El historial crece con cada visita: la respuesta va paginada aunque no se
    // pida página.
    it("acota la página al límite recibido", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockReview], 1]);

      await service.findByClientUser("user-123", PAGINACION);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 })
      );
    });

    it("responde solo por las citas pedidas cuando se indican", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockReview], 1]);

      await service.findByClientUser("user-123", PAGINACION, ["cita-1"]);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: "user-123", appointmentId: In(["cita-1"]) },
        })
      );
    });

    // Una lista vacia es "ninguna cita por la que preguntar", no "sin filtro".
    it("con una lista de citas vacía no consulta por todo el historial", async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByClientUser("user-123", PAGINACION, []);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: "user-123", appointmentId: In([]) },
        })
      );
    });

    it("debería devolver lista vacía si el usuario no ha reseñado", async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByClientUser(
        "user-sin-resenas",
        PAGINACION
      );

      expect(result.data).toEqual([]);
    });
  });

  describe("findByAppointment", () => {
    it("debería filtrar por la cita indicada", async () => {
      mockRepo.find.mockResolvedValue([mockReview]);

      const result = await service.findByAppointment("appointment-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { appointmentId: "appointment-123" },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual([mockReview]);
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

      const result = await service.respond(
        "review-123",
        "business-123",
        "Gracias!"
      );

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "review-123", businessId: "business-123" },
      });
      expect(freshReview.response).toBe("Gracias!");
      expect(freshReview.respondedAt).toBeInstanceOf(Date);
      expect(mockRepo.save).toHaveBeenCalledWith(freshReview);
      expect(result).toEqual(freshReview);
    });

    it("debería lanzar NotFoundException si la reseña es de otro negocio", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respond("review-123", "otro-negocio", "Gracias!")
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
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
        service.respond("review-123", "business-123", "Nueva respuesta")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("editarRespuesta y borrarRespuesta", () => {
    const conRespuesta = () =>
      ({
        ...mockReview,
        response: "Gracias!",
        respondedAt: new Date(),
        generateId: () => undefined,
      }) as any;

    it("reescribe la respuesta del negocio", async () => {
      const review = conRespuesta();
      mockRepo.findOne.mockResolvedValue(review);
      mockRepo.save.mockImplementation(async (r: any) => r);

      await service.editarRespuesta(
        "review-123",
        "business-123",
        "Mejor redactado"
      );

      expect(review.response).toBe("Mejor redactado");
      expect(mockRepo.save).toHaveBeenCalledWith(review);
    });

    it("no deja editar una respuesta que no existe", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockReview,
        response: null,
      } as any);

      await expect(
        service.editarRespuesta("review-123", "business-123", "Hola")
      ).rejects.toThrow(BadRequestException);
    });

    it("retira la respuesta y deja la reseña intacta", async () => {
      const review = conRespuesta();
      mockRepo.findOne.mockResolvedValue(review);
      mockRepo.save.mockImplementation(async (r: any) => r);

      await service.borrarRespuesta("review-123", "business-123");

      expect(review.response).toBeNull();
      expect(review.respondedAt).toBeNull();
      expect(review.rating).toBe(mockReview.rating);
    });

    it("no toca la respuesta de otro negocio", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.borrarRespuesta("review-123", "otro-negocio")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update y remove", () => {
    const propia = () =>
      ({
        ...mockReview,
        clientId: "user-123",
        generateId: () => undefined,
      }) as any;

    it("corrige la reseña propia y recalcula las medias", async () => {
      const review = propia();
      mockRepo.findOne.mockResolvedValue(review);
      mockManagerRepo.save.mockImplementation(async (r: any) => r);

      const result = await service.update("review-123", "user-123", {
        rating: 4,
        comment: "Mejor de lo que puse",
      });

      expect(result.rating).toBe(4);
      expect(result.editedAt).toBeInstanceOf(Date);
      expect(mockProfilesService.updateRating).toHaveBeenCalledWith(
        "business-123",
        mockManager
      );
      expect(mockProfessionalService.updateRating).toHaveBeenCalledWith(
        "prof-123",
        mockManager
      );
      expect(mockProfilesService.invalidarCache).toHaveBeenCalledWith(
        "business-123"
      );
    });

    it("no deja tocar la reseña de otro", async () => {
      mockRepo.findOne.mockResolvedValue(propia());

      await expect(
        service.update("review-123", "otro-usuario", { rating: 1 })
      ).rejects.toThrow(ForbiddenException);
    });

    it("sigue exigiendo comentario por debajo de 4 estrellas", async () => {
      mockRepo.findOne.mockResolvedValue({ ...propia(), comment: null });

      await expect(
        service.update("review-123", "user-123", { rating: 2 })
      ).rejects.toThrow(BadRequestException);
    });

    it("borra la propia y recalcula las medias", async () => {
      mockRepo.findOne.mockResolvedValue(propia());

      await service.remove("review-123", "user-123");

      expect(mockManagerRepo.delete).toHaveBeenCalledWith({ id: "review-123" });
      expect(mockProfilesService.updateRating).toHaveBeenCalledWith(
        "business-123",
        mockManager
      );
      expect(mockProfilesService.invalidarCache).toHaveBeenCalledWith(
        "business-123"
      );
    });

    it("no deja borrar la reseña de otro", async () => {
      mockRepo.findOne.mockResolvedValue(propia());

      await expect(
        service.remove("review-123", "otro-usuario")
      ).rejects.toThrow(ForbiddenException);
      expect(mockManagerRepo.delete).not.toHaveBeenCalled();
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
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.unmarkHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.remove).toHaveBeenCalledWith(mockHelpful);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "review-123", helpfulCount: MoreThan(0) },
        expect.anything()
      );
    });

    // Restar sin mirar deja el recuento en negativo si se descuadra por
    // cualquier motivo; la condicion viaja dentro del propio UPDATE.
    it("no descuenta si el recuento ya está en cero", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(mockHelpful);
      mockHelpfulRepo.remove.mockResolvedValue(mockHelpful);
      mockRepo.update.mockResolvedValue({ affected: 0 } as any);

      await service.unmarkHelpful("review-123", "user-123");

      const [criterio] = mockRepo.update.mock.calls[0];
      expect(criterio).toMatchObject({ helpfulCount: MoreThan(0) });
      expect(mockRepo.decrement).not.toHaveBeenCalled();
    });

    it("no debería hacer nada si el usuario no marcó helpful", async () => {
      mockHelpfulRepo.findOne.mockResolvedValue(null);

      await service.unmarkHelpful("review-123", "user-123");

      expect(mockHelpfulRepo.remove).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("moderación y denuncia", () => {
    it("oculta la reseña y recalcula las medias", async () => {
      const review = { ...mockReview, generateId: () => undefined } as any;
      mockRepo.findOne.mockResolvedValue(review);
      mockManagerRepo.save.mockImplementation(async (r: any) => r);

      const resultado = await service.moderar(
        "review-123",
        "business-123",
        ReviewStatus.OCULTA
      );

      expect(resultado.status).toBe(ReviewStatus.OCULTA);
      expect(mockProfilesService.updateRating).toHaveBeenCalledWith(
        "business-123",
        mockManager
      );
      expect(mockProfilesService.invalidarCache).toHaveBeenCalledWith(
        "business-123"
      );
    });

    it("no modera la reseña de otro negocio", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.moderar("review-123", "otro-negocio", ReviewStatus.OCULTA)
      ).rejects.toThrow(NotFoundException);
    });

    it("registra la denuncia y suma al contador", async () => {
      mockRepo.findOne.mockResolvedValue(mockReview);

      await service.denunciar("review-123", "user-9", {
        reason: ReviewReportReason.OFENSIVA,
      });

      expect(mockManagerRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ reviewId: "review-123", userId: "user-9" })
      );
      expect(mockManagerRepo.increment).toHaveBeenCalledWith(
        { id: "review-123" },
        "reportCount",
        1
      );
    });

    it("la segunda denuncia del mismo usuario no vuelve a contar", async () => {
      mockRepo.findOne.mockResolvedValue(mockReview);
      mockDataSource.transaction.mockRejectedValueOnce({ code: "23505" });

      await expect(
        service.denunciar("review-123", "user-9", {
          reason: ReviewReportReason.SPAM,
        })
      ).resolves.toEqual({ denunciada: true });
    });

    it("solo lista las publicadas", async () => {
      const qb = mockRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.findByBusiness("business-123", {});

      expect(qb.andWhere).toHaveBeenCalledWith(
        "r.status = :publicada",
        expect.objectContaining({ publicada: ReviewStatus.PUBLICADA })
      );
    });
  });
});
