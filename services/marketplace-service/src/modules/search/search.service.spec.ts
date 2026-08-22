import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SearchService } from "./search.service";
import { RedisCacheService } from "@beautyspot/nest-common";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";

describe("SearchService", () => {
  let service: SearchService;
  let cache: { remember: jest.Mock };
  let mockBusinessRepo: jest.Mocked<Repository<BusinessProfileEntity>>;
  let mockProRepo: jest.Mocked<Repository<ProfessionalProfileEntity>>;

  const mockBusinessProfile: BusinessProfileEntity = {
    id: "biz-123",
    businessId: "business-123",
    slug: "elite-barbers",
    name: "BeautySpot Center",
    description: "Mejor beautyspot de la ciudad",
    address: "Calle 123",
    city: "Bogotá",
    rating: 4.8,
    totalReviews: 150,
    businessType: "BARBERSHOP",
    active: true,
    isPublished: true,
    lat: 4.711,
    lng: -74.0721,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfessionalProfile: ProfessionalProfileEntity = {
    id: "prof-123",
    professionalId: "prof-123",
    businessId: "business-123",
    name: "Carlos Estilista",
    bio: "Especialista en cortes modernos",
    rating: 4.9,
    totalReviews: 89,
    specialties: ["Corte", "Barba", "Tinte"],
    active: true,
    visibleOnProfile: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as any;

    mockBusinessRepo = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as any;

    mockProRepo = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as any;

    // Caché que guarda de verdad, para poder comprobar que la segunda búsqueda
    // igual no vuelve a la base.
    const guardado = new Map<string, unknown>();
    cache = {
      remember: jest.fn(async (clave: string, _ttl: number, cargar: any) => {
        if (guardado.has(clave)) return guardado.get(clave);
        const valor = await cargar();
        guardado.set(clave, valor);
        return valor;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(BusinessProfileEntity),
          useValue: mockBusinessRepo,
        },
        {
          provide: getRepositoryToken(ProfessionalProfileEntity),
          useValue: mockProRepo,
        },
        { provide: RedisCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe("search", () => {
    it("debería buscar negocios por defecto", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockBusinessProfile],
        1,
      ]);

      const result = await service.search({});

      expect(result.type).toBe("business");
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("debería buscar profesionales si type es professional", async () => {
      const qb = mockProRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockProfessionalProfile],
        1,
      ]);

      const result = await service.search({ type: "professional" });

      expect(result.type).toBe("professional");
      expect(result.data).toHaveLength(1);
      expect(mockProRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it("debería buscar ambos si type es all", async () => {
      const bizQb = mockBusinessRepo.createQueryBuilder();
      const proQb = mockProRepo.createQueryBuilder();
      (bizQb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockBusinessProfile],
        1,
      ]);
      (proQb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockProfessionalProfile],
        1,
      ]);

      const result = await service.search({ type: "all" });

      expect(result.type).toBe("all");
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it("debería limitar resultados a 50 máximo", async () => {
      const bizQb = mockBusinessRepo.createQueryBuilder();
      const proQb = mockProRepo.createQueryBuilder();
      (bizQb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockBusinessProfile],
        10,
      ]);
      (proQb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockProfessionalProfile],
        15,
      ]);

      await service.search({ type: "all", limit: 100 });

      const takeCall = bizQb.take as jest.Mock;
      expect(takeCall.mock.calls[0][0]).toBe(50);
    });
  });

  describe("searchBusinesses (private)", () => {
    it("debería filtrar por búsqueda de texto", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ q: "barber" });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("translate(lower(bp.name)"),
        expect.any(Object)
      );
    });

    it("encuentra a quien lleva tilde escribiendo sin ella", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ q: "Perez" });

      const [, parametros] = (qb.andWhere as jest.Mock).mock.calls.find(
        ([sql]: [string]) => sql.includes("bp.name")
      );
      // El patrón viaja ya normalizado, como la columna con la que se compara.
      expect(parametros.q).toBe("%perez%");
    });

    it("debería filtrar por ciudad", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ city: "Bogotá" });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("translate(lower(bp.city)"),
        expect.objectContaining({ city: "%bogota%" })
      );
    });

    it("debería filtrar por tipo de negocio", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ businessType: "BARBERSHOP" });

      expect(qb.andWhere).toHaveBeenCalledWith(
        "bp.business_type = :businessType",
        { businessType: "BARBERSHOP" }
      );
    });

    it("debería filtrar por rating mínimo", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ ratingMin: 4.5 });

      expect(qb.andWhere).toHaveBeenCalledWith("bp.rating >= :ratingMin", {
        ratingMin: 4.5,
      });
    });

    it("debería ordenar por rating descendente por defecto", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({});

      expect(qb.orderBy).toHaveBeenCalledWith("bp.rating", "DESC");
    });
  });

  describe("searchProfessionals (private)", () => {
    it("debería filtrar profesionales activos y visibles", async () => {
      const qb = mockProRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([
        [mockProfessionalProfile],
        1,
      ]);

      await service.search({ type: "professional" });

      expect(qb.where).toHaveBeenCalledWith("pp.active = :active", {
        active: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "pp.visible_on_profile = :visible",
        { visible: true }
      );
    });

    it("debería hacer join con business_profiles para filtrar por ciudad", async () => {
      const qb = mockProRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ type: "professional", city: "Medellín" });

      expect(qb.innerJoin).toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("translate(lower(bp.city)"),
        expect.any(Object)
      );
    });
  });

  describe("caché", () => {
    it("no vuelve a la base con la misma búsqueda", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ q: "barber", page: 1 });
      await service.search({ q: "barber", page: 1 });

      expect(qb.getManyAndCount).toHaveBeenCalledTimes(1);
    });

    it("distingue las búsquedas que no son la misma", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ q: "barber", page: 1 });
      await service.search({ q: "barber", page: 2 });

      expect(qb.getManyAndCount).toHaveBeenCalledTimes(2);
    });

    it("comparte entrada entre visitantes de la misma zona", async () => {
      const qb = mockBusinessRepo.createQueryBuilder();
      (qb.getManyAndCount as jest.Mock).mockResolvedValue([[], 0]);

      await service.search({ lat: 4.7112, lng: -74.0721 });
      await service.search({ lat: 4.7118, lng: -74.0725 });

      expect(qb.getManyAndCount).toHaveBeenCalledTimes(1);
    });
  });
});
