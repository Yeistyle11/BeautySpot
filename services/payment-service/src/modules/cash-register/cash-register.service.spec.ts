import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource, IsNull } from "typeorm";
import { CashRegisterService } from "./cash-register.service";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashMovementType, PaymentMethod } from "@beautyspot/shared-types";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OutboxService, InternalHttpClient } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("CashRegisterService", () => {
  let service: CashRegisterService;
  let mockSessionRepo: jest.Mocked<Repository<CashSessionEntity>>;
  let mockMovementRepo: jest.Mocked<Repository<CashMovementEntity>>;
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockHttp: { pedirONulo: jest.Mock };
  let mockPagos: { find: jest.Mock };

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
      findAndCount: jest.fn(),
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
    mockPagos = { find: jest.fn().mockResolvedValue([]) };
    mockDataSource = {
      transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
        fn(mockManager)
      ),
      // El resumen consulta los pagos para poner nombre a cada movimiento.
      getRepository: jest.fn().mockReturnValue(mockPagos),
    };
    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockHttp = { pedirONulo: jest.fn().mockResolvedValue([]) };

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
        { provide: InternalHttpClient, useValue: mockHttp },
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
        where: {
          businessId: "business-123",
          branchId: "branch-123",
          closedAt: IsNull(),
        },
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

    it("cada sede busca su propia caja abierta", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      await service.openSession(
        "business-123",
        "user-123",
        { openingAmount: 0 },
        "branch-999"
      );

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          branchId: "branch-999",
          closedAt: IsNull(),
        },
      });
      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-999" })
      );
    });

    it("la sede del cuerpo manda sobre la de la cabecera", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      await service.openSession(
        "business-123",
        "user-123",
        { branchId: "branch-cuerpo" },
        "branch-cabecera"
      );

      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "branch-cuerpo" })
      );
    });

    it("un negocio sin sedes abre su caja con sede nula", async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      mockSessionRepo.create.mockReturnValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      await service.openSession("business-123", "user-123", {});

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          branchId: IsNull(),
          closedAt: IsNull(),
        },
      });
      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: null })
      );
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

  describe("consultas por sede", () => {
    it("la caja activa es la de la sede pedida", async () => {
      mockSessionRepo.findOne.mockResolvedValue(mockSession);

      await service.getActiveSession("business-123", "branch-999");

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: "business-123",
            branchId: "branch-999",
            closedAt: IsNull(),
          },
        })
      );
    });

    it("sin sede activa se mira el negocio entero", async () => {
      mockSessionRepo.findOne.mockResolvedValue(mockSession);

      await service.getActiveSession("business-123");

      expect(mockSessionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", closedAt: IsNull() },
        })
      );
    });
  });

  describe("closeSession", () => {
    /** Sesión abierta con 50.000 de fondo y los movimientos indicados. */
    function sesionCon(movements: unknown[]) {
      return {
        ...mockSession,
        movements,
        isOpen: true,
        initOpenedAt: () => {},
        generateId: () => {},
      } as any;
    }

    // El descuadre es el dato que da sentido al arqueo: sin él, el cierre solo
    // registra lo que alguien dijo que había.
    it("guarda el saldo esperado y su diferencia con el contado", async () => {
      const sesion = sesionCon([
        { ...mockMovement, type: CashMovementType.IN, amount: 10000 },
        { ...mockMovement, type: CashMovementType.OUT, amount: 5000 },
      ]);
      mockSessionRepo.findOne.mockResolvedValue(sesion);
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      // 50.000 + 10.000 − 5.000 = 55.000 esperados; se cuentan 54.000.
      await service.closeSession("session-123", "business-123", "user-123", {
        closingAmount: 54000,
        notes: "Faltó un billete de mil",
      });

      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ expectedTotal: 55000, difference: -1000 })
      );
    });

    // El arqueo existe para que un descuadre obligue a explicarse, y el momento
    // de hacerlo es ese: al día siguiente ya no habrá quien recuerde por qué.
    it("no deja cerrar con descuadre sin motivo", async () => {
      mockSessionRepo.findOne.mockResolvedValue(sesionCon([]));

      await expect(
        service.closeSession("session-123", "business-123", "user-123", {
          closingAmount: 52000,
        })
      ).rejects.toThrow(/anota el motivo/i);
      expect(mockManagerRepo.save).not.toHaveBeenCalled();
    });

    it("tampoco con un motivo en blanco", async () => {
      mockSessionRepo.findOne.mockResolvedValue(sesionCon([]));

      await expect(
        service.closeSession("session-123", "business-123", "user-123", {
          closingAmount: 52000,
          notes: "   ",
        })
      ).rejects.toThrow(/anota el motivo/i);
    });

    // Con la caja cuadrada la nota no aporta nada, y exigirla solo enseñaría a
    // rellenarla con cualquier cosa.
    it("deja cerrar sin motivo cuando la caja cuadra", async () => {
      mockSessionRepo.findOne.mockResolvedValue(sesionCon([]));
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      await expect(
        service.closeSession("session-123", "business-123", "user-123", {
          closingAmount: 50000,
        })
      ).resolves.toBeDefined();
    });

    it("desglosa el cierre por método de pago", async () => {
      const sesion = sesionCon([
        {
          ...mockMovement,
          type: CashMovementType.IN,
          amount: 10000,
          method: PaymentMethod.CASH,
        },
        {
          ...mockMovement,
          type: CashMovementType.IN,
          amount: 40000,
          method: PaymentMethod.CARD,
        },
        {
          ...mockMovement,
          type: CashMovementType.OUT,
          amount: 5000,
          method: PaymentMethod.CASH,
        },
      ]);
      mockSessionRepo.findOne.mockResolvedValue(sesion);
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      await service.closeSession("session-123", "business-123", "user-123", {
        closingAmount: 55000,
      });

      const [, evento] = mockOutbox.enqueue.mock.calls[0];
      expect(evento.payload.porMetodo).toEqual({
        CASH: { entradas: 10000, salidas: 5000 },
        CARD: { entradas: 40000, salidas: 0 },
      });
    });

    it("cuadra el cajón solo contra el efectivo", async () => {
      const sesion = sesionCon([
        {
          ...mockMovement,
          type: CashMovementType.IN,
          amount: 10000,
          method: PaymentMethod.CASH,
        },
        {
          ...mockMovement,
          type: CashMovementType.IN,
          amount: 40000,
          method: PaymentMethod.CARD,
        },
      ]);
      mockSessionRepo.findOne.mockResolvedValue(sesion);
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      // 50.000 de fondo + 10.000 en efectivo = 60.000; se cuentan 60.000.
      await service.closeSession("session-123", "business-123", "user-123", {
        closingAmount: 60000,
      });

      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ expectedTotal: 60000, difference: 0 })
      );
    });

    it("registra el sobrante con signo positivo", async () => {
      mockSessionRepo.findOne.mockResolvedValue(sesionCon([]));
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      await service.closeSession("session-123", "business-123", "user-123", {
        closingAmount: 52000,
        notes: "Sobrante sin identificar",
      });

      expect(mockManagerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ expectedTotal: 50000, difference: 2000 })
      );
    });

    it("lleva el descuadre en el evento de cierre", async () => {
      mockSessionRepo.findOne.mockResolvedValue(sesionCon([]));
      mockManagerRepo.save.mockImplementation((s: unknown) => s);

      await service.closeSession("session-123", "business-123", "user-123", {
        closingAmount: 49000,
        notes: "Descuadre pendiente de revisar",
      });

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          payload: expect.objectContaining({ difference: -1000 }),
        })
      );
    });

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
      // Sin movimientos, el fondo de 50.000 es lo esperado: se cuenta eso mismo
      // para que el cierre cuadre y el único fallo sea el del outbox.
      const dto = { closingAmount: 50000 };
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
          difference: null,
          openedAt: expect.any(Date),
          closedAt: null,
          isOpen: true,
        },
        movements: sessionWithMovements.movements,
        summary: {
          totalIn: 10000,
          totalOut: 5000,
          movementCount: 2,
          porMetodo: { MANUAL: { entradas: 10000, salidas: 5000 } },
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
    const paginacion = { page: 2, limit: 10, offset: 10 };

    it("devuelve la página pedida con su meta", async () => {
      const sessions = [mockSession, mockClosedSession];
      mockSessionRepo.findAndCount.mockResolvedValue([sessions, 25]);

      const result = await service.getSessionHistory(
        "business-123",
        paginacion as never
      );

      expect(mockSessionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123" },
          order: { openedAt: "DESC" },
          skip: 10,
          take: 10,
        })
      );
      expect(result.data).toEqual(sessions);
      expect(result.meta).toEqual(
        expect.objectContaining({ page: 2, limit: 10, total: 25 })
      );
    });

    it("ya no corta el historial en 50 sesiones", async () => {
      mockSessionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getSessionHistory("business-123", {
        page: 1,
        limit: 100,
        offset: 0,
      } as never);

      expect(mockSessionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe("getSessionSummary, el listado que se repasa al cerrar", () => {
    const movimiento = (extra = {}) => ({
      id: "mov-1",
      concept: "Corte clásico",
      amount: 30000,
      paymentId: "pay-1",
      ...extra,
    });

    /** Deja la sesión con esos movimientos y devuelve el resumen. */
    async function resumenCon(movements: unknown[]) {
      mockSessionRepo.findOne.mockResolvedValue({
        id: "sesion-1",
        businessId: "business-123",
        openingAmount: 0,
        closingAmount: null,
        difference: null,
        openedAt: new Date(),
        closedAt: null,
        isOpen: true,
        movements,
      } as never);

      return service.getSessionSummary("sesion-1", "business-123");
    }

    // Es el listado que se repasa cuando la caja no cuadra: sin saber de quién
    // es cada entrada no se puede auditar nada.
    it("pone nombre al cliente de cada cobro", async () => {
      mockPagos.find.mockResolvedValue([{ id: "pay-1", clientId: "cli-1" }]);
      mockHttp.pedirONulo.mockResolvedValue([
        { id: "cli-1", name: "Carlos Pérez" },
      ]);

      const resumen = await resumenCon([movimiento()]);

      expect(resumen.movements[0]).toMatchObject({
        concept: "Corte clásico",
        clientName: "Carlos Pérez",
      });
    });

    it("pide los nombres al negocio de la sesión", async () => {
      mockPagos.find.mockResolvedValue([{ id: "pay-1", clientId: "cli-1" }]);
      mockHttp.pedirONulo.mockResolvedValue([]);

      await resumenCon([movimiento()]);

      expect(mockHttp.pedirONulo).toHaveBeenCalledWith(
        "core",
        expect.stringContaining("businessId=business-123&ids=cli-1")
      );
    });

    it("no pregunta por lo que se anotó a mano, que no tiene cobro", async () => {
      const resumen = await resumenCon([
        movimiento({ concept: "Compra de toallas", paymentId: null }),
      ]);

      expect(mockHttp.pedirONulo).not.toHaveBeenCalled();
      expect(resumen.movements[0]).not.toHaveProperty("clientName");
    });

    // El nombre es un dato de apoyo: quedarse sin arqueo porque el core no
    // conteste seria peor que leer el listado incompleto.
    it("sirve el arqueo aunque el core no conteste", async () => {
      mockPagos.find.mockResolvedValue([{ id: "pay-1", clientId: "cli-1" }]);
      mockHttp.pedirONulo.mockResolvedValue(null);

      const resumen = await resumenCon([movimiento()]);

      expect(resumen.movements).toHaveLength(1);
      expect(resumen.movements[0]).not.toHaveProperty("clientName");
    });

    it("no repite el mismo cliente en la consulta", async () => {
      mockPagos.find.mockResolvedValue([
        { id: "pay-1", clientId: "cli-1" },
        { id: "pay-2", clientId: "cli-1" },
      ]);
      mockHttp.pedirONulo.mockResolvedValue([]);

      await resumenCon([
        movimiento(),
        movimiento({ id: "mov-2", paymentId: "pay-2" }),
      ]);

      expect(mockHttp.pedirONulo).toHaveBeenCalledWith(
        "core",
        expect.stringContaining("ids=cli-1")
      );
      const [, ruta] = mockHttp.pedirONulo.mock.calls[0];
      expect(ruta).not.toContain("cli-1,cli-1");
    });
  });
});
