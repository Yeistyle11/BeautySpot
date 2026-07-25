import { DataSource, QueryFailedError, Repository } from "typeorm";
import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";

/** Código de error de Postgres para violación de restricción única. */
const UNIQUE_VIOLATION = "23505";

const NEGOCIO_A = "11111111-1111-4111-8111-111111111111";
const NEGOCIO_B = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";

/**
 * Verifica contra Postgres real el índice único parcial
 * `uq_cash_sessions_open_per_business`, que impide que un negocio tenga dos
 * sesiones de caja abiertas a la vez.
 *
 * Esto NO se puede cubrir con un unit test: la comprobación en código
 * (cash-register.service busca una sesión abierta antes de insertar) es un
 * check-then-act, y con los repositorios mockeados siempre parece correcta. La
 * garantía real la da la base de datos, y solo se puede observar ejecutando el
 * INSERT de verdad.
 *
 * Requiere la infraestructura de test levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: una sola caja abierta por negocio", () => {
  let dataSource: DataSource;
  let sesiones: Repository<CashSessionEntity>;

  /** Sesión de caja abierta (sin closedAt) para el negocio indicado. */
  const sesionAbierta = (businessId: string) =>
    sesiones.create({
      businessId,
      openedBy: USUARIO,
      openingAmount: 100000,
      openedAt: new Date(),
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
      // Crea el esquema desde las entidades, incluido el índice parcial.
      synchronize: true,
    });
    await dataSource.initialize();
    sesiones = dataSource.getRepository(CashSessionEntity);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  // La base de test es compartida entre ficheros: cada test parte de cero.
  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "cash_movements", "cash_sessions" CASCADE'
    );
  });

  it("el índice único parcial existe en el esquema generado", async () => {
    const indices = await dataSource.query(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'cash_sessions'
         AND indexname = 'uq_cash_sessions_open_per_business'`
    );

    expect(indices).toHaveLength(1);
    expect(indices[0].indexdef).toContain("UNIQUE");
    expect(indices[0].indexdef).toContain("closed_at IS NULL");
  });

  it("rechaza una segunda caja abierta en el mismo negocio", async () => {
    await sesiones.save(sesionAbierta(NEGOCIO_A));

    // Esto es lo que ocurriría con dos aperturas simultáneas que ambas pasan el
    // check-then-act del servicio: la base de datos corta la segunda.
    let error: unknown;
    try {
      await sesiones.save(sesionAbierta(NEGOCIO_A));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(QueryFailedError);
    expect((error as QueryFailedError & { code: string }).code).toBe(
      UNIQUE_VIOLATION
    );
    await expect(
      sesiones.count({ where: { businessId: NEGOCIO_A } })
    ).resolves.toBe(1);
  });

  it("permite abrir una nueva caja después de cerrar la anterior", async () => {
    const primera = await sesiones.save(sesionAbierta(NEGOCIO_A));

    primera.closedAt = new Date();
    primera.closedBy = USUARIO;
    primera.closingAmount = 150000;
    await sesiones.save(primera);

    await expect(
      sesiones.save(sesionAbierta(NEGOCIO_A))
    ).resolves.toMatchObject({ businessId: NEGOCIO_A });
    await expect(
      sesiones.count({ where: { businessId: NEGOCIO_A } })
    ).resolves.toBe(2);
  });

  it("no aísla de más: dos negocios pueden tener su caja abierta a la vez", async () => {
    await sesiones.save(sesionAbierta(NEGOCIO_A));

    // El índice es parcial por business_id: no debe estorbar entre tenants.
    await expect(
      sesiones.save(sesionAbierta(NEGOCIO_B))
    ).resolves.toMatchObject({ businessId: NEGOCIO_B });
  });

  it("varias cajas cerradas conviven con una abierta", async () => {
    for (let i = 0; i < 3; i++) {
      const cerrada = sesionAbierta(NEGOCIO_A);
      cerrada.closedAt = new Date();
      cerrada.closedBy = USUARIO;
      cerrada.closingAmount = 100000;
      await sesiones.save(cerrada);
    }

    // El índice solo mira las filas con closed_at IS NULL, así que el histórico
    // no interfiere.
    await expect(
      sesiones.save(sesionAbierta(NEGOCIO_A))
    ).resolves.toMatchObject({ businessId: NEGOCIO_A });
    await expect(
      sesiones.count({ where: { businessId: NEGOCIO_A } })
    ).resolves.toBe(4);
  });
});
