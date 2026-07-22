import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource, IsNull } from "typeorm";
import { CashRegisterService } from "./cash-register.service";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashMovementType } from "@beautyspot/shared-types";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("CashRegisterService", () => {
  let service: CashRegisterService;
  let mockSessionRepo: jest.Mocked<Repository<CashSessionEntity>>;
  let mockMovementRepo: jest.Mocked<Repository<CashMovementEntity>>;
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;
  let mockOutbox: jest.Mocked<OutboxService>;

  const mockSession: CashSessionEntity = {
    id: "session-123",
    businessId: "business-123",
    branchId: "branch-123",
    openedBy: "user-123",
    openingAmount: 50000,
    notes: "Apertura de caja",
    openedAt: new Date(),
    closedAt: null,
    isOpen: true,
    movements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
    initOpenedAt: () => {},
  } as any;

  const mockClosedSession: CashSessionEntity = {
    id: "session-123",
    businessId: "business-123",
    branchId: "branch-123",
    openedBy: "user-123",
    openingAmount: 50000,
    notes: "Apertura de caja",
    openedAt: new Date(),
    closedAt: new Date(),
    closingAmount: 55000,
    closedBy: "user-123",
    isOpen: false,
    movements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
    initOpenedAt: () => {},
  } as any;

  const mockMovement: CashMovementEntity = {
    id: "movement-123",
    cashSessionId: "session-123",
    type: CashMovementType.IN,
    amount: 10000,
    concept: "Ingreso del día",
    registeredBy: "user-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
    cashSession: {} as any,
  } as any;

  beforeEach(async () => {
    mockSessionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as any;

    mockMovementRepo = {
      create: jest.fn(),
      save: jest.fn(),
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
    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        CashRegisterService,
        {
          provide: getRepositoryToken(CashSessionEntity),
          useValue: mockSessionRepo,
        },
        {
          provide: getRepositoryToken(CashMovementEntity),
          useValue: mockMovementRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
      ],
    }).compile();

    service = module.get<CashRegisterService>(CashRegisterService);
  });

  describe("openSession", () => {
    it("debería abrir una sesión de caja exitosamente", async () => {
      const dto = {
        branchId: "branch-123",
        openingAmount: 50000,
        notes: "Apertura de caja",
      };

      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      const result = await service.openSession("business-123", "user-123", dto);

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
        where: { businessId: "business-123", closedAt: IsNull() },
      });
      expect(mockSessionRepo.create).toHaveBeenCalledWith({
        businessId: "business-123",
        branchId: dto.branchId,
        openedBy: "user-123",
        openingAmount: dto.openingAmount || 0,
        notes: dto.notes,
      });
      expect(mockSessionRepo.save).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(mockSession);
    });

    it("debería lanzar BadRequestException si ya existe una sesión abierta", async () => {
      mockSessionRepo.findOne.mockResolvedValue(mockSession);

      await expect(
        service.openSession("business-123", "user-123", {})
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.openSession("business-123", "user-123", {})
      ).rejects.toThrow("Ya existe una sesión de caja abierta");
    });

    it("traduce la violación de índice único a un error de sesión ya abierta", async () => {
      // Dos aperturas concurrentes superan el findOne previo; el índice único
      // parcial hace fallar el insert de la segunda con SQLSTATE 23505.
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockRejectedValue({ code: "23505" });

      await expect(
        service.openSession("business-123", "user-123", {})
      ).rejects.toThrow("Ya existe una sesión de caja abierta");
    });

    it("debería usar 0 si no se especifica openingAmount", async () => {
      const dto = { branchId: "branch-123" };
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      await service.openSession("business-123", "user-123", dto);

      const createCall = mockSessionRepo.create.mock.calls[0][0];
      expect(createCall.openingAmount).toBe(0);
    });
  });

  describe("closeSession", () => {
    it("debería cerrar la sesión y encolar el evento en la misma transacción", async () => {
      const dto = {
        closingAmount: 55000,
        notes: "Cierre del día",
      };
      const openSession = {
        ...mockSession,
        movements: [],
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;

      mockSessionRepo.findOne.mockResolvedValue(openSession);
      mockManagerRepo.save.mockResolvedValue({
        ...openSession,
        closedBy: "user-123",
        closingAmount: 55000,
        closedAt: expect.any(Date),
        isOpen: false,
      } as any);

      await service.closeSession(
        "session-123",
        "business-123",
        "user-123",
        dto
      );

      expect(mockDataSource.transaction).toHaveBeenCalled();
      // el save ocurre a traves del repositorio del manager (dentro de la tx)
      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          closedBy: "user-123",
          closingAmount: dto.closingAmount,
          closedAt: expect.any(Date),
        })
      );
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_CASH_SESSION_CLOSED,
          aggregateType: "cash_session",
          aggregateId: "session-123",
          payload: expect.objectContaining({
            sessionId: "session-123",
            businessId: "business-123",
            closingAmount: 55000,
            movementCount: 0,
          }),
        })
      );
    });

    it("debería calcular totales de movimientos al cerrar", async () => {
      const dto = { closingAmount: 55000 };
      const openSession = {
        ...mockSession,
        movements: [
          { ...mockMovement, type: CashMovementType.IN, amount: 10000 },
          {
            ...mockMovement,
            type: CashMovementType.OUT,
            amount: 5000,
            id: "movement-456",
          },
        ],
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;

      mockSessionRepo.findOne.mockResolvedValue(openSession);
      mockManagerRepo.save.mockResolvedValue(openSession);

      await service.closeSession(
        "session-123",
        "business-123",
        "user-123",
        dto
      );

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          payload: expect.objectContaining({
            totalIn: 10000,
            totalOut: 5000,
            movementCount: 2,
          }),
        })
      );
    });

    it("debería lanzar NotFoundException si la sesión no existe", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.closeSession("non-existent", "business-123", "user-123", {
          closingAmount: 50000,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar BadRequestException si la sesión ya está cerrada", async () => {
      mockSessionRepo.findOne.mockResolvedValue(mockClosedSession);

      await expect(
        service.closeSession("session-123", "business-123", "user-123", {
          closingAmount: 50000,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("debería propagar errores de outbox (fail-closed: la tx revierte)", async () => {
      const dto = { closingAmount: 55000 };
      const openSession = {
        ...mockSession,
        movements: [],
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;

      mockSessionRepo.findOne.mockResolvedValue(openSession);
      mockManagerRepo.save.mockResolvedValue(openSession);
      mockOutbox.enqueue.mockRejectedValue(new Error("Outbox error"));

      await expect(
        service.closeSession("session-123", "business-123", "user-123", dto)
      ).rejects.toThrow("Outbox error");

      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });
  });

  describe("registerMovement", () => {
    it("debería registrar un movimiento exitosamente", async () => {
      const dto = {
        type: CashMovementType.IN,
        amount: 10000,
        concept: "Ingreso del día",
      };

      mockSessionRepo.findOne.mockResolvedValue(mockSession);
      mockMovementRepo.create.mockReturnValue(mockMovement);
      mockMovementRepo.save.mockResolvedValue(mockMovement);

      const result = await service.registerMovement(
        "session-123",
        "business-123",
        "user-123",
        dto
      );

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
        where: { id: "session-123", businessId: "business-123" },
      });
      expect(mockMovementRepo.create).toHaveBeenCalledWith({
        cashSessionId: "session-123",
        type: dto.type,
        amount: dto.amount,
        concept: dto.concept,
        registeredBy: "user-123",
      });
      expect(mockMovementRepo.save).toHaveBeenCalledWith(mockMovement);
      expect(result).toEqual(mockMovement);
    });

    it("debería lanzar NotFoundException si la sesión no existe", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.registerMovement("non-existent", "business-123", "user-123", {
          type: CashMovementType.IN,
          amount: 10000,
          concept: "Ingreso del día",
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar BadRequestException si la sesión está cerrada", async () => {
      mockSessionRepo.findOne.mockResolvedValue(mockClosedSession);

      await expect(
        service.registerMovement("session-123", "business-123", "user-123", {
          type: CashMovementType.IN,
          amount: 10000,
          concept: "Ingreso del día",
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.registerMovement("session-123", "business-123", "user-123", {
          type: CashMovementType.IN,
          amount: 10000,
          concept: "Ingreso del día",
        })
      ).rejects.toThrow(
        "No se pueden registrar movimientos en una sesión cerrada"
      );
    });
  });

  describe("getSessionSummary", () => {
    it("debería retornar resumen de la sesión", async () => {
      const sessionWithMovements = {
        ...mockSession,
        movements: [
          { ...mockMovement, type: CashMovementType.IN, amount: 10000 },
          {
            ...mockMovement,
            type: CashMovementType.OUT,
            amount: 5000,
            id: "movement-456",
          },
        ],
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;

      mockSessionRepo.findOne.mockResolvedValue(sessionWithMovements);

      const result = await service.getSessionSummary(
        "session-123",
        "business-123"
      );

      expect(result).toEqual({
        session: {
          id: "session-123",
          openingAmount: 50000,
          closingAmount: null,
          openedAt: expect.any(Date),
          closedAt: null,
          isOpen: true,
        },
        movements: sessionWithMovements.movements,
        summary: {
          totalIn: 10000,
          totalOut: 5000,
          movementCount: 2,
          expectedTotal: 55000,
        },
      });
    });

    it("debería lanzar NotFoundException si la sesión no existe", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getSessionSummary("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getActiveSession", () => {
    it("debería retornar la sesión activa", async () => {
      const activeSession = {
        ...mockSession,
        movements: [],
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;
      mockSessionRepo.findOne.mockResolvedValue(activeSession);

      const result = await service.getActiveSession("business-123");

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
        where: { businessId: "business-123", closedAt: IsNull() },
        relations: ["movements"],
        order: { openedAt: "DESC" },
      });
      expect(result).toEqual(activeSession);
    });

    it("debería retornar null si no hay sesión activa", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);

      const result = await service.getActiveSession("business-123");

      expect(result).toBeNull();
    });
  });

  describe("getSessionHistory", () => {
    it("debería retornar historial de sesiones", async () => {
      const sessions = [mockSession, mockClosedSession];
      mockSessionRepo.find.mockResolvedValue(sessions);

      const result = await service.getSessionHistory("business-123");

      expect(mockSessionRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { openedAt: "DESC" },
        take: 50,
      });
      expect(result).toEqual(sessions);
    });

    it("debería limitar a 50 registros", async () => {
      mockSessionRepo.find.mockResolvedValue([]);

      await service.getSessionHistory("business-123");

      expect(mockSessionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });
});
