import { DataSource, Repository } from "typeorm";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { PaymentMethod } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";
import { PaymentsService } from "../modules/payments/payments.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const OTRO_NEGOCIO = "99999999-9999-4999-8999-999999999999";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";
const SOLICITUD = "66666666-6666-4666-8666-666666666666";

/**
 * Comprueba contra Postgres real que el mismo intento de cobro, enviado varias
 * veces, deja un solo cargo (`npm run test:int`).
 */
describe("Integración: un intento de cobro se cobra una vez", () => {
  let dataSource: DataSource;
  let pagos: PaymentsService;
  let repo: Repository<PaymentEntity>;

  /** Cobro suelto con tarjeta, que no toca la caja. */
  const cobrar = (solicitudId?: string, businessId = NEGOCIO) =>
    pagos.create(businessId, {
      clientId: CLIENTE,
      amount: 99000,
      method: PaymentMethod.CARD,
      registeredBy: USUARIO,
      solicitudId,
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
      'TRUNCATE TABLE "cash_movements", "cash_sessions", "payments", "outbox_messages" CASCADE'
    );
  });

  it("el segundo envío del mismo intento no cobra otra vez", async () => {
    const primero = await cobrar(SOLICITUD);
    const segundo = await cobrar(SOLICITUD);

    // Al cajero se le devuelve el cobro que ya se hizo, no un error: desde su
    // lado el segundo clic no ocurrió.
    expect(segundo.id).toBe(primero.id);
    await expect(repo.count()).resolves.toBe(1);
  });

  it("tres clics seguidos dejan un solo cargo", async () => {
    await cobrar(SOLICITUD);
    await cobrar(SOLICITUD);
    await cobrar(SOLICITUD);

    await expect(repo.count()).resolves.toBe(1);
  });

  // La tableta lenta manda las tres antes de que ninguna haya respondido: es la
  // carrera real, y la resuelve el índice, no el orden de las promesas.
  it("tres envíos simultáneos dejan un solo cargo", async () => {
    const resultados = await Promise.allSettled([
      cobrar(SOLICITUD),
      cobrar(SOLICITUD),
      cobrar(SOLICITUD),
    ]);

    expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(0);
    await expect(repo.count()).resolves.toBe(1);
  });

  // Dos cobros del mismo importe al mismo cliente son normales: una cosa es
  // repetir el intento y otra cobrar dos veces a propósito.
  it("no estorba a dos cobros distintos del mismo importe", async () => {
    await cobrar(SOLICITUD);
    await cobrar("77777777-7777-4777-8777-777777777777");

    await expect(repo.count()).resolves.toBe(2);
  });

  it("sigue admitiendo los cobros que no traen identificador", async () => {
    await cobrar();
    await cobrar();

    await expect(repo.count()).resolves.toBe(2);
  });

  it("el identificador solo choca dentro del mismo negocio", async () => {
    await cobrar(SOLICITUD);
    await cobrar(SOLICITUD, OTRO_NEGOCIO);

    await expect(repo.count()).resolves.toBe(2);
  });
});
