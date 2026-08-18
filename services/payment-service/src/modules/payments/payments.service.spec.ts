import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PaymentsService, conceptoDelCobro } from "./payments.service";
import { PaymentEntity } from "./payment.entity";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import {
  PaymentMethod,
  PaymentStatus,
  CashMovementType,
} from "@beautyspot/shared-types";
import {
  InternalHttpClient,
  OutboxService,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let mockRepo: jest.Mocked<Repository<PaymentEntity>>;
  let mockManagerRepo: any;
  let mockManager: any;
  let mockDataSource: any;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockHttp: { pedir: jest.Mock };

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
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockManagerRepo = {
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      // El efectivo se anota en la caja abierta, así que la transacción también
      // consulta y crea sobre las entidades de arqueo.
      findOne: jest.fn().mockResolvedValue({ id: "cash-session-1" }),
      create: jest.fn((data) => data),
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

    // Cita de 100, que es el importe del pago del fixture.
    mockHttp = {
      pedir: jest
        .fn()
        .mockResolvedValue({ clientId: "client-123", totalAmount: 100 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: mockRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: OutboxService, useValue: mockOutbox },
        {
          provide: ZonaDelNegocioService,
          useValue: { de: jest.fn().mockResolvedValue("America/Bogota") },
        },
        { provide: InternalHttpClient, useValue: mockHttp },
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
        puntosUsados: 0,
        descuento: 0,
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

    // Tres clics en "Registrar pago" son tres peticiones legítimas a ojos de la
    // base: sin identificador de intento, tres cargos. Con él, el segundo choca
    // contra el índice y se le devuelve al cajero el cobro que ya se hizo.
    it("el reenvío del mismo intento devuelve el cobro que ya existe", async () => {
      const data = {
        clientId: "client-123",
        amount: 99000,
        method: PaymentMethod.CARD,
        registeredBy: "user-123",
        solicitudId: "66666666-6666-4666-8666-666666666666",
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockRejectedValue({ code: "23505" });
      mockRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.create("business-123", data);

      expect(result).toEqual(mockPayment);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: "business-123",
          solicitudId: data.solicitudId,
        },
      });
    });

    // El formulario ofrece las citas atendidas del cliente, y las ya cobradas
    // hay que tacharlas: booking no sabe de pagos.
    it("dice cuáles de unas citas ya tienen cobro vivo", async () => {
      // `select` deja fuera el resto de columnas: solo interesa el id de cita.
      mockRepo.find.mockResolvedValue([
        { appointmentId: "cita-1" },
        { appointmentId: "cita-3" },
      ] as never);

      const cobradas = await service.citasYaCobradas("business-123", [
        "cita-1",
        "cita-2",
        "cita-3",
      ]);

      expect(cobradas).toEqual(["cita-1", "cita-3"]);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: "business-123" }),
        })
      );
    });

    it("sin citas por las que preguntar no consulta nada", async () => {
      await expect(
        service.citasYaCobradas("business-123", [])
      ).resolves.toEqual([]);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    // Sin identificador no hay forma de saber si el choque es un reenvío o un
    // cobro distinto que topa con otra restriccion: el error tiene que salir.
    it("propaga el choque cuando el cobro no trae identificador", async () => {
      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockRejectedValue({ code: "23505" });

      await expect(
        service.create("business-123", {
          clientId: "client-123",
          amount: 99000,
          method: PaymentMethod.CARD,
          registeredBy: "user-123",
        })
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("anota el efectivo como entrada en la caja abierta", async () => {
      const data = {
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockResolvedValue(mockPayment);

      await service.create("business-123", data);

      expect(mockManagerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cashSessionId: "cash-session-1",
          type: CashMovementType.IN,
          amount: Number(mockPayment.amount),
        })
      );
    });

    it("rechaza el efectivo si no hay caja abierta, para que el arqueo cuadre", async () => {
      const data = {
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
      };

      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockResolvedValue(mockPayment);
      mockManagerRepo.findOne.mockResolvedValue(null);

      await expect(service.create("business-123", data)).rejects.toThrow(
        "No hay una caja abierta: abre la caja antes de registrar un pago en efectivo"
      );
    });

    it("no toca la caja cuando el pago no es en efectivo", async () => {
      const data = {
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CARD,
        registeredBy: "user-123",
      };

      const conTarjeta = {
        ...mockPayment,
        method: PaymentMethod.CARD,
      } as PaymentEntity;
      mockRepo.create.mockReturnValue(conTarjeta);
      mockManagerRepo.save.mockResolvedValue(conTarjeta);
      mockManagerRepo.findOne.mockResolvedValue(null);

      await expect(service.create("business-123", data)).resolves.toBeDefined();
      expect(mockManagerRepo.create).not.toHaveBeenCalled();
    });

    describe("cobro asociado a una cita", () => {
      const conCita = {
        appointmentId: "appointment-123",
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CARD,
        registeredBy: "user-123",
      };

      beforeEach(() => {
        mockRepo.create.mockReturnValue(mockPayment);
        mockManagerRepo.save.mockResolvedValue(mockPayment);
        mockRepo.findOne.mockResolvedValue(null);
      });

      it("acepta el pago cuando el importe cuadra con el de la cita", async () => {
        await expect(
          service.create("business-123", conCita)
        ).resolves.toBeDefined();

        expect(mockHttp.pedir).toHaveBeenCalledWith(
          "booking",
          expect.stringContaining(
            "/internal/appointments/appointment-123/cobro"
          )
        );
      });

      it("rechaza un importe distinto al de la cita", async () => {
        await expect(
          service.create("business-123", { ...conCita, amount: 50 })
        ).rejects.toThrow(BadRequestException);
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });

      it("rechaza una cita que no existe o es de otro negocio", async () => {
        mockHttp.pedir.mockResolvedValue(null);

        await expect(service.create("business-123", conCita)).rejects.toThrow(
          BadRequestException
        );
      });

      it("rechaza cobrar dos veces la misma cita", async () => {
        mockRepo.findOne.mockResolvedValue(mockPayment);

        await expect(service.create("business-123", conCita)).rejects.toThrow(
          BadRequestException
        );
      });

      it("no consulta a booking si el pago no viene de una cita", async () => {
        await service.create("business-123", {
          clientId: "client-123",
          amount: 100,
          method: PaymentMethod.CARD,
          registeredBy: "user-123",
        });

        expect(mockHttp.pedir).not.toHaveBeenCalled();
      });
    });

    describe("canje de puntos", () => {
      /** Cobro de una cita de 100 pagando 40 con puntos y 60 en efectivo. */
      const conPuntos = {
        appointmentId: "appointment-123",
        clientId: "client-123",
        amount: 60,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
        puntosUsados: 40,
      };

      beforeEach(() => {
        mockRepo.create.mockReturnValue(mockPayment);
        mockManagerRepo.save.mockResolvedValue(mockPayment);
        mockRepo.findOne.mockResolvedValue(null);
        mockHttp.pedir.mockImplementation((servicio: string) =>
          Promise.resolve(
            servicio === "core"
              ? { loyaltyPoints: 500 }
              : { clientId: "client-123", totalAmount: 100 }
          )
        );
      });

      // Lo que tiene que cuadrar con la cita es lo pagado más lo descontado.
      it("acepta el cobro cuando importe y descuento suman el de la cita", async () => {
        await expect(
          service.create("business-123", conPuntos)
        ).resolves.toBeDefined();

        expect(mockRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ puntosUsados: 40, descuento: 40 })
        );
      });

      it("descuenta los puntos por Outbox, en la misma transacción", async () => {
        await service.create("business-123", conPuntos);

        expect(mockOutbox.enqueue).toHaveBeenCalledWith(
          mockManager,
          expect.objectContaining({
            eventType: EventNames.PAYMENT_POINTS_REDEEMED,
            payload: expect.objectContaining({
              clientId: "client-123",
              points: 40,
              discount: 40,
            }),
          })
        );
      });

      it("rechaza gastar más puntos de los que tiene el cliente", async () => {
        mockHttp.pedir.mockImplementation((servicio: string) =>
          Promise.resolve(
            servicio === "core"
              ? { loyaltyPoints: 10 }
              : { clientId: "client-123", totalAmount: 100 }
          )
        );

        await expect(service.create("business-123", conPuntos)).rejects.toThrow(
          BadRequestException
        );
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });

      it("rechaza el canje si la ficha no es del negocio", async () => {
        mockHttp.pedir.mockImplementation((servicio: string) =>
          Promise.resolve(
            servicio === "core"
              ? null
              : { clientId: "client-123", totalAmount: 100 }
          )
        );

        await expect(service.create("business-123", conPuntos)).rejects.toThrow(
          BadRequestException
        );
      });

      it("rechaza el cobro si el importe no cuadra ni con el descuento", async () => {
        await expect(
          service.create("business-123", { ...conPuntos, amount: 20 })
        ).rejects.toThrow(BadRequestException);
      });

      it("no emite el evento de canje cuando no se usan puntos", async () => {
        await service.create("business-123", {
          ...conPuntos,
          amount: 100,
          puntosUsados: undefined,
        });

        expect(mockOutbox.enqueue).not.toHaveBeenCalledWith(
          mockManager,
          expect.objectContaining({
            eventType: EventNames.PAYMENT_POINTS_REDEEMED,
          })
        );
      });
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
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "createdAt",
      order: "DESC" as const,
    };

    it("devuelve una página con metadatos de paginación", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockPayment], 1]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123" },
          skip: 0,
          take: 20,
          order: { createdAt: "DESC" },
        })
      );
      expect(result.data).toEqual([mockPayment]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("debería filtrar por método", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockPayment], 1]);

      await service.findByBusiness(
        "business-123",
        { method: PaymentMethod.CASH },
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", method: PaymentMethod.CASH },
        })
      );
    });

    it("debería filtrar por estado", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockPayment], 1]);

      await service.findByBusiness(
        "business-123",
        { status: PaymentStatus.COMPLETED },
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: "business-123",
            status: PaymentStatus.COMPLETED,
          },
        })
      );
    });

    it("debería filtrar por rango de fechas", async () => {
      mockRepo.findAndCount.mockResolvedValue([[mockPayment], 1]);

      await service.findByBusiness(
        "business-123",
        { from: "2024-01-01", to: "2024-01-31" },
        pagination
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: "business-123",
            createdAt: expect.any(Object),
          },
        })
      );
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
    /** Deja el pago en el estado indicado antes de intentar la transición. */
    const pagoEn = (status: PaymentStatus) =>
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status,
        generateId: () => {},
      } as any);

    it("debería actualizar el estado del pago", async () => {
      pagoEn(PaymentStatus.PENDING);

      const result = await service.updateStatus(
        "payment-123",
        "business-123",
        PaymentStatus.COMPLETED
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: "payment-123", businessId: "business-123" },
        { status: PaymentStatus.COMPLETED }
      );
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    // La devolución exige importe, motivo, autor y ventana de 30 días, y eso
    // solo lo comprueba refundPayment.
    it("no deja marcar un pago como reembolsado por esta vía", async () => {
      pagoEn(PaymentStatus.COMPLETED);

      await expect(
        service.updateStatus(
          "payment-123",
          "business-123",
          PaymentStatus.REFUNDED
        )
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it.each([
      [PaymentStatus.COMPLETED, PaymentStatus.PENDING],
      [PaymentStatus.CANCELLED, PaymentStatus.COMPLETED],
      [PaymentStatus.REFUNDED, PaymentStatus.COMPLETED],
    ])("no deja pasar de %s a %s", async (desde, hasta) => {
      pagoEn(desde);

      await expect(
        service.updateStatus("payment-123", "business-123", hasta)
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar NotFoundException si el pago no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          "non-existent",
          "business-123",
          PaymentStatus.COMPLETED
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getDailySummary", () => {
    const mockQueryBuilder = (rows: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    it("agrega por método vía SQL (SUM/COUNT + GROUP BY)", async () => {
      // pg devuelve SUM/COUNT como strings; el servicio los convierte a number.
      mockRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder([
          { method: "CASH", total: "50", count: "1" },
          { method: "CARD", total: "30", count: "1" },
        ]) as any
      );

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
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder([]) as any);

      const result = await service.getDailySummary(
        "business-123",
        "2024-01-15"
      );

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.byMethod).toEqual({});
    });

    it("acota el día a la medianoche del negocio, con fin exclusivo", async () => {
      const qb = mockQueryBuilder([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb as any);

      await service.getDailySummary("business-123", "2024-01-15");

      const [, rango] = qb.andWhere.mock.calls.find(([sql]) =>
        String(sql).includes("created_at")
      )!;
      const { start, end } = rango as { start: Date; end: Date };

      // Bogotá va cinco horas por detrás de UTC.
      expect(start.toISOString()).toBe("2024-01-15T05:00:00.000Z");
      expect(end.toISOString()).toBe("2024-01-16T05:00:00.000Z");
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

      const result = await service.refundPayment(
        "payment-123",
        "business-123",
        {
          reason: "Solicitud del cliente",
          refundAmount: 50,
          refundedBy: "user-777",
        }
      );

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
        service.refundPayment("payment-123", "business-123", {
          refundedBy: "user-777",
        })
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
        service.refundPayment("payment-123", "business-123", {
          refundedBy: "user-777",
        })
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
        service.refundPayment("payment-123", "business-123", {
          reason: "",
          refundAmount: -1,
          refundedBy: "user-777",
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.refundPayment("payment-123", "business-123", {
          reason: "",
          refundAmount: 200,
          refundedBy: "user-777",
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });
});

describe("conceptoDelCobro", () => {
  // El identificador del pago es un dato interno y no dice nada a quien repasa
  // la caja al cerrar; el movimiento tiene que nombrar lo que se vendio.
  it("nombra los servicios cobrados", () => {
    expect(
      conceptoDelCobro([
        { serviceId: "s-1", name: "Corte clásico" },
        { serviceId: "s-2", name: "Barba" },
      ] as never)
    ).toBe("Corte clásico, Barba");
  });

  it("nombra la venta suelta cuando no hay cita detrás", () => {
    expect(conceptoDelCobro(undefined)).toBe("Venta en mostrador");
    expect(conceptoDelCobro([])).toBe("Venta en mostrador");
  });

  it("no deja un concepto vacío si los servicios llegan sin nombre", () => {
    expect(conceptoDelCobro([{ serviceId: "s-1", name: "" }] as never)).toBe(
      "Venta en mostrador"
    );
  });
});
