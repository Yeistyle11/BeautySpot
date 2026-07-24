import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClientsService } from "./clients.service";
import { Client } from "../../entities/client.entity";
import { NotFoundException } from "@nestjs/common";

describe("ClientsService", () => {
  let service: ClientsService;
  let mockRepo: jest.Mocked<Repository<Client>>;

  const mockClient: Client = {
    id: "client-123",
    businessId: "business-123",
    userId: "user-123",
    name: "Juan Pérez",
    email: "juan@example.com",
    phone: "+573001234567",
    notes: "",
    tags: [],
    loyaltyPoints: 100,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {} as any,
    generateId: () => {},
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn(),
      increment: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getRepositoryToken(Client),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  describe("create", () => {
    it("debería crear un cliente exitosamente", async () => {
      const data = {
        name: "Juan Pérez",
        email: "juan@example.com",
        phone: "+573001234567",
      };

      mockRepo.create.mockReturnValue(mockClient);
      mockRepo.save.mockResolvedValue(mockClient);

      const result = await service.create("business-123", data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: "business-123",
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockClient);
      expect(result).toEqual(mockClient);
    });

    it("debería propagar errores del repositorio", async () => {
      mockRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create("business-123", {})).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("findByBusiness", () => {
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "name",
      order: "ASC" as const,
    };

    it("devuelve una página de clientes activos con meta", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockClient], 1]);

      const result = await service.findByBusiness(
        "business-123",
        undefined,
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", active: true },
          order: { name: "ASC" },
          skip: 0,
          take: 20,
        })
      );
      expect(result.data).toEqual([mockClient]);
      expect(result.meta.total).toBe(1);
    });

    it("debería buscar clientes por nombre/email/teléfono (OR)", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockClient], 1]);

      const result = await service.findByBusiness(
        "business-123",
        "Juan",
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ name: expect.any(Object) }),
            expect.objectContaining({ email: expect.any(Object) }),
            expect.objectContaining({ phone: expect.any(Object) }),
          ]),
        })
      );
      expect(result.data).toEqual([mockClient]);
    });

    it("debería manejar caracteres especiales en búsqueda", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockClient], 1]);

      await service.findByBusiness("business-123", "Juan%", pagination);

      expect(mockRepo.findAndCount).toHaveBeenCalled();
    });

    it("devuelve una página vacía si no hay clientes", async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByBusiness(
        "business-123",
        undefined,
        pagination
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe("findById", () => {
    it("debería retornar el cliente cuando existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);

      const result = await service.findById("client-123", "business-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "client-123", businessId: "business-123" },
      });
      expect(result).toEqual(mockClient);
    });

    it("debería lanzar NotFoundException cuando el cliente no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow("Cliente no encontrado");
    });
  });

  describe("findByUserId", () => {
    it("debería retornar el cliente cuando existe", async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);

      const result = await service.findByUserId("user-123", "business-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", businessId: "business-123", active: true },
      });
      expect(result).toEqual(mockClient);
    });

    it("debería retornar null cuando el cliente no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findByUserId("user-456", "business-123");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("debería actualizar el cliente correctamente", async () => {
      const updateData = {
        name: "Juan Pérez Actualizado",
        phone: "+573009876543",
      };

      const updatedClient = { ...mockClient, ...updateData } as any;

      mockRepo.findOne.mockResolvedValue(updatedClient);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.update(
        "client-123",
        "business-123",
        updateData
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        updateData
      );
      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result.name).toBe("Juan Pérez Actualizado");
      expect(result.phone).toBe("+573009876543");
    });
  });

  describe("addLoyaltyPoints", () => {
    it("debería agregar puntos de lealtad correctamente", async () => {
      mockRepo.increment.mockResolvedValue({ affected: 1 } as any);

      await service.addLoyaltyPoints("client-123", "business-123", 50);

      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        "loyaltyPoints",
        50
      );
    });

    it("debería manejar puntos negativos", async () => {
      mockRepo.increment.mockResolvedValue({ affected: 1 } as any);

      await service.addLoyaltyPoints("client-123", "business-123", -20);

      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        "loyaltyPoints",
        -20
      );
    });
  });

  describe("subtractLoyaltyPoints", () => {
    it("debería restar puntos de lealtad correctamente", async () => {
      const clientWithPoints = { ...mockClient, loyaltyPoints: 100 } as any;

      mockRepo.findOne.mockResolvedValue(clientWithPoints);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.subtractLoyaltyPoints("client-123", "business-123", 30);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        { loyaltyPoints: 70 }
      );
    });

    it("debería mantener puntos en 0 si la resta daría negativo", async () => {
      const clientWithFewPoints = { ...mockClient, loyaltyPoints: 20 } as any;

      mockRepo.findOne.mockResolvedValue(clientWithFewPoints);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.subtractLoyaltyPoints("client-123", "business-123", 50);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        { loyaltyPoints: 0 }
      );
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(ClientsService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findByUserId).toBe("function");
      expect(typeof service.update).toBe("function");
      expect(typeof service.addLoyaltyPoints).toBe("function");
      expect(typeof service.subtractLoyaltyPoints).toBe("function");
    });
  });
});
