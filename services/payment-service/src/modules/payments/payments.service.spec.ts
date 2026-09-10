import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PaymentsService, conceptoDelCobro } from "./payments.service";
import { PaymentEntity } from "./payment.entity";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  METODO_MIXTO,
  PaymentMethod,
  PaymentStatus,
  CashMovementType,
  Role,
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
  let mockHttp: { pedir: jest.Mock; enviar: jest.Mock };

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
      // El efectivo se anota en la caja abierta: la transaccion tambien
      // consulta y crea sobre las entidades de arqueo.
      findOne: jest.fn().mockResolvedValue({ id: "cash-session-1" }),
      create: jest.fn((data) => data),
      // Las lineas del cobro: la devolucion mira por ellas cuanto entro en
      // efectivo.
      find: jest
        .fn()
        .mockResolvedValue([{ method: PaymentMethod.CASH, amount: 100 }]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
      // La reserva y la devolucion de puntos van por POST a core.
      enviar: jest.fn().mockResolvedValue({ loyaltyPoints: 460 }),
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
        descuentoComercial: 0,
        motivoDescuento: null,
        propina: 0,
        // Un cobro de un solo medio guarda igualmente su linea: la caja y el
        // arqueo leen de ahi.
        splits: [{ method: PaymentMethod.CASH, amount: 100 }],
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

    // Tres envios del mismo intento dejan un solo cargo: el segundo choca
    // contra el indice y devuelve el cobro ya hecho.
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
      // Se escribe la linea del cobro, pero ningun movimiento de caja: sin
      // caja abierta, la tarjeta entra igual y el efectivo no.
      expect(mockManagerRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: CashMovementType.IN })
      );
    });

    describe("descuento, propina y reparto", () => {
      /** Alta de 100 con lo que se le indique encima. */
      const alta = (extra: Record<string, unknown>) => ({
        clientId: "client-123",
        amount: 100,
        method: PaymentMethod.CASH,
        registeredBy: "user-123",
        ...extra,
      });

      beforeEach(() => {
        mockRepo.create.mockReturnValue(mockPayment);
        mockManagerRepo.save.mockResolvedValue(mockPayment);
      });

      // El descuento sale del margen del negocio: quien esta en el mostrador
      // cobra, pero no decide regalar.
      it("recepción no puede descontar", async () => {
        await expect(
          service.create(
            "business-123",
            alta({
              descuentoComercial: 20,
              motivoDescuento: "cliente fiel",
              rol: Role.RECEPTIONIST,
            })
          )
        ).rejects.toThrow(ForbiddenException);
      });

      it("un descuento sin motivo no dice qué se regaló", async () => {
        await expect(
          service.create(
            "business-123",
            alta({ descuentoComercial: 20, rol: Role.ADMIN })
          )
        ).rejects.toThrow(BadRequestException);
      });

      it("guarda el descuento del dueño con su motivo", async () => {
        await service.create(
          "business-123",
          alta({
            descuentoComercial: 20,
            motivoDescuento: "  promoción del martes  ",
            rol: Role.OWNER,
          })
        );

        expect(mockRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            descuentoComercial: 20,
            motivoDescuento: "promoción del martes",
          })
        );
      });

      // La propina entra al cajon con el cobro, asi que la linea suma las dos
      // cosas; lo que no hace es engordar la venta.
      it("la propina viaja en la línea pero no en el importe", async () => {
        await service.create("business-123", alta({ propina: 15 }));

        expect(mockRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 100,
            propina: 15,
            splits: [{ method: PaymentMethod.CASH, amount: 115 }],
          })
        );
      });

      it("reparte el cobro entre dos medios y lo marca como mixto", async () => {
        await service.create(
          "business-123",
          alta({
            metodos: [
              { method: PaymentMethod.CASH, amount: 40 },
              { method: PaymentMethod.CARD, amount: 60 },
            ],
          })
        );

        expect(mockRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            method: METODO_MIXTO,
            splits: [
              { method: PaymentMethod.CASH, amount: 40 },
              { method: PaymentMethod.CARD, amount: 60 },
            ],
          })
        );
      });

      it("no acepta un reparto que no cuadra con el cobro", async () => {
        await expect(
          service.create(
            "business-123",
            alta({
              propina: 10,
              metodos: [
                { method: PaymentMethod.CASH, amount: 40 },
                { method: PaymentMethod.CARD, amount: 60 },
              ],
            })
          )
        ).rejects.toThrow(BadRequestException);
      });

      it("no acepta el mismo medio dos veces", async () => {
        await expect(
          service.create(
            "business-123",
            alta({
              metodos: [
                { method: PaymentMethod.CASH, amount: 40 },
                { method: PaymentMethod.CASH, amount: 60 },
              ],
            })
          )
        ).rejects.toThrow(BadRequestException);
      });

      // El arqueo desglosa por medio y solo cuadra el cajon contra el
      // efectivo: cada parte necesita su movimiento.
      it("deja un movimiento de caja por cada medio", async () => {
        await service.create(
          "business-123",
          alta({
            metodos: [
              { method: PaymentMethod.CASH, amount: 40 },
              { method: PaymentMethod.CARD, amount: 60 },
            ],
          })
        );

        const movimientos = mockManagerRepo.create.mock.calls
          .map(([datos]: [Record<string, unknown>]) => datos)
          .filter((datos: any) => datos.type === CashMovementType.IN);
        expect(movimientos).toEqual([
          expect.objectContaining({
            method: PaymentMethod.CASH,
            amount: 40,
          }),
          expect.objectContaining({
            method: PaymentMethod.CARD,
            amount: 60,
          }),
        ]);
      });
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

      // La cita vale 100: con 20 de descuento el cliente paga 80, y el cuadre
      // tiene que contar lo que se regalo igual que cuenta los puntos.
      it("cuadra con la cita contando el descuento concedido", async () => {
        await expect(
          service.create("business-123", {
            ...conCita,
            amount: 80,
            descuentoComercial: 20,
            motivoDescuento: "promoción del martes",
            rol: Role.OWNER,
          })
        ).resolves.toBeDefined();
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
        mockHttp.pedir.mockResolvedValue({
          clientId: "client-123",
          totalAmount: 100,
        });
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

      it("deja constancia del canje en el evento del cobro", async () => {
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

      // Core descuenta con la condicion dentro del UPDATE y responde 409 si el
      // saldo no llega; aqui eso llega como fallo de la llamada.
      it("rechaza gastar más puntos de los que tiene el cliente", async () => {
        mockHttp.enviar.mockRejectedValue(new Error("409"));

        await expect(service.create("business-123", conPuntos)).rejects.toThrow(
          BadRequestException
        );
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });

      it("reserva los puntos en core antes de escribir el cobro", async () => {
        await service.create("business-123", conPuntos);

        expect(mockHttp.enviar).toHaveBeenCalledWith(
          "core",
          "/internal/clients/client-123/puntos/reservar",
          { businessId: "business-123", puntos: 40 }
        );
      });

      // Sin esto, un fallo posterior a la reserva deja al cliente sin puntos y
      // sin el descuento por el que los gasto.
      it("devuelve los puntos si el cobro no llega a escribirse", async () => {
        mockDataSource.transaction.mockRejectedValue(new Error("base caída"));

        await expect(service.create("business-123", conPuntos)).rejects.toThrow(
          "base caída"
        );
        expect(mockHttp.enviar).toHaveBeenCalledWith(
          "core",
          "/internal/clients/client-123/puntos/devolver",
          { businessId: "business-123", puntos: 40 }
        );
      });

      // El reenvio del mismo intento devuelve el cobro que ya existe, que ya
      // gasto sus puntos: los de este segundo intento vuelven a la ficha.
      it("devuelve los puntos cuando el intento resulta ser un reenvío", async () => {
        const previo = { ...mockPayment, solicitudId: "sol-1" } as never;
        mockDataSource.transaction.mockRejectedValue({ code: "23505" });
        // Solo la busqueda por solicitud encuentra algo: la que comprueba si la
        // cita ya estaba cobrada tiene que seguir diciendo que no.
        mockRepo.findOne.mockImplementation((opciones) =>
          (opciones as { where?: { solicitudId?: string } })?.where?.solicitudId
            ? Promise.resolve(previo)
            : Promise.resolve(null)
        );

        const cobro = await service.create("business-123", {
          ...conPuntos,
          solicitudId: "sol-1",
        });

        expect(cobro).toBe(previo);
        expect(mockHttp.enviar).toHaveBeenCalledWith(
          "core",
          "/internal/clients/client-123/puntos/devolver",
          { businessId: "business-123", puntos: 40 }
        );
      });

      it("rechaza el canje si la ficha no es del negocio", async () => {
        mockHttp.enviar.mockRejectedValue(new Error("409"));

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

    /** El listado se arma con query builder: necesita un join contra las líneas. */
    const mockListado = (filas: unknown[], total = filas.length) => {
      const qb: Record<string, jest.Mock> = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([filas, total]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    };

    /** Condiciones SQL que el listado acabó pidiendo. */
    const condiciones = (qb: Record<string, jest.Mock>) =>
      qb.andWhere.mock.calls.map(([sql]) => String(sql)).join(" | ");

    it("devuelve una página con metadatos de paginación", async () => {
      const qb = mockListado([mockPayment], 1);

      const result = await service.findByBusiness(
        "business-123",
        {},
        pagination
      );

      expect(qb.where).toHaveBeenCalledWith("p.business_id = :businessId", {
        businessId: "business-123",
      });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.data).toEqual([mockPayment]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    // Un cobro repartido vale MIXED en su columna, así que el filtro tiene que
    // mirar también sus líneas o esconde el cobro de los tres medios concretos.
    it("al filtrar por método alcanza también las líneas del reparto", async () => {
      const qb = mockListado([mockPayment]);

      await service.findByBusiness(
        "business-123",
        { method: PaymentMethod.CASH },
        pagination
      );

      const sql = condiciones(qb);
      expect(sql).toContain("p.method = :method");
      expect(sql).toContain("payment_splits");
      expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
        method: PaymentMethod.CASH,
      });
    });

    it("debería filtrar por estado", async () => {
      const qb = mockListado([mockPayment]);

      await service.findByBusiness(
        "business-123",
        { status: PaymentStatus.COMPLETED },
        pagination
      );

      expect(qb.andWhere).toHaveBeenCalledWith("p.status = :status", {
        status: PaymentStatus.COMPLETED,
      });
    });

    it("debería filtrar por rango de fechas", async () => {
      const qb = mockListado([mockPayment]);

      await service.findByBusiness(
        "business-123",
        { from: "2024-01-01", to: "2024-01-31" },
        pagination
      );

      expect(condiciones(qb)).toContain("p.created_at BETWEEN :from AND :to");
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

  describe("correctPayment", () => {
    // Esta via reescribe un importe y un medio. Un cobro repartido tiene
    // varias partes y varios movimientos de caja detras.
    it("no corrige un cobro repartido entre varios medios", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        method: METODO_MIXTO,
      } as any);

      await expect(
        service.correctPayment("payment-123", "business-123", {
          amount: 120,
          reason: "importe mal tecleado",
          editedBy: "user-123",
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe("getDailySummary", () => {
    const mockQueryBuilder = (cobros: unknown[]) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(cobros),
    });

    it("agrupa por el medio de cada cobro", async () => {
      mockRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder([
          { amount: 50, method: "CASH", splits: [] },
          { amount: 30, method: "CARD", splits: [] },
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

    // El cobro repartido vale MIXED en su columna: agrupar por ella dejaba los
    // tres medios en cero mientras el total no lo estaba.
    it("desglosa el cobro repartido por sus líneas, no como MIXTO", async () => {
      mockRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder([
          {
            amount: 50000,
            method: "MIXED",
            splits: [
              { method: "CASH", amount: 30000 },
              { method: "CARD", amount: 20000 },
            ],
          },
        ]) as any
      );

      const result = await service.getDailySummary(
        "business-123",
        "2024-01-15"
      );

      expect(result.total).toBe(50000);
      expect(result.byMethod).toEqual({ CASH: 30000, CARD: 20000 });
      expect(result.byMethod.MIXED).toBeUndefined();
    });

    // Las líneas llevan la propina dentro y el importe no, así que la venta de
    // cada medio es su parte proporcional: el desglose suma siempre el total.
    it("descuenta la propina del desglose y sigue cuadrando", async () => {
      mockRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder([
          {
            amount: 50000,
            method: "MIXED",
            splits: [
              { method: "CASH", amount: 30000 },
              { method: "CARD", amount: 25000 },
            ],
          },
        ]) as any
      );

      const result = await service.getDailySummary(
        "business-123",
        "2024-01-15"
      );

      const sumado = Object.values(result.byMethod).reduce((a, b) => a + b, 0);
      expect(sumado).toBe(result.total);
      expect(result.byMethod).toEqual({ CASH: 27273, CARD: 22727 });
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
  describe("correctPayment", () => {
    /**
     * Un importe mal tecleado en el mostrador se corrige mientras la caja que
     * lo recogio siga abierta; despues, la via es la devolucion.
     */
    const corregir = {
      amount: 30000,
      reason: "Se tecleó 300.000 en vez de 30.000",
      editedBy: "user-999",
    };

    /** Movimiento de caja del cobro, en la sesion que se indique. */
    function conCajaDelMovimiento(sesion: {
      id: string;
      closedAt: Date | null;
    }) {
      mockManagerRepo.findOne = jest.fn(async (opciones: any) => {
        if (opciones?.where?.paymentId) {
          return {
            id: "mov-1",
            cashSessionId: sesion.id,
            type: CashMovementType.IN,
          };
        }
        return sesion;
      });
    }

    beforeEach(() => {
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        amount: 300000,
      } as any);
      mockManagerRepo.findOneOrFail = jest
        .fn()
        .mockResolvedValue({ ...mockPayment, amount: 30000 });
    });

    it("corrige el importe y deja escrito quién y por qué", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: null });

      await service.correctPayment("payment-123", "business-123", corregir);

      expect(mockManagerRepo.update).toHaveBeenCalledWith(
        { id: "payment-123", businessId: "business-123" },
        expect.objectContaining({
          amount: 30000,
          editedBy: "user-999",
          editReason: "Se tecleó 300.000 en vez de 30.000",
          editedAt: expect.any(Date),
        })
      );
    });

    it("ajusta el movimiento de caja al importe corregido", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: null });

      await service.correctPayment("payment-123", "business-123", corregir);

      expect(mockManagerRepo.update).toHaveBeenCalledWith(
        { id: "mov-1" },
        { amount: 30000, method: PaymentMethod.CASH }
      );
    });

    it("no corrige un cobro cuya caja ya se cerró", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: new Date() });

      await expect(
        service.correctPayment("payment-123", "business-123", corregir)
      ).rejects.toThrow(BadRequestException);
    });

    it("avisa de que la vía es la devolución cuando la caja está cerrada", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: new Date() });

      await expect(
        service.correctPayment("payment-123", "business-123", corregir)
      ).rejects.toThrow(/devolución/);
    });

    it("solo corrige cobros completados", async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      } as any);

      await expect(
        service.correctPayment("payment-123", "business-123", corregir)
      ).rejects.toThrow(BadRequestException);
    });

    it("avisa del cambio con la diferencia y el día del cobro original", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: null });

      await service.correctPayment("payment-123", "business-123", corregir);

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({
          eventType: EventNames.PAYMENT_PAYMENT_CORRECTED,
          payload: expect.objectContaining({
            previousAmount: 300000,
            amount: 30000,
            difference: -270000,
          }),
        })
      );
    });

    it("no avisa a nadie si el importe no cambió", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: null });

      await service.correctPayment("payment-123", "business-123", {
        notes: "Otra nota",
        reason: "Corregir la nota",
        editedBy: "user-999",
      });

      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });

    // El cobro se tecleo como efectivo y era con datafono: el dinero nunca
    // paso por el cajon, asi que su movimiento sobra. Se puede borrar porque
    // la sesion sigue abierta y todavia no se ha arqueado.
    it("borra el movimiento cuando el cobro deja de ser en efectivo", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: null });

      await service.correctPayment("payment-123", "business-123", {
        ...corregir,
        method: PaymentMethod.CARD,
      });

      expect(mockManagerRepo.delete).toHaveBeenCalledWith({ id: "mov-1" });
      expect(mockManagerRepo.update).not.toHaveBeenCalledWith(
        { id: "mov-1" },
        expect.anything()
      );
    });

    // Al reves: era con datafono y resulta que fue en efectivo. No habia
    // movimiento y ahora el cajon tiene que recogerlo.
    it("crea el movimiento cuando el cobro pasa a ser en efectivo", async () => {
      // Sin movimiento del cobro, pero con caja abierta que lo reciba.
      mockManagerRepo.findOne = jest.fn(async (opciones: any) =>
        opciones?.where?.paymentId
          ? null
          : { id: "cash-session-1", closedAt: null }
      );

      await service.correctPayment("payment-123", "business-123", {
        ...corregir,
        method: PaymentMethod.CASH,
      });

      expect(mockManagerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cashSessionId: "cash-session-1",
          type: CashMovementType.IN,
          amount: 30000,
          method: PaymentMethod.CASH,
        })
      );
    });

    it("no corrige un cobro que entró en una caja ya cerrada", async () => {
      conCajaDelMovimiento({ id: "cash-session-1", closedAt: new Date() });

      await expect(
        service.correctPayment("payment-123", "business-123", corregir)
      ).rejects.toThrow(/caja que ya se cerró/);
    });
  });

  describe("cobro de cero", () => {
    it("rechaza un cobro de cero sin puntos", async () => {
      await expect(
        service.create("business-123", {
          clientId: "client-123",
          amount: 0,
          method: PaymentMethod.CASH,
          registeredBy: "user-123",
        })
      ).rejects.toThrow(/mayor que cero/);
    });

    // Con puntos, `amount` es lo que el cliente pone de su bolsillo: que sea
    // cero significa que el canje cubrio el servicio entero.
    it("admite el cero cuando los puntos cubren el total", async () => {
      mockHttp.pedir.mockResolvedValue({
        clientId: "client-123",
        totalAmount: 100,
      });
      mockRepo.create.mockReturnValue(mockPayment);
      mockManagerRepo.save.mockResolvedValue(mockPayment);

      await expect(
        service.create("business-123", {
          clientId: "client-123",
          amount: 0,
          method: PaymentMethod.CASH,
          registeredBy: "user-123",
          puntosUsados: 100,
        })
      ).resolves.toBeDefined();
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
