import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { ClientsService } from "./clients.service";
import { Client } from "../../entities/client.entity";
import {
  CampoDeFicha,
  TipoDeCampo,
} from "../../entities/campo-de-ficha.entity";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

describe("ClientsService", () => {
  let service: ClientsService;
  let mockRepo: jest.Mocked<Repository<Client>>;
  let mockOutbox: { enqueue: jest.Mock };
  let mockCamposRepo: jest.Mocked<Repository<CampoDeFicha>>;

  const mockClient: Client = {
    id: "client-123",
    businessId: "business-123",
    userId: "user-123",
    name: "Juan Pérez",
    email: "juan@example.com",
    phone: "+573001234567",
    documento: "1020304050",
    notes: "",
    tags: [],
    loyaltyPoints: 100,
    noShowCount: 0,
    active: true,
    ficha: null,
    anonymizedAt: null,
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

    // Sin campos definidos, la ficha no se valida contra nada.
    mockCamposRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    mockOutbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    // La transacción entrega el mismo repositorio simulado del test.
    const mockDataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ getRepository: jest.fn().mockReturnValue(mockRepo) })
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getRepositoryToken(Client),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(CampoDeFicha),
          useValue: mockCamposRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
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

    // El evento es lo que alimenta el contador de clientes nuevos de analytics.
    it("encola el evento de cliente creado en la misma transacción", async () => {
      mockRepo.create.mockReturnValue(mockClient);
      mockRepo.save.mockResolvedValue(mockClient);

      await service.create("business-123", { name: "Juan Pérez" });

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "core.client.created",
          aggregateId: mockClient.id,
          payload: expect.objectContaining({
            clientId: mockClient.id,
            businessId: "business-123",
          }),
        })
      );
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

  describe("findMineByUser", () => {
    it("debería buscar sin acotar a un negocio y quedarse con la más reciente", async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);

      const result = await service.findMineByUser("user-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", active: true },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(mockClient);
    });
  });

  describe("updateMineByUser", () => {
    it("debería propagar los datos a todas las fichas del usuario", async () => {
      const fichaA = { ...mockClient, id: "c-a" } as any;
      const fichaB = { ...mockClient, id: "c-b" } as any;
      mockRepo.find.mockResolvedValue([fichaA, fichaB]);
      mockRepo.findOne.mockResolvedValue(fichaA);

      await service.updateMineByUser("user-123", {
        name: "Ana Nueva",
        phone: "+573001112233",
      });

      expect(mockRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: "c-a", name: "Ana Nueva" }),
        expect.objectContaining({ id: "c-b", name: "Ana Nueva" }),
      ]);
    });

    it("debería devolver null si el usuario no tiene ninguna ficha", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.updateMineByUser("user-sin-ficha", {
        name: "Ana",
      });

      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
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

    it("no deja reescribir una ficha ya suprimida", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockClient,
        anonymizedAt: new Date(),
      } as any);

      await expect(
        service.update("client-123", "business-123", { name: "Otro" })
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("ficha configurable", () => {
    const CAMPO_ALERGIAS = "11111111-1111-4111-8111-111111111111";
    const CAMPO_PIEL = "22222222-2222-4222-8222-222222222222";

    /** Alergias (texto, obligatorio) y tipo de piel (opciones). */
    const definirCampos = () => {
      mockCamposRepo.find.mockResolvedValue([
        {
          id: CAMPO_ALERGIAS,
          etiqueta: "Alergias",
          tipo: TipoDeCampo.TEXTO,
          obligatorio: true,
          opciones: null,
        },
        {
          id: CAMPO_PIEL,
          etiqueta: "Tipo de piel",
          tipo: TipoDeCampo.OPCIONES,
          obligatorio: false,
          opciones: ["Grasa", "Seca", "Mixta"],
        },
      ] as any);
    };

    beforeEach(() => {
      definirCampos();
      mockRepo.findOne.mockResolvedValue(mockClient);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);
    });

    it("guarda una ficha que cuadra con los campos definidos", async () => {
      const ficha = { [CAMPO_ALERGIAS]: "Látex", [CAMPO_PIEL]: "Mixta" };

      await service.update("client-123", "business-123", { ficha });

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        { ficha }
      );
    });

    it("rechaza una clave que el negocio no definió", async () => {
      await expect(
        service.update("client-123", "business-123", {
          ficha: { "33333333-3333-4333-8333-333333333333": "algo" },
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rechaza un valor que no cuadra con el tipo del campo", async () => {
      await expect(
        service.update("client-123", "business-123", {
          ficha: { [CAMPO_ALERGIAS]: 42 },
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rechaza una opción que no está en la lista", async () => {
      await expect(
        service.update("client-123", "business-123", {
          ficha: { [CAMPO_ALERGIAS]: "Ninguna", [CAMPO_PIEL]: "Escamosa" },
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("exige los obligatorios cuando se envía ficha", async () => {
      await expect(
        service.update("client-123", "business-123", {
          ficha: { [CAMPO_PIEL]: "Seca" },
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("no exige nada si no se envía ficha", async () => {
      await service.update("client-123", "business-123", { name: "Otro" });

      expect(mockRepo.update).toHaveBeenCalled();
    });
  });

  describe("addNoShow", () => {
    it("suma una falta a la ficha del negocio", async () => {
      mockRepo.increment.mockResolvedValue({ affected: 1 } as any);

      await service.addNoShow("client-123", "business-123");

      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        "noShowCount",
        1
      );
    });
  });

  describe("anonymize", () => {
    it("vacía los datos personales y conserva la fila", async () => {
      mockRepo.findOne.mockResolvedValue(mockClient);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.anonymize("client-123", "business-123");

      const [criterio, cambios] = mockRepo.update.mock.calls[0];
      expect(criterio).toEqual({
        id: "client-123",
        businessId: "business-123",
      });
      expect(cambios).toEqual(
        expect.objectContaining({
          email: null,
          phone: null,
          documento: null,
          notes: null,
          userId: null,
          active: false,
          anonymizedAt: expect.any(Date),
        })
      );
      // Con el nombre vacío la ficha sería imposible de reconocer en pantalla.
      expect(cambios.name).toBeTruthy();
    });

    it("rechaza un segundo intento sobre la misma ficha", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockClient,
        anonymizedAt: new Date(),
      } as any);

      await expect(
        service.anonymize("client-123", "business-123")
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.update).not.toHaveBeenCalled();
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

    it("usa el repositorio de la transacción cuando se le pasa un manager", async () => {
      // Acreditar puntos y marcar el evento como procesado tienen que
      // confirmarse juntos, así que el incremento va por el manager de quien
      // llama y no por el repositorio propio.
      const incrementEnTx = jest.fn().mockResolvedValue({ affected: 1 });
      const manager = {
        getRepository: jest.fn().mockReturnValue({ increment: incrementEnTx }),
      } as any;

      await service.addLoyaltyPoints("client-123", "business-123", 50, manager);

      expect(incrementEnTx).toHaveBeenCalledWith(
        { id: "client-123", businessId: "business-123" },
        "loyaltyPoints",
        50
      );
      expect(mockRepo.increment).not.toHaveBeenCalled();
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
