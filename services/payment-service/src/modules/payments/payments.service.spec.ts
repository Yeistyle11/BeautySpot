import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PaymentsService } from "./payments.service";
import { PaymentEntity } from "./payment.entity";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let mockRepo: jest.Mocked<Repository<PaymentEntity>>;
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;
  let mockOutbox: jest.Mocked<OutboxService>;

  const mockPayment: PaymentEntity = {
    id: "payment-123",
    businessId: "business-123",
    appointmentId: "appointment-123",
    clientId: "client-123",
    amount: 100,
    method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED,
    reference: "REF-123",
    notes: "Pago en efectivo",
    registeredBy: "user-123",
    refundedAt: null,
    refundAmount: null,
    refundReason: null,
    refundedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as any;

    mockManagerRepo = {
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: mockRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe("create", () => {
    it("debería crear un pago y encolar el evento en la misma transacción", async () => {
      const data = {
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockResolvedValue(mockPayment);

      const result = await service.create("business-123", data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        businessId: "business-123",
      });
      // el save ocurre a traves del repositorio del manager (dentro de la tx)
      expect(mockManagerRepo.save).toHaveBeenCalledWith(mockPayment);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_PAYMENT_REGISTERED,
          aggregateType: "payment",
          aggregateId: mockPayment.id,
          payload: expect.objectContaining({
            paymentId: mockPayment.id,
            businessId: "business-123",
            clientId: mockPayment.clientId,
            amount: Number(mockPayment.amount),
            method: mockPayment.method,
          }),
        })
      );
      expect(result).toEqual(mockPayment);
    });

    it("debería propagar errores de la transacción", async () => {
      const data = {
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create("business-123", data)).rejects.toThrow();
      // si el save falla, no se encola evento (atomicidad outbox)
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("findByBusiness", () => {
    it("debería retornar pagos del negocio por defecto", async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findByBusiness("business-123");

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual([mockPayment]);
    });

    it("debería filtrar por método", async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness("business-123", {
        method: PaymentMethod.CASH,
      });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", method: PaymentMethod.CASH },
        order: { createdAt: "DESC" },
      });
    });

    it("debería filtrar por estado", async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness("business-123", {
        status: PaymentStatus.COMPLETED,
      });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", status: PaymentStatus.COMPLETED },
        order: { createdAt: "DESC" },
      });
    });

    it("debería filtrar por rango de fechas", async () => {
      mockRepo.find.mockResolvedValue([mockPayment]);

      await service.findByBusiness("business-123", {
        from: "2024-01-01",
        to: "2024-01-31",
      });

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          createdAt: expect.any(Object),
        },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findById", () => {
    it("debería retornar el pago encontrado", async () => {
      mockRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findById("payment-123", "business-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "payment-123", businessId: "business-123" },
      });
      expect(result).toEqual(mockPayment);
    });

    it("debería lanzar NotFoundException si el pago no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateStatus", () => {
    it("debería actualizar el estado del pago", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
        generateId: () => {},
      } as any);

      const result = await service.updateStatus(
        "payment-123",
        "business-123",
        PaymentStatus.REFUNDED
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "payment-123", businessId: "business-123" },
        { status: PaymentStatus.REFUNDED }
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it("debería lanzar NotFoundException si el pago no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          "non-existent",
          "business-123",
          PaymentStatus.REFUNDED
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getDailySummary", () => {
    it("debería retornar resumen diario de pagos", async () => {
      const payment1 = {
        ...mockPayment,
        method: PaymentMethod.CASH,
        amount: 50,
        generateId: () => {},
      } as any;
      const payment2 = {
        ...mockPayment,
        method: PaymentMethod.CARD,
        amount: 30,
        generateId: () => {},
      } as any;
      mockRepo.find.mockResolvedValue([payment1, payment2] as any);

      const result = await service.getDailySummary(
        "business-123",
        "2024-01-15"
      );

      expect(result.date).toBe("2024-01-15");
      expect(result.total).toBe(80);
      expect(result.count).toBe(2);
      expect(result.byMethod).toEqual({ CASH: 50, CARD: 30 });
    });

    it("debería retornar resumen vacío si no hay pagos", async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getDailySummary(
        "business-123",
        "2024-01-15"
      );

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.byMethod).toEqual({});
    });
  });

  describe("refundPayment", () => {
    it("debería reembolsar y encolar el evento en la misma transacción", async () => {
      const payment1WeekOld = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(payment1WeekOld);
      mockManagerRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.refundPayment("payment-123", "business-123", {
        reason: "Solicitud del cliente",
        refundAmount: 50,
        refundedBy: "user-777",
      });

      expect(mockDataSource.transaction).toHaveBeenCalled();
      // El UPDATE se condiciona a status COMPLETED para bloquear el doble
      // reembolso concurrente, y registra qué usuario lo autorizó.
      expect(mockManagerRepo.update).toHaveBeenCalledWith(
        { id: "payment-123", status: PaymentStatus.COMPLETED },
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 50,
          refundReason: "Solicitud del cliente",
          refundedBy: "user-777",
        })
      );
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_REFUND_PROCESSED,
          aggregateType: "payment",
          aggregateId: "payment-123",
          payload: expect.objectContaining({
            paymentId: "payment-123",
            businessId: "business-123",
            refundAmount: 50,
            reason: "Solicitud del cliente",
          }),
        })
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it("debería usar monto completo si no se especifica refundAmount", async () => {
      const payment1WeekOld = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(payment1WeekOld);
      mockManagerRepo.update.mockResolvedValue({ affected: 1 });

      await service.refundPayment("payment-123", "business-123", {
        refundedBy: "user-777",
      });

      expect(mockManagerRepo.update).toHaveBeenCalledWith(
        { id: "payment-123", status: PaymentStatus.COMPLETED },
        expect.objectContaining({
          refundAmount: 100,
        })
      );
    });

    it("rechaza el reembolso si otra transacción ya lo procesó (doble reembolso)", async () => {
      const recentPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(recentPayment);
      // El UPDATE condicionado no afecta filas: el pago ya no está COMPLETED.
      mockManagerRepo.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.refundPayment("payment-123", "business-123", {
          refundedBy: "user-777",
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el pago no está completado", async () => {
      const pendingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(pendingPayment);

      await expect(
        service.refundPayment("payment-123", "business-123", { refundedBy: "user-777" })
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si expiró el periodo de reembolso", async () => {
      const oldPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(oldPayment);

      await expect(
        service.refundPayment("payment-123", "business-123", { refundedBy: "user-777" })
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el monto es inválido", async () => {
      const recentPayment = {
        ...mockPayment,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        generateId: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(recentPayment);

      await expect(
        service.refundPayment("payment-123", "business-123", { reason: "", refundAmount: -1, refundedBy: "user-777" })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.refundPayment("payment-123", "business-123", { reason: "", refundAmount: 200, refundedBy: "user-777" })
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });
});
