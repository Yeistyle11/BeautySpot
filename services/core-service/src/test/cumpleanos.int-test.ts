import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { OutboxMessageEntity, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { entities } from "../orm-entities";
import { Business } from "../entities/business.entity";
import { Client } from "../entities/client.entity";
import { CumpleanosWorker } from "../modules/cumpleanos/cumpleanos.worker";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";

/**
 * Comprueba contra Postgres real que la felicitación se emite una sola vez por
 * año y que la marca y el evento se confirman juntos.
 *
 * El sondeo depende de dos cosas que ningún repositorio simulado puede
 * reproducir: que Postgres compare el día en la zona del negocio, y que el
 * `UPDATE` condicional deje fuera al segundo ciclo.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: felicitación de cumpleaños", () => {
  let dataSource: DataSource;
  let worker: CumpleanosWorker;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();

    worker = new CumpleanosWorker(
      dataSource,
      new OutboxService(),
      // El sondeo se dispara a mano; el temporizador no llega a arrancar.
      { get: () => undefined } as unknown as ConfigService
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "clients", "businesses", "outbox_messages" CASCADE'
    );
    await dataSource.getRepository(Business).save({
      id: NEGOCIO,
      name: "Salón de prueba",
      slug: "salon-de-prueba",
      timezone: "America/Bogota",
    });
  });

  /**
   * Fecha de nacimiento con el día y el mes que tenga hoy Bogotá, desplazado los
   * días que se indiquen. La calcula Postgres para que el test no dependa de la
   * zona de la máquina que lo ejecuta.
   */
  const cumpleDesplazado = async (dias = 0): Promise<string> => {
    const [{ md }] = await dataSource.query(
      `SELECT to_char((now() AT TIME ZONE 'America/Bogota') + make_interval(days => $1), 'MM-DD') AS md`,
      [dias]
    );
    // 1992 es bisiesto: así un 29 de febrero sigue siendo una fecha válida.
    return `1992-${md}`;
  };

  /** Año en curso en Bogotá, que es el que marca el worker. */
  const anioEnBogota = async (): Promise<number> => {
    const [{ anio }] = await dataSource.query(
      `SELECT EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Bogota'))::int AS anio`
    );
    return anio;
  };

  /** Deja una ficha en la base y la devuelve. */
  const guardarCliente = async (datos: Partial<Client>): Promise<Client> =>
    dataSource.getRepository(Client).save(
      dataSource.getRepository(Client).create({
        businessId: NEGOCIO,
        name: "Ana Gómez",
        email: "ana@example.com",
        ...datos,
      })
    );

  it("emite el evento y marca el año, y no repite en el siguiente ciclo", async () => {
    const cliente = await guardarCliente({
      birthDate: await cumpleDesplazado(),
    });

    await worker.sondear();

    const eventos = await dataSource.getRepository(OutboxMessageEntity).find();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].eventType).toBe(EventNames.CORE_CLIENT_BIRTHDAY);
    expect(eventos[0].aggregateId).toBe(cliente.id);

    const marcado = await dataSource
      .getRepository(Client)
      .findOneByOrFail({ id: cliente.id });
    expect(marcado.birthdayGreetedYear).toBe(await anioEnBogota());

    // Segundo ciclo: la marca del año deja la ficha fuera de la consulta.
    await worker.sondear();

    await expect(
      dataSource.getRepository(OutboxMessageEntity).count()
    ).resolves.toBe(1);
  });

  it("vuelve a felicitar al año siguiente", async () => {
    const cliente = await guardarCliente({
      birthDate: await cumpleDesplazado(),
      birthdayGreetedYear: (await anioEnBogota()) - 1,
    });

    await worker.sondear();

    const eventos = await dataSource.getRepository(OutboxMessageEntity).find();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].aggregateId).toBe(cliente.id);
  });

  it("no felicita a quien no cumple hoy, ni a la ficha inactiva o suprimida", async () => {
    const hoy = await cumpleDesplazado();
    await guardarCliente({
      birthDate: await cumpleDesplazado(1),
      name: "Otro día",
    });
    await guardarCliente({ birthDate: hoy, active: false, name: "Inactiva" });
    await guardarCliente({
      birthDate: hoy,
      anonymizedAt: new Date(),
      name: "Suprimida",
    });
    await guardarCliente({ birthDate: null, name: "Sin fecha" });

    await worker.sondear();

    await expect(
      dataSource.getRepository(OutboxMessageEntity).count()
    ).resolves.toBe(0);
  });
});
