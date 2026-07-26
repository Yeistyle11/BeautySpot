import { DataSource } from "typeorm";
import { OutboxMessageEntity, OutboxStatus } from "@beautyspot/nest-common";
import { PaymentEntity } from "../modules/payments/payment.entity";
import { InvoiceEntity } from "../modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "../modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "../modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "../modules/cash-register/cash-movement.entity";

const NEGOCIO = "44444444-4444-4444-8444-444444444444";
const USUARIO = "55555555-5555-4555-8555-555555555555";

/**
 * Comprueba contra Postgres real que el cambio de negocio y el evento del
 * Outbox se escriben en la misma transacción.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: atomicidad del Outbox", () => {
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
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "cash_movements", "cash_sessions", "outbox_messages" CASCADE'
    );
  });

  /** Datos de un mensaje de outbox asociado a una sesión de caja. */
  const mensaje = (aggregateId: string) => ({
    aggregateType: "CashSession",
    aggregateId,
    eventType: "payment.cash_session.opened",
    payload: { businessId: NEGOCIO, cashSessionId: aggregateId },
  });

  /** Sesión de caja abierta para el negocio de la prueba. */
  const sesionAbierta = () => ({
    businessId: NEGOCIO,
    openedBy: USUARIO,
    openingAmount: 50000,
    openedAt: new Date(),
  });

  it("confirma juntos el cambio y su evento", async () => {
    await dataSource.transaction(async (manager) => {
      const sesion = await manager.save(
        manager.create(CashSessionEntity, sesionAbierta())
      );
      await manager.save(
        manager.create(OutboxMessageEntity, mensaje(sesion.id))
      );
    });

    const sesiones = await dataSource.getRepository(CashSessionEntity).find();
    const eventos = await dataSource.getRepository(OutboxMessageEntity).find();

    expect(sesiones).toHaveLength(1);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].aggregateId).toBe(sesiones[0].id);
    // Nace PENDING: el relay lo publicará después, fuera de la transacción.
    expect(eventos[0].status).toBe(OutboxStatus.PENDING);
    expect(eventos[0].attempts).toBe(0);
    expect(eventos[0].processedAt).toBeNull();
  });

  it("no deja el evento suelto si la transacción se revierte", async () => {
    const fallo = new Error("fallo posterior al outbox");

    await expect(
      dataSource.transaction(async (manager) => {
        const sesion = await manager.save(
          manager.create(CashSessionEntity, sesionAbierta())
        );
        await manager.save(
          manager.create(OutboxMessageEntity, mensaje(sesion.id))
        );
        // Cualquier error después de escribir el outbox debe arrastrarlo.
        throw fallo;
      })
    ).rejects.toBe(fallo);

    await expect(
      dataSource.getRepository(CashSessionEntity).count()
    ).resolves.toBe(0);
    await expect(
      dataSource.getRepository(OutboxMessageEntity).count()
    ).resolves.toBe(0);
  });

  it("tampoco deja el cambio sin evento si falla al escribir el outbox", async () => {
    await expect(
      dataSource.transaction(async (manager) => {
        await manager.save(manager.create(CashSessionEntity, sesionAbierta()));
        // eventType es varchar(200): pasarse revienta el INSERT del outbox.
        await manager.save(
          manager.create(OutboxMessageEntity, {
            ...mensaje("66666666-6666-4666-8666-666666666666"),
            eventType: "x".repeat(201),
          })
        );
      })
    ).rejects.toBeDefined();

    await expect(
      dataSource.getRepository(CashSessionEntity).count()
    ).resolves.toBe(0);
  });

  it("el índice (status, createdAt) permite al relay buscar pendientes", async () => {
    const repo = dataSource.getRepository(OutboxMessageEntity);
    const procesado = repo.create({
      ...mensaje("77777777-7777-4777-8777-777777777777"),
      status: OutboxStatus.PROCESSED,
      processedAt: new Date(),
    });
    await repo.save([
      repo.create(mensaje("88888888-8888-4888-8888-888888888888")),
      procesado,
    ]);

    const pendientes = await repo.find({
      where: { status: OutboxStatus.PENDING },
      order: { createdAt: "ASC" },
    });

    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].aggregateId).toBe(
      "88888888-8888-4888-8888-888888888888"
    );
  });
});
