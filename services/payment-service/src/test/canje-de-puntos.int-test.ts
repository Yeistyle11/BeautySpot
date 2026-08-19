import { DataSource, Repository } from "typeorm";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { PaymentMethod } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";
import { PaymentsService } from "../modules/payments/payments.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";
const CITA = "44444444-4444-4444-8444-444444444444";

/** Cita de 100: el cliente pagará 60 y canjeará 40 puntos. */
const CITA_DE_100 = {
  clientId: CLIENTE,
  totalAmount: 100,
  status: "CONFIRMED",
  services: [{ serviceId: "s-1", name: "Corte", price: 100, duration: 30 }],
};

/**
 * Comprueba contra Postgres real que el descuento de puntos, que viaja por el
 * outbox, y el cobro se confirman juntos (`npm run test:int`).
 */
describe("Integración: el canje de puntos va con el cobro", () => {
  let dataSource: DataSource;
  let pagos: PaymentsService;
  let repo: Repository<PaymentEntity>;
  let outboxRepo: Repository<OutboxMessageEntity>;
  let saldo: number;

  /** Cobro de la cita pagando 60 y canjeando 40 puntos. */
  const cobrarConPuntos = (method = PaymentMethod.CARD) =>
    pagos.create(NEGOCIO, {
      appointmentId: CITA,
      clientId: CLIENTE,
      amount: 60,
      method,
      registeredBy: USUARIO,
      puntosUsados: 40,
    });

  const eventosDeCanje = () =>
    outboxRepo.count({
      where: { eventType: EventNames.PAYMENT_POINTS_REDEEMED },
    });

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: [
        PaymentEntity,
        InvoiceEntity,
        InvoiceItemEntity,
        CashSessionEntity,
        CashMovementEntity,
        OutboxMessageEntity,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    repo = dataSource.getRepository(PaymentEntity);
    outboxRepo = dataSource.getRepository(OutboxMessageEntity);

    pagos = new PaymentsService(
      repo,
      dataSource,
      new OutboxService(),
      { de: jest.fn().mockResolvedValue("America/Bogota") } as never,
      {
        // core responde el saldo del cliente; booking, la cita.
        pedir: jest
          .fn()
          .mockImplementation(async (servicio: string) =>
            servicio === "core" ? { loyaltyPoints: saldo } : CITA_DE_100
          ),
      } as never
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    saldo = 500;
    await dataSource.query(
      'TRUNCATE TABLE "cash_movements", "cash_sessions", "payments", "outbox_messages" CASCADE'
    );
  });

  it("guarda el cobro con los puntos y el descuento aplicados", async () => {
    const pago = await cobrarConPuntos();

    expect(pago.puntosUsados).toBe(40);
    expect(Number(pago.descuento)).toBe(40);
    expect(Number(pago.amount)).toBe(60);
  });

  it("encola el descuento junto al cobro", async () => {
    const pago = await cobrarConPuntos();

    const [canje] = await outboxRepo.find({
      where: { eventType: EventNames.PAYMENT_POINTS_REDEEMED },
    });
    expect(canje.aggregateId).toBe(pago.id);
    expect(canje.payload).toMatchObject({
      clientId: CLIENTE,
      points: 40,
      discount: 40,
    });
  });

  // Si el cobro se revierte y el evento quedara escrito, el relay lo publicaría
  // y el cliente perdería 40 puntos por un cobro que no existe.
  it("no deja el descuento escrito si el cobro se revierte", async () => {
    // En efectivo y sin caja abierta: la transacción falla después de haber
    // guardado el pago, que es el momento en que el rollback importa.
    await expect(cobrarConPuntos(PaymentMethod.CASH)).rejects.toThrow(
      /caja abierta/i
    );

    await expect(repo.count()).resolves.toBe(0);
    await expect(eventosDeCanje()).resolves.toBe(0);
  });

  it("no descuenta nada si el cliente no tiene saldo suficiente", async () => {
    saldo = 10;

    await expect(cobrarConPuntos()).rejects.toThrow(/solo tiene 10 puntos/i);

    await expect(repo.count()).resolves.toBe(0);
    await expect(eventosDeCanje()).resolves.toBe(0);
  });

  it("un cobro sin canje no encola ningún descuento", async () => {
    await pagos.create(NEGOCIO, {
      appointmentId: CITA,
      clientId: CLIENTE,
      amount: 100,
      method: PaymentMethod.CARD,
      registeredBy: USUARIO,
    });

    await expect(eventosDeCanje()).resolves.toBe(0);
  });
});
