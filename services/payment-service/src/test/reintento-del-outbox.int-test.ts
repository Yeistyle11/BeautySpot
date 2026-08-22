import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import {
  OutboxMessageEntity,
  OutboxRelayWorker,
  OutboxStatus,
} from "@beautyspot/nest-common";

const NEGOCIO = "44444444-4444-4444-8444-444444444444";
const CAJA = "99999999-9999-4999-8999-999999999999";

/**
 * Comprueba contra Postgres real que un fallo al publicar aplaza el siguiente
 * intento en vez de gastarlos todos seguidos.
 *
 * El unitario solo puede mirar el objeto que se le pasa al repositorio; lo que
 * importa aquí es que la columna existe en la tabla y que el propio relay deja
 * de reclamar la fila mientras la espera no ha vencido.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: el outbox espera entre reintentos", () => {
  let dataSource: DataSource;

  /** Relay conectado a la base real, con una cola que siempre falla. */
  function relayQueNoPublica(): OutboxRelayWorker {
    const eventBus = {
      emit: jest.fn().mockRejectedValue(new Error("rabbit caído")),
    };
    const config = {
      get: () => undefined,
    } as unknown as ConfigService;

    return new OutboxRelayWorker(dataSource, eventBus as never, config);
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: [OutboxMessageEntity],
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
    await dataSource.query('TRUNCATE TABLE "outbox_messages" CASCADE');
  });

  /** Deja un evento pendiente de publicar. */
  async function pendiente(): Promise<OutboxMessageEntity> {
    const repo = dataSource.getRepository(OutboxMessageEntity);
    return repo.save(
      repo.create({
        aggregateType: "CashSession",
        aggregateId: CAJA,
        eventType: "payment.cash_session.opened",
        payload: { businessId: NEGOCIO, cashSessionId: CAJA },
      })
    );
  }

  it("un fallo deja la fila pendiente con la espera anotada", async () => {
    const fila = await pendiente();
    const antes = Date.now();

    await relayQueNoPublica().poll();

    const guardada = await dataSource
      .getRepository(OutboxMessageEntity)
      .findOneByOrFail({ id: fila.id });
    expect(guardada.status).toBe(OutboxStatus.PENDING);
    expect(guardada.attempts).toBe(1);
    expect(guardada.nextAttemptAt).not.toBeNull();
    expect(guardada.nextAttemptAt!.getTime()).toBeGreaterThan(antes);
  });

  it("no gasta los cinco intentos seguidos cuando la cola no vuelve", async () => {
    const fila = await pendiente();
    const relay = relayQueNoPublica();

    // Cinco sondeos seguidos: sin espera, el mensaje llegaría muerto al quinto.
    for (let i = 0; i < 5; i++) await relay.poll();

    const guardada = await dataSource
      .getRepository(OutboxMessageEntity)
      .findOneByOrFail({ id: fila.id });
    expect(guardada.attempts).toBe(1);
    expect(guardada.status).toBe(OutboxStatus.PENDING);
  });

  it("vuelve a reclamarlo cuando la espera ya venció", async () => {
    const fila = await pendiente();
    await dataSource
      .getRepository(OutboxMessageEntity)
      .update(fila.id, { nextAttemptAt: new Date(Date.now() - 60_000) });

    await relayQueNoPublica().poll();

    const guardada = await dataSource
      .getRepository(OutboxMessageEntity)
      .findOneByOrFail({ id: fila.id });
    expect(guardada.attempts).toBe(1);
  });
});
