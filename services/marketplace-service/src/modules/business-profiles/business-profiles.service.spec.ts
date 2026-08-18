import { RedisCacheService } from "@beautyspot/nest-common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessProfilesService } from "./business-profiles.service";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";

describe("BusinessProfilesService", () => {
  let service: BusinessProfilesService;
  let mockRepo: jest.Mocked<Repository<BusinessProfileEntity>>;
  let mockProfessionalService: jest.Mocked<any>;

  const mockBusinessProfile: BusinessProfileEntity = {
    id: "profile-123",
    businessId: "business-123",
    slug: "elite-barbers",
    name: "BeautySpot Center",
    description: "Mejores cortes de la ciudad",
    logo: "logo.jpg",
    coverImage: "cover.jpg",
    address: "Calle 123",
    city: "Bogotá",
    lat: 4.711,
    lng: -74.072,
    businessType: "barbería",
    active: true,
    isPublished: true,
    rating: 4.8,
    totalReviews: 100,
    profileCompleteness: 85,
    sectionConfig: { sections: [{ id: "story", enabled: true, order: 1 }] },
    galleryImages: [
      { url: "img1.jpg", title: "Corte moderno", featured: true },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockProfessional: ProfessionalProfileEntity = {
    id: "prof-123",
    businessId: "business-123",
    slug: "juan-perez",
    name: "Juan Pérez",
    specialties: ["Cortes", "Barba"],
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
      countBy: jest.fn(),
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
    (mockRepo.manager.createQueryBuilder as any).mockReturnValue(
      mockQueryBuilder
    );

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
        {
          // Caché transparente: ejecuta siempre el cargador, de modo que los
          // tests siguen verificando la composición real y no un valor servido.
          provide: RedisCacheService,
          useValue: {
            remember: jest.fn(
              (_clave: string, _ttl: number, cargar: () => Promise<unknown>) =>
                cargar()
            ),
            invalidarEtiqueta: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessProfilesService>(BusinessProfilesService);
  });

  describe("createOrUpdate", () => {
    it("debería crear un nuevo perfil", async () => {
      const dto = {
        businessId: "business-123",
        name: "BeautySpot Center",
        slug: "elite-barbers",
        description: "Mejores cortes",
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

    it("debería actualizar un perfil existente", async () => {
      const dto = {
        businessId: "business-123",
        name: "BeautySpot Center Updated",
        slug: "elite-barbers",
        description: "Mejores cortes actualizados",
      };

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.createOrUpdate(dto);

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockBusinessProfile);
    });
  });

  describe("findBySlug", () => {
    it("debería retornar perfil y profesionales por slug", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([
        mockProfessional,
      ]);

      const result = await service.findBySlug("elite-barbers");

      expect(result).toEqual({
        profile: mockBusinessProfile,
        professionals: [mockProfessional],
      });
    });

    it("debería lanzar NotFoundException si el perfil no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        "Perfil de negocio no encontrado"
      );
    });

    it("no debería retornar profesionales si team section está deshabilitado", async () => {
      const profileWithDisabledTeam = {
        ...mockBusinessProfile,
        sectionConfig: {
          sections: [{ id: "team", enabled: false, order: 3 }],
        },
        generateId: () => {},
      } as any;

      mockRepo.findOne.mockResolvedValue(profileWithDisabledTeam);

      const result = await service.findBySlug("elite-barbers");

      expect(result.professionals).toEqual([]);
      expect(
        mockProfessionalService.findVisibleByBusiness
      ).not.toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("debería publicar un perfil exitosamente", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);

      const result = await service.publish("business-123");

      expect(mockBusinessProfile.isPublished).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(mockBusinessProfile);
      expect(result).toEqual(mockBusinessProfile);
    });

    it("debería lanzar BadRequestException si faltan datos requeridos", async () => {
      const incompleteProfile = {
        ...mockBusinessProfile,
        name: "",
        slug: "",
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(incompleteProfile);

      await expect(service.publish("business-123")).rejects.toThrow(
        BadRequestException
      );
      await expect(service.publish("business-123")).rejects.toThrow(
        "El perfil debe tener nombre y slug para publicarse"
      );
    });
  });

  describe("unpublish", () => {
    it("debería despublicar un perfil exitosamente", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);

      const result = await service.unpublish("business-123");

      expect(mockBusinessProfile.isPublished).toBe(false);
      expect(mockRepo.save).toHaveBeenCalledWith(mockBusinessProfile);
      expect(result).toEqual(mockBusinessProfile);
    });
  });

  describe("addGalleryImages", () => {
    it("debería agregar imágenes a la galería", async () => {
      const dto = {
        images: [
          { url: "img2.jpg", title: "Nuevo corte" },
          { url: "img3.jpg", title: "Barba" },
        ],
      };

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.addGalleryImages("business-123", dto);

      expect(result.galleryImages).toHaveLength(3);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe("removeGalleryImage", () => {
    it("debería eliminar una imagen de la galería", async () => {
      const updatedProfile = {
        ...mockBusinessProfile,
        galleryImages: [],
        generateId: () => {},
      } as any;

      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockRepo.save.mockResolvedValue(updatedProfile);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.removeGalleryImage("business-123", 0);

      expect(result.galleryImages).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el índice es inválido", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);

      await expect(
        service.removeGalleryImage("business-123", 10)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeGalleryImage("business-123", 10)
      ).rejects.toThrow("Indice de imagen invalido");
    });
  });

  describe("findTopRated", () => {
    it("debería retornar los perfiles mejor calificados", async () => {
      const topRated = [mockBusinessProfile];
      mockRepo.find.mockResolvedValue(topRated);

      const result = await service.findTopRated(10);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { active: true, isPublished: true },
        order: { rating: "DESC" },
        take: 10,
      });
      expect(result).toEqual(topRated);
    });
  });

  describe("findByBusinessId", () => {
    it("debería retornar perfil por businessId", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);

      const result = await service.findByBusinessId("business-123");

      expect(result).toEqual(mockBusinessProfile);
    });

    it("debería lanzar NotFoundException si no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByBusinessId("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("findById", () => {
    it("devuelve el perfil por id", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      const result = await service.findById("profile-123");
      expect(result).toEqual(mockBusinessProfile);
    });

    it("lanza NotFound si no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById("x")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findProfessionalBySlug", () => {
    it("devuelve el profesional cuando pertenece al negocio", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findBySlug.mockResolvedValue(mockProfessional);

      const result = await service.findProfessionalBySlug(
        "elite-barbers",
        "juan-perez"
      );

      expect(result).toEqual(mockProfessional);
    });

    it("lanza NotFound si el negocio no existe o no está publicado", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findProfessionalBySlug("x", "y")).rejects.toThrow(
        NotFoundException
      );
    });

    it("lanza NotFound si la sección de equipo está deshabilitada", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockBusinessProfile,
        sectionConfig: { sections: [{ id: "team", enabled: false, order: 3 }] },
      } as any);
      await expect(
        service.findProfessionalBySlug("elite-barbers", "juan-perez")
      ).rejects.toThrow("Seccion de equipo no disponible");
    });

    it("lanza NotFound si el profesional es de otro negocio", async () => {
      mockRepo.findOne.mockResolvedValue(mockBusinessProfile);
      mockProfessionalService.findBySlug.mockResolvedValue({
        ...mockProfessional,
        businessId: "otro-negocio",
      });
      await expect(
        service.findProfessionalBySlug("elite-barbers", "juan-perez")
      ).rejects.toThrow("Profesional no encontrado en este negocio");
    });
  });

  describe("updateConfig", () => {
    it("actualiza los campos del perfil inmersivo y recalcula completitud", async () => {
      const profile = { ...mockBusinessProfile } as any;
      mockRepo.findOne.mockResolvedValue(profile);
      mockRepo.save.mockImplementation(async (p) => p as any);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);

      const result = await service.updateConfig("business-123", {
        tagline: "Tu estilo, nuestra pasión",
        storyTitle: "Nuestra historia",
        storyText: "Texto",
        storyImage: "story.jpg",
        foundedYear: 2015,
        founders: "Juan y Ana",
        socialLinks: { instagram: "@x" },
        sectionConfig: [{ id: "story", enabled: true, order: 1 }],
      } as any);

      expect(result.tagline).toBe("Tu estilo, nuestra pasión");
      expect(result.sectionConfig).toEqual({
        sections: [{ id: "story", enabled: true, order: 1 }],
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe("updateGalleryImage", () => {
    it("actualiza los metadatos de una imagen por índice", async () => {
      const profile = {
        ...mockBusinessProfile,
        galleryImages: [{ url: "img1.jpg", title: "viejo" }],
      } as any;
      mockRepo.findOne.mockResolvedValue(profile);
      mockRepo.save.mockImplementation(async (p) => p as any);

      const result = await service.updateGalleryImage("business-123", {
        index: 0,
        title: "nuevo",
        featured: true,
      } as any);

      expect(result.galleryImages![0].title).toBe("nuevo");
      expect(result.galleryImages![0].featured).toBe(true);
    });

    it("lanza BadRequest si el índice es inválido", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockBusinessProfile,
        galleryImages: [],
      } as any);
      await expect(
        service.updateGalleryImage("business-123", { index: 0 } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findPublished", () => {
    it("ordena por rating por defecto y filtra por ciudad y tipo", async () => {
      const qb = mockRepo.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[mockBusinessProfile], 1]);

      const result = await service.findPublished({
        city: "Bogotá",
        businessType: "barbería",
      });

      expect(result).toEqual({ items: [mockBusinessProfile], total: 1 });
      expect(qb.orderBy).toHaveBeenCalledWith("bp.rating", "DESC");
    });

    it("ordena por fecha cuando orderBy es createdAt", async () => {
      const qb = mockRepo.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublished({ orderBy: "createdAt" });

      expect(qb.orderBy).toHaveBeenCalledWith("bp.created_at", "DESC");
    });

    it("aplica filtro y orden por distancia con lat/lng", async () => {
      const qb = mockRepo.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[mockBusinessProfile], 1]);

      await service.findPublished({ lat: 4.7, lng: -74.0, radius: 5 });

      expect(qb.setParameters).toHaveBeenCalled();
    });
  });

  describe("findRecent", () => {
    it("devuelve perfiles recientes priorizando los más completos", async () => {
      const qb = mockRepo.createQueryBuilder() as any;
      qb.getMany.mockResolvedValue([mockBusinessProfile]);

      const result = await service.findRecent(30, 10);

      expect(result).toEqual([mockBusinessProfile]);
      expect(qb.orderBy).toHaveBeenCalledWith(
        "bp.profile_completeness",
        "DESC"
      );
    });
  });

  describe("updateRating", () => {
    const ratingQb = (avg: string | null, count: string) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avg, count }),
    });

    it("calcula media y total de reseñas y actualiza el perfil", async () => {
      (mockRepo.manager.createQueryBuilder as any).mockReturnValue(
        ratingQb("4.5", "10")
      );

      await service.updateRating("business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { businessId: "business-123" },
        { rating: 4.5, totalReviews: 10 }
      );
    });

    it("deja rating en 0 cuando no hay reseñas", async () => {
      (mockRepo.manager.createQueryBuilder as any).mockReturnValue(
        ratingQb(null, "0")
      );

      await service.updateRating("business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { businessId: "business-123" },
        { rating: 0, totalReviews: 0 }
      );
    });

    it("usa el manager de la transacción cuando se pasa", async () => {
      const managerUpdate = jest.fn();
      const managerQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: "5", count: "2" }),
      };
      const manager: any = {
        getRepository: jest.fn().mockReturnValue({ update: managerUpdate }),
        createQueryBuilder: jest.fn().mockReturnValue(managerQb),
      };

      await service.updateRating("business-123", manager);

      expect(managerUpdate).toHaveBeenCalledWith(
        { businessId: "business-123" },
        { rating: 5, totalReviews: 2 }
      );
    });
  });

  describe("createOrUpdate (perfil completo)", () => {
    it("calcula alta completitud para un perfil con todos los bloques", async () => {
      const rich = {
        businessId: "business-999",
        name: "Completo",
        description: "desc",
        logo: "logo.jpg",
        coverImage: "cover.jpg",
        storyText: "x".repeat(150),
        storyImage: "story.jpg",
        galleryImages: Array.from({ length: 6 }, (_, i) => ({
          url: `g${i}.jpg`,
        })),
        socialLinks: { instagram: "@x", facebook: "fb" },
        address: "Calle 1",
        city: "Bogotá",
        lat: 4.7,
        lng: -74.0,
        sectionConfig: { sections: [] },
        isPublished: true,
        tagline: "lema",
      } as any;

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(rich);
      mockRepo.save.mockImplementation(async (p) => p as any);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([
        mockProfessional,
        mockProfessional,
        mockProfessional,
      ]);

      const result = await service.createOrUpdate(rich);

      expect(result.profileCompleteness).toBeGreaterThan(80);
    });
  });

  describe("crearParaNegocio", () => {
    const alta = { name: "Barbería La Noche", businessType: "BARBERIA" };

    /** Deja el repositorio como una base vacía: ni perfil ni enlace ocupados. */
    function sinNadaCreado() {
      (mockRepo.findOne as jest.Mock).mockResolvedValue(null);
      (mockRepo.countBy as jest.Mock).mockResolvedValue(0);
      (mockRepo.create as jest.Mock).mockImplementation((d) => d);
      (mockRepo.save as jest.Mock).mockImplementation(async (d) => d);
      mockProfessionalService.findVisibleByBusiness.mockResolvedValue([]);
    }

    it("deriva el enlace del nombre cuando el dueño no elige ninguno", async () => {
      sinNadaCreado();

      const perfil = await service.crearParaNegocio("business-123", alta);

      expect(perfil.slug).toBe("barberia-la-noche");
      expect(perfil.businessId).toBe("business-123");
    });

    it("respeta el enlace que escribe el dueño", async () => {
      sinNadaCreado();

      const perfil = await service.crearParaNegocio("business-123", {
        ...alta,
        slug: "la-noche",
      });

      expect(perfil.slug).toBe("la-noche");
    });

    it("numera el enlace derivado si el primero está tomado", async () => {
      sinNadaCreado();
      (mockRepo.countBy as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValue(0);

      const perfil = await service.crearParaNegocio("business-123", alta);

      expect(perfil.slug).toBe("barberia-la-noche-2");
    });

    // El enlace escrito a mano puede estar ya repartido: cambiarlo en silencio
    // rompería lo que el dueño repartió, así que se le devuelve la decisión.
    it("rechaza el enlace escrito si ya está en uso", async () => {
      sinNadaCreado();
      (mockRepo.countBy as jest.Mock).mockResolvedValue(1);

      await expect(
        service.crearParaNegocio("business-123", { ...alta, slug: "la-noche" })
      ).rejects.toThrow(ConflictException);
    });

    it("rechaza el alta si el negocio ya tiene perfil", async () => {
      (mockRepo.findOne as jest.Mock).mockResolvedValue(mockBusinessProfile);

      await expect(
        service.crearParaNegocio("business-123", alta)
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it("pide un enlace a mano si el nombre no da ninguno", async () => {
      sinNadaCreado();

      await expect(
        service.crearParaNegocio("business-123", { ...alta, name: "%%%" })
      ).rejects.toThrow(BadRequestException);
    });

    // Las comprobaciones previas no son atómicas: la segunda alta simultánea
    // llega hasta el índice único, y debe salir como conflicto y no como un 500.
    it("traduce el choque de índice único del negocio", async () => {
      sinNadaCreado();
      (mockRepo.save as jest.Mock).mockRejectedValue({
        code: "23505",
        constraint: "uq_business_profiles_negocio",
      });

      await expect(
        service.crearParaNegocio("business-123", alta)
      ).rejects.toThrow("Este negocio ya tiene perfil en el marketplace");
    });

    it("traduce el choque de índice único del enlace", async () => {
      sinNadaCreado();
      // El nombre es el de la restricción de slug que crea InitialSchema.
      (mockRepo.save as jest.Mock).mockRejectedValue({
        code: "23505",
        constraint: "UQ_5f66561947eba2379b1cff44370",
      });

      await expect(
        service.crearParaNegocio("business-123", alta)
      ).rejects.toThrow("Ese enlace ya está en uso, elige otro");
    });

    it("no propaga como conflicto un error que no sea de unicidad", async () => {
      sinNadaCreado();
      (mockRepo.save as jest.Mock).mockRejectedValue(new Error("conexión"));

      await expect(
        service.crearParaNegocio("business-123", alta)
      ).rejects.toThrow("conexión");
    });

    // Publicar es una decisión aparte, con su propio botón: el alta solo deja
    // el escaparate montado.
    it("nace sin publicar y con las secciones por defecto", async () => {
      sinNadaCreado();

      const perfil = await service.crearParaNegocio("business-123", alta);

      expect(perfil.isPublished).toBeFalsy();
      expect(perfil.sectionConfig?.sections).toHaveLength(6);
    });
  });
});
