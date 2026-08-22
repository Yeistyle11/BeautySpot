import { RedisCacheService } from "@beautyspot/nest-common";
import { Test } from "@nestjs/testing";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { FeedService } from "./feed.service";
import { TIPOS_DE_NEGOCIO } from "@beautyspot/shared-constants";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";

describe("FeedService", () => {
  let service: FeedService;
  let mockBusinessService: jest.Mocked<BusinessProfilesService>;
  let mockProfessionalService: jest.Mocked<ProfessionalProfilesService>;

  const mockBusinessProfile: BusinessProfileEntity = {
    id: "profile-123",
    businessId: "business-123",
    slug: "elite-barbers",
    name: "BeautySpot Center",
    rating: 4.8,
    totalReviews: 100,
    profileCompleteness: 85,
    active: true,
    isPublished: true,
    city: "Bogotá",
    lat: 4.711,
    lng: -74.072,
    businessType: "barbería",
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfessionalProfile: ProfessionalProfileEntity = {
    id: "prof-profile-123",
    businessId: "business-123",
    professionalId: "prof-123",
    slug: "juan-perez",
    name: "Juan Pérez",
    specialties: ["Cortes", "Barba"],
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
      // Las categorías salen ahora de un GROUP BY, no de una consulta por cada una.
      contarPorTipo: jest.fn().mockResolvedValue(new Map()),
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
        {
          // Caché transparente: ejecuta siempre el cargador, de modo que los
          // tests siguen verificando la composición real y no un valor servido.
          provide: RedisCacheService,
          useValue: {
            remember: jest.fn(
              (_clave: string, _ttl: number, cargar: () => Promise<unknown>) =>
                cargar()
            ),
            delByPrefix: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  /** Una página del listado de perfiles, con el sobre que devuelve el servicio. */
  function pagina(data: BusinessProfileEntity[]) {
    return {
      data,
      meta: {
        page: 1,
        limit: 10,
        total: data.length,
        totalPages: data.length ? 1 : 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }

  describe("getFeed", () => {
    it("debería retornar feed completo sin ubicación", async () => {
      mockBusinessService.findPublished.mockResolvedValue(
        pagina([mockBusinessProfile])
      );
      mockBusinessService.findTopRated.mockResolvedValue([mockBusinessProfile]);
      mockBusinessService.findRecent.mockResolvedValue([mockBusinessProfile]);
      mockProfessionalService.findTopRated.mockResolvedValue([
        mockProfessionalProfile,
      ]);

      const result = await service.getFeed();

      expect(result.categories).toHaveLength(TIPOS_DE_NEGOCIO.length);
      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].id).toBe("popular_nearby");
    });

    it("debería filtrar por ubicación si se proporciona", async () => {
      mockBusinessService.findPublished.mockResolvedValue(pagina([]));
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed(4.711, -74.072, "Bogotá");

      expect(mockBusinessService.findPublished).toHaveBeenCalledWith({
        lat: 4.711,
        lng: -74.072,
        city: "Bogotá",
        radius: 25,
        limit: 10,
        page: 1,
        orderBy: "rating",
      });
      expect(result).toBeDefined();
    });

    it("no debería incluir secciones vacías", async () => {
      mockBusinessService.findPublished.mockResolvedValue(pagina([]));
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed();

      expect(result.sections).toHaveLength(0);
      expect(result.categories).toHaveLength(TIPOS_DE_NEGOCIO.length);
    });

    it("debería calcular categorías correctamente", async () => {
      mockBusinessService.contarPorTipo.mockResolvedValue(
        new Map([
          ["SALON", 7],
          ["SPA", 2],
        ])
      );
      mockBusinessService.findPublished.mockResolvedValue(pagina([]));
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed();

      // Un solo GROUP BY para todas las categorías, en vez de una consulta por
      // cada una que además traía una fila de perfil para descartarla.
      expect(mockBusinessService.contarPorTipo).toHaveBeenCalledTimes(1);
      expect(result.categories).toEqual([
        expect.objectContaining({ id: "BARBERIA", count: 0 }),
        expect.objectContaining({ id: "SALON", count: 7 }),
        expect.objectContaining({ id: "SPA", count: 2 }),
        expect.objectContaining({ id: "BELLEZA", count: 0 }),
      ]);
    });

    // Un tipo que se pueda elegir al crear el negocio y que no sea categoría de
    // la portada deja al local fuera de todos los filtros.
    it("ofrece una categoría por cada tipo de negocio que admite el alta", async () => {
      mockBusinessService.contarPorTipo.mockResolvedValue(new Map());
      mockBusinessService.findPublished.mockResolvedValue(pagina([]));
      mockBusinessService.findTopRated.mockResolvedValue([]);
      mockBusinessService.findRecent.mockResolvedValue([]);
      mockProfessionalService.findTopRated.mockResolvedValue([]);

      const result = await service.getFeed();

      expect(result.categories.map((c) => c.id)).toEqual(
        TIPOS_DE_NEGOCIO.map((t) => t.valor)
      );
    });
  });
});
