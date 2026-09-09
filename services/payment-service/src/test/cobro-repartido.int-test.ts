import { DataSource, Repository } from "typeorm";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { METODO_MIXTO, PaymentMethod } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { PaymentSplitEntity } from "../modules/payments/payment-split.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";
import { PaymentsService } from "../modules/payments/payments.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";

/**
 * El cobro repartido contra Postgres real (`npm run test:int`). El entorno de
 * desarrollo llegó a tener un `CHECK` que no admitía `MIXED`, y ninguna prueba
 * lo habría visto: las unitarias no tocan la base y la restricción vive ahí.
 */
describe("Integración: el cobro repartido se registra", () => {
  let dataSource: DataSource;
  let pagos: PaymentsService;
  let repo: Repository<PaymentEntity>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: [
        PaymentEntity,
        PaymentSplitEntity,
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

    pagos = new PaymentsService(
      repo,
      dataSource,
      new OutboxService(),
      { de: jest.fn().mockResolvedValue("America/Bogota") } as never,
      { pedir: jest.fn() } as never
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "payment_splits", "cash_movements", "cash_sessions", "payments", "outbox_messages" CASCADE'
    );
  });

  /** Caja abierta en cero, que es la que recibe la parte en efectivo. */
  const abrirCaja = async (): Promise<string> => {
    const [{ id }] = await dataSource.query(
      `INSERT INTO "cash_sessions"
        ("id", "business_id", "opened_by", "opening_amount", "opened_at")
       VALUES (gen_random_uuid(), $1, $2, 0, now()) RETURNING id`,
      [NEGOCIO, USUARIO]
    );
    return id;
  };

  const cobrarRepartido = () =>
    pagos.create(NEGOCIO, {
      clientId: CLIENTE,
      amount: 50000,
      method: PaymentMethod.CASH,
      registeredBy: USUARIO,
      metodos: [
        { method: PaymentMethod.CASH, amount: 30000 },
        { method: PaymentMethod.CARD, amount: 20000 },
      ],
    });

  it("la base admite el método MIXED del reparto", async () => {
    const cobro = await cobrarRepartido();

    expect(cobro.method).toBe(METODO_MIXTO);
    await expect(
      dataSource.getRepository(PaymentSplitEntity).count()
    ).resolves.toBe(2);
  });

  it("solo la parte en efectivo entra en el cajón", async () => {
    const sessionId = await abrirCaja();
    await cobrarRepartido();

    const movimientos = await dataSource.query(
      `SELECT "method", "amount"::int AS amount FROM "cash_movements"
       WHERE "cash_session_id" = $1 ORDER BY "method"`,
      [sessionId]
    );

    // Una línea por medio, para que el arqueo pueda desglosar; pero el cajón
    // solo cuadra contra el efectivo, así que la de tarjeta no es dinero físico.
    expect(movimientos).toEqual([
      { method: PaymentMethod.CARD, amount: 20000 },
      { method: PaymentMethod.CASH, amount: 30000 },
    ]);
  });

  it("rechaza un reparto que no suma el cobro", async () => {
    await expect(
      pagos.create(NEGOCIO, {
        clientId: CLIENTE,
        amount: 50000,
        method: PaymentMethod.CASH,
        registeredBy: USUARIO,
        metodos: [
          { method: PaymentMethod.CASH, amount: 30000 },
          { method: PaymentMethod.CARD, amount: 10000 },
        ],
      })
    ).rejects.toThrow(/revisa las partes/);
  });
});
