import { Test, TestingModule } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { OutboxService, InternalHttpClient } from "@beautyspot/nest-common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessesService } from "./businesses.service";
import { Business } from "../../entities/business.entity";
import { Branch } from "../../entities/branch.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";

describe("BusinessesService", () => {
  let service: BusinessesService;
  let mockRepository: jest.Mocked<Repository<Business>>;
  let mockBranchRepo: jest.Mocked<Repository<Branch>>;
  let mockServiceRepo: jest.Mocked<Repository<Service>>;
  let mockProfessionalRepo: jest.Mocked<Repository<Professional>>;
  let mockOutbox: { enqueue: jest.Mock };
  let mockHttp: { enviar: jest.Mock };

  const mockBusiness: Business = {
    id: "business-123",
    name: "Test Beauty Center",
    slug: "test-beauty-center",
    description: "A great beauty center",
    city: "Bogotá",
    businessType: "BARBERIA",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    branches: [],
    services: [],
    professionals: [],
    configs: [],
    hours: [],
    timezone: "America/Bogota",
    currency: "COP",
    locale: "es-CO",
    logo: "",
    coverImage: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    state: "",
    country: "",
    latitude: 0,
    longitude: 0,
    verified: false,
    planId: "",
    clients: [],
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBusiness], 1]),
      }),
    } as any;

    // Las colecciones del listado se piden por lote, no por join.
    mockBranchRepo = { find: jest.fn().mockResolvedValue([]) } as any;
    mockServiceRepo = { find: jest.fn().mockResolvedValue([]) } as any;
    mockProfessionalRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const mockOutboxSpec = mockOutbox;
    mockHttp = { enviar: jest.fn().mockResolvedValue({}) };
    const mockDataSourceSpec = {
      // La transacción entrega el mismo repositorio simulado del test.
      transaction: jest.fn((cb) =>
        cb({ getRepository: jest.fn().mockReturnValue(mockRepository) })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: DataSource, useValue: mockDataSourceSpec },
        { provide: OutboxService, useValue: mockOutboxSpec },
        { provide: InternalHttpClient, useValue: mockHttp },
        BusinessesService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockRepository,
        },
        { provide: getRepositoryToken(Branch), useValue: mockBranchRepo },
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProfessionalRepo,
        },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
  });

  describe("create", () => {
    it("debería crear un negocio exitosamente", async () => {
      const createData = {
        name: "Test Beauty Center",
        description: "A great beauty center",
        city: "Bogotá",
        businessType: "BELLEZA",
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);

      const result = await service.create(createData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: "test-beauty-center" },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createData,
        slug: "test-beauty-center",
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockBusiness);
      expect(result).toEqual(mockBusiness);
    });

    it("createWithOwner deja al creador como OWNER del negocio", async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);

      await service.createWithOwner({ name: "Mi Barberia" }, "user-1");

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "auth",
        "/internal/memberships",
        {
          userId: "user-1",
          businessId: mockBusiness.id,
          role: Role.OWNER,
        }
      );
    });

    it("createWithOwner deshace el negocio si la membresía no se puede crear", async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);
      mockHttp.enviar.mockRejectedValue(new Error("auth caido"));

      await expect(
        service.createWithOwner({ name: "Mi Barberia" }, "user-1")
      ).rejects.toThrow("auth caido");

      // Un negocio sin dueño dejaría al usuario sin acceso a lo que creó.
      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: mockBusiness.id,
      });
    });

    it("debería lanzar ConflictException si el slug ya existe", async () => {
      const createData = {
        name: "Test Beauty Center",
        description: "A great beauty center",
        city: "Bogotá",
      };

      mockRepository.findOne.mockResolvedValue(mockBusiness);

      await expect(service.create(createData)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createData)).rejects.toThrow(
        'El slug "test-beauty-center" ya existe'
      );
    });

    it("debería generar el slug correctamente desde el nombre", async () => {
      const createData = {
        name: "Barbería Elite 2024",
        description: "Test",
        city: "Medellín",
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockBusiness);
      mockRepository.save.mockResolvedValue(mockBusiness);

      await service.create(createData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createData,
        slug: "barberia-elite-2024",
      });
    });
  });

  describe("findAll", () => {
    it("debería retornar todos los negocios con paginación", async () => {
      const result = await service.findAll({});

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("b");
      // El mismo sobre que el resto de listados: sin eso, cada pantalla nueva
      // tiene que adivinar cual le toca abriendo el controlador.
      expect(result).toHaveProperty("data");
      expect(result.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean),
      });
    });

    it("no debe unir las colecciones al listado, sino pedirlas por lote", async () => {
      // Cada colección se pide aparte para la página devuelta.
      const queryBuilder = mockRepository.createQueryBuilder() as any;
      mockBranchRepo.find.mockResolvedValue([
        { businessId: "business-123", id: "sede-1" },
      ] as never);

      const result = await service.findAll({});

      expect(queryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
      expect(mockBranchRepo.find).toHaveBeenCalledTimes(1);
      expect(mockServiceRepo.find).toHaveBeenCalledTimes(1);
      expect(mockProfessionalRepo.find).toHaveBeenCalledTimes(1);
      expect(result.data[0].branches).toHaveLength(1);
      expect(result.data[0].services).toEqual([]);
    });

    it("debería filtrar por ciudad", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ city: "Bogotá" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith("b.city ILIKE :city", {
        city: "%Bogotá%",
      });
    });

    it("debería filtrar por tipo de negocio", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ businessType: "BELLEZA" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "b.business_type = :type",
        { type: "BELLEZA" }
      );
    });

    it("debería filtrar por estado activo", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ active: "true" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith("b.active = :active", {
        active: true,
      });
    });

    it("debería filtrar por estado inactivo", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ active: "false" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith("b.active = :active", {
        active: false,
      });
    });

    it("debería buscar por nombre o descripción", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ search: "barber" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(b.name ILIKE :search OR b.description ILIKE :search)",
        { search: "%barber%" }
      );
    });

    it("debería manejar caracteres especiales en búsqueda", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ search: "barber%shop" });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(b.name ILIKE :search OR b.description ILIKE :search)",
        { search: "%barber\\%shop%" }
      );
    });

    it("debería ordenar por nombre ascendente", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ sort: "name", order: "ASC" });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith("b.name", "ASC");
    });

    it("debería manejar paginación correctamente", async () => {
      const queryBuilder = mockRepository.createQueryBuilder() as any;

      await service.findAll({ page: "2", limit: "20" });

      expect(queryBuilder.skip).toHaveBeenCalledWith(20);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });
  });

  describe("findById", () => {
    it("debería retornar el negocio cuando existe", async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.findById("business-123");

      expect(result).toEqual(mockBusiness);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "business-123" },
        relations: {
          branches: true,
          services: true,
          professionals: true,
          configs: true,
          hours: true,
        },
      });
    });

    it("debería lanzar NotFoundException cuando el negocio no existe", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findById("non-existent")).rejects.toThrow(
        "Negocio no encontrado"
      );
    });
  });

  describe("findBySlug", () => {
    it("debería retornar el negocio cuando existe", async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.findBySlug("test-beauty-center");

      expect(result).toEqual(mockBusiness);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { slug: "test-beauty-center" },
        relations: {
          branches: true,
          services: true,
          professionals: true,
        },
      });
    });

    it("debería lanzar NotFoundException cuando el slug no existe", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findBySlug("non-existent")).rejects.toThrow(
        'Negocio "non-existent" no encontrado'
      );
    });
  });

  describe("update", () => {
    it("debería actualizar el negocio correctamente", async () => {
      const updateData = {
        name: "Updated Beauty Center",
        description: "Updated description",
      };

      const updatedBusiness = { ...mockBusiness, ...updateData } as any;

      mockRepository.findOne.mockResolvedValue(updatedBusiness);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update("business-123", updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(
        "business-123",
        updateData
      );
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(result.name).toBe("Updated Beauty Center");
      expect(result.description).toBe("Updated description");
    });

    it("publica el cambio para que el marketplace lo replique", async () => {
      const updateData = { logo: "https://cdn/logo.png" };

      mockRepository.findOne.mockResolvedValue({
        ...mockBusiness,
        ...updateData,
      } as any);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.update("business-123", updateData);

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "core.business.updated",
          aggregateId: "business-123",
          payload: expect.objectContaining({
            businessId: "business-123",
            slug: "test-beauty-center",
            changes: updateData,
          }),
        })
      );
    });

    it("debería manejar actualización parcial", async () => {
      const updateData = { city: "Medellín" };

      const updatedBusiness = { ...mockBusiness, city: "Medellín" } as any;

      mockRepository.findOne.mockResolvedValue(updatedBusiness);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update("business-123", updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(
        "business-123",
        updateData
      );
      expect(result.city).toBe("Medellín");
    });
  });

  describe("deactivate", () => {
    it("debería desactivar el negocio correctamente", async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate("business-123");

      expect(mockRepository.update).toHaveBeenCalledWith("business-123", {
        active: false,
      });
    });

    it("debería manejar negocios ya desactivados", async () => {
      mockRepository.findOne.mockResolvedValue(mockBusiness);
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.deactivate("business-123")).resolves.not.toThrow();
    });
  });

  describe("manejo de errores", () => {
    it("debería propagar errores del repositorio", async () => {
      mockRepository.findOne.mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(service.findById("business-123")).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(BusinessesService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.findAll).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findBySlug).toBe("function");
      expect(typeof service.update).toBe("function");
      expect(typeof service.deactivate).toBe("function");
    });
  });
});
