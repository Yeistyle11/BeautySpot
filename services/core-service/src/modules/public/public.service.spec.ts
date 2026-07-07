import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PublicService } from "./public.service";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";

describe("PublicService", () => {
  let service: PublicService;
  let mockBusinessRepo: jest.Mocked<any>;
  let mockServiceRepo: jest.Mocked<any>;
  let mockProRepo: jest.Mocked<any>;

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
    it("debería listar servicios activos de un negocio", async () => {
      const mockServices = [
        { id: "svc-1", name: "Corte", price: 20, duration: 30 },
      ];
      mockServiceRepo.find.mockResolvedValue(mockServices);

      const result = await service.getBusinessServices("biz-1");

      expect(result).toEqual(mockServices);
      expect(mockServiceRepo.find).toHaveBeenCalledWith({
        where: { businessId: "biz-1", active: true },
        select: ["id", "name", "description", "price", "duration", "category"],
      });
    });
  });

  describe("getBusinessProfessionals", () => {
    it("debería listar profesionales activos de un negocio", async () => {
      const mockPros = [{ id: "pro-1", bio: "Test", specialties: [] }];
      mockProRepo.find.mockResolvedValue(mockPros);

      const result = await service.getBusinessProfessionals("biz-1");

      expect(result).toEqual(mockPros);
      expect(mockProRepo.find).toHaveBeenCalledWith({
        where: { businessId: "biz-1", active: true },
        select: [
          "id",
          "bio",
          "specialties",
          "yearsExp",
          "rating",
          "totalReviews",
        ],
      });
    });
  });
});
