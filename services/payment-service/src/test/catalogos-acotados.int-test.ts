import { DataSource } from "typeorm";
import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";
/** Código de error de Postgres para violación de CHECK. */
const CHECK_VIOLATION = "23514";

/**
 * Comprueba contra Postgres real que la base rechaza los estados que no estan
 * en el catalogo (`npm run test:int`).
 */
describe("Integración: la base acota los catálogos", () => {
  let dataSource: DataSource;

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
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "payments", "cash_movements", "cash_sessions" CASCADE'
    );
  });

  /** Inserta un cobro saltándose el servicio, que es donde vive la validación. */
  const insertarCobro = (method: string, status: string) =>
    dataSource.query(
      `INSERT INTO "payments"
        ("id", "business_id", "client_id", "amount", "method", "status", "registered_by")
       VALUES (gen_random_uuid(), $1, $2, 1000, $3, $4, $5)`,
      [NEGOCIO, CLIENTE, method, status, USUARIO]
    );

  it("acepta el método y el estado del catálogo", async () => {
    await expect(
      insertarCobro(PaymentMethod.CARD, PaymentStatus.COMPLETED)
    ).resolves.toBeDefined();
  });

  it("rechaza un método que no existe", async () => {
    await expect(
      insertarCobro("BITCOIN", PaymentStatus.COMPLETED)
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("rechaza un estado que no existe", async () => {
    await expect(
      insertarCobro(PaymentMethod.CASH, "PAGADO")
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("rechaza un estado de factura que no existe", async () => {
    await expect(
      dataSource.query(
        `INSERT INTO "invoices"
          ("id", "business_id", "number", "client_id", "date", "due_date",
           "subtotal", "tax", "tax_rate", "total", "status")
         VALUES (gen_random_uuid(), $1, 'INV-2026-1', $2, now(), now(),
                 1000, 0, 0, 1000, 'ENVIADA')`,
        [NEGOCIO, CLIENTE]
      )
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  describe("movimientos de caja", () => {
    /** Sesión de caja abierta a la que colgar los movimientos. */
    const abrirCaja = async (): Promise<string> => {
      const [{ id }] = await dataSource.query(
        `INSERT INTO "cash_sessions"
          ("id", "business_id", "opened_by", "opening_amount", "opened_at")
         VALUES (gen_random_uuid(), $1, $2, 0, now()) RETURNING id`,
        [NEGOCIO, USUARIO]
      );
      return id;
    };

    const insertarMovimiento = async (tipo: string, metodo: string | null) => {
      const sessionId = await abrirCaja();
      return dataSource.query(
        `INSERT INTO "cash_movements"
          ("id", "cash_session_id", "type", "amount", "concept", "method", "registered_by")
         VALUES (gen_random_uuid(), $1, $2, 1000, 'Venta', $3, $4)`,
        [sessionId, tipo, metodo, USUARIO]
      );
    };

    it("rechaza un sentido que no existe", async () => {
      await expect(insertarMovimiento("ENTRADA", null)).rejects.toMatchObject({
        code: CHECK_VIOLATION,
      });
    });

    // El movimiento anotado a mano no tiene método de cobro detrás.
    it("admite el movimiento sin método", async () => {
      await expect(insertarMovimiento("IN", null)).resolves.toBeDefined();
    });

    it("rechaza un método que no existe", async () => {
      await expect(insertarMovimiento("IN", "BITCOIN")).rejects.toMatchObject({
        code: CHECK_VIOLATION,
      });
    });
  });
});
