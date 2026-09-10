import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PublicService } from "./public.service";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { PreciosService } from "../precios/precios.service";

describe("PublicService", () => {
  let service: PublicService;
  let mockBusinessRepo: jest.Mocked<any>;
  let mockServiceRepo: jest.Mocked<any>;
  let mockProRepo: jest.Mocked<any>;
  let mockPrecios: jest.Mocked<any>;

  beforeEach(async () => {
    mockBusinessRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn(),
    } as any;

    mockServiceRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as any;

    mockProRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: "pro-1" }),
    } as any;

    // La regla de la tarifa se prueba donde vive; aquí importa a quién se
    // pregunta y qué se hace con la respuesta.
    mockPrecios = {
      tarifasDe: jest.fn().mockResolvedValue(new Map()),
      idsConTarifaPropia: jest.fn().mockResolvedValue(new Set()),
      resolver: jest.fn((servicio: any, propia: any) => ({
        id: servicio.id,
        name: servicio.name,
        price: propia?.customPrice ?? servicio.price,
        duration: propia?.customDuration ?? servicio.duration,
        procesadoDesde: null,
        procesadoMinutos: null,
        bufferDespues: 0,
      })),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProRepo,
        },
        { provide: PreciosService, useValue: mockPrecios },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  describe("listBusinesses", () => {
    it("debería listar negocios activos con field whitelist", async () => {
      await service.listBusinesses();
      expect(mockBusinessRepo.createQueryBuilder).toHaveBeenCalledWith("b");
    });

    it("debería filtrar por q cuando se proporciona", async () => {
      await service.listBusinesses("barber");
      const qb = mockBusinessRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith("b.name ILIKE :q", {
        q: "%barber%",
      });
    });

    it("debería filtrar por city cuando se proporciona", async () => {
      await service.listBusinesses(undefined, "Madrid");
      const qb = mockBusinessRepo.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith("b.city ILIKE :city", {
        city: "%Madrid%",
      });
    });
  });

  describe("getBusinessBySlug", () => {
    it("debería retornar negocio por slug con field whitelist (sin email/phone privado)", async () => {
      const mockBusiness = { id: "biz-1", slug: "test-biz", name: "Test" };
      mockBusinessRepo.findOne.mockResolvedValue(mockBusiness);

      const result = await service.getBusinessBySlug("test-biz");

      expect(result).toEqual(mockBusiness);
      expect(mockBusinessRepo.findOne).toHaveBeenCalledWith({
        where: { slug: "test-biz", active: true },
        select: expect.arrayContaining([
          "id",
          "slug",
          "name",
          "description",
          "city",
          "address",
        ]),
      });
    });

    it("debería retornar null si no existe", async () => {
      mockBusinessRepo.findOne.mockResolvedValue(null);
      const result = await service.getBusinessBySlug("no-existe");
      expect(result).toBeNull();
    });
  });

  describe("getBusinessServices", () => {
    /** Servicio del catálogo, como lo devuelve el repositorio. */
    const corte = {
      id: "svc-1",
      name: "Corte",
      description: "Corte clásico",
      category: "Cabello",
      price: 20000,
      duration: 30,
      procesadoDesde: null,
      procesadoMinutos: null,
      bufferDespues: 0,
    };

    it("debería listar servicios activos de un negocio", async () => {
      mockServiceRepo.find.mockResolvedValue([corte]);

      const result = await service.getBusinessServices("biz-1");

      expect(result).toEqual([
        {
          id: "svc-1",
          name: "Corte",
          description: "Corte clásico",
          category: "Cabello",
          price: 20000,
          duration: 30,
          precioVariable: false,
        },
      ]);
      expect(mockServiceRepo.find).toHaveBeenCalledWith({
        where: { businessId: "biz-1", active: true },
        select: expect.arrayContaining(["id", "name", "price", "duration"]),
      });
    });

    // El escaparate enseñaba el precio del catálogo y la agenda cobraba el del
    // par servicio-profesional: prometer un precio y cobrar otro.
    it("con profesional elegido devuelve su tarifa, que es la que se cobra", async () => {
      mockServiceRepo.find.mockResolvedValue([corte]);
      mockPrecios.tarifasDe.mockResolvedValue(
        new Map([["svc-1", { customPrice: 45000, customDuration: 45 }]])
      );

      const [servicio] = await service.getBusinessServices("biz-1", "pro-1");

      expect(servicio.price).toBe(45000);
      expect(servicio.duration).toBe(45);
      expect(mockPrecios.tarifasDe).toHaveBeenCalledWith(["svc-1"], "pro-1");
    });

    it("sin tarifa propia, el profesional cobra lo del catálogo", async () => {
      mockServiceRepo.find.mockResolvedValue([corte]);

      const [servicio] = await service.getBusinessServices("biz-1", "pro-1");

      expect(servicio.price).toBe(20000);
      expect(servicio.duration).toBe(30);
    });

    // Sin profesional el precio aún no está decidido: lo elige el servidor al
    // reservar, así que lo único honesto es decir «desde».
    it("marca los servicios cuyo precio depende de quién atienda", async () => {
      mockServiceRepo.find.mockResolvedValue([corte]);
      mockPrecios.idsConTarifaPropia.mockResolvedValue(new Set(["svc-1"]));

      const [servicio] = await service.getBusinessServices("biz-1");

      expect(servicio.precioVariable).toBe(true);
      expect(mockPrecios.tarifasDe).not.toHaveBeenCalled();
    });

    it("no aplica la tarifa de un profesional de otro negocio", async () => {
      mockServiceRepo.find.mockResolvedValue([corte]);
      mockProRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getBusinessServices("biz-1", "pro-ajeno")
      ).rejects.toThrow("no es de este negocio");
      expect(mockPrecios.tarifasDe).not.toHaveBeenCalled();
    });
  });

  describe("getBusinessProfessionals", () => {
    it("debería listar profesionales activos de un negocio", async () => {
      const mockPros = [
        {
          id: "pro-1",
          name: "David",
          photo: null,
          bio: "Test",
          specialties: [],
        },
      ];
      mockProRepo.find.mockResolvedValue(mockPros);

      const result = await service.getBusinessProfessionals("biz-1");

      expect(result).toEqual(mockPros);
      expect(mockProRepo.find).toHaveBeenCalledWith({
        where: { businessId: "biz-1", active: true },
        select: [
          "id",
          "name",
          "photo",
          "bio",
          "specialties",
          "yearsExp",
          "rating",
          "totalReviews",
        ],
      });
    });

    it("incluye el nombre y la foto, que son lo que pinta la reserva", async () => {
      mockProRepo.find.mockResolvedValue([]);

      await service.getBusinessProfessionals("biz-1");

      const { select } = mockProRepo.find.mock.calls[0][0];
      expect(select).toContain("name");
      expect(select).toContain("photo");
    });
  });
});
