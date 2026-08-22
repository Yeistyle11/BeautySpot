import { DataSource } from "typeorm";
import { join } from "path";
import { ConfigService } from "@nestjs/config";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { OutboxService, ZonaDelNegocioService } from "@beautyspot/nest-common";
import { RemindersWorker } from "../modules/reminders/reminders.worker";
import { entities } from "../orm-entities";
import { Appointment } from "../entities/appointment.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const PROFESIONAL = "33333333-3333-4333-8333-333333333333";

/**
 * Comprueba contra Postgres real que el sondeo de recordatorios avanza por
 * cursor y no se salta citas.
 *
 * El unitario solo puede mirar el SQL que se genera, y aquí lo que importa son
 * dos cosas que solo se ven contra la base: que la comparación de fila
 * `(fecha, hora, id) > (…)` es válida, y que marcar las citas de una página no
 * desplaza la siguiente. Requiere la infraestructura levantada; se ejecuta con
 * `npm run test:int`.
 */
describe("Integración: el sondeo de recordatorios no se salta citas", () => {
  let dataSource: DataSource;
  let worker: RemindersWorker;
  let encolados: string[];

  beforeAll(async () => {
    dataSource = new DataSource({
      ...createMigrationDataSourceOptions(
        entities,
        join(__dirname, "..", "migrations")
      ),
      logging: false,
    });
    await dataSource.initialize();
    // Como sus hermanos: el esquema lo levantan las migraciones, no
    // `synchronize`, que además dejaría la base a medias para el resto.
    await dataSource.query("DROP SCHEMA public CASCADE");
    await dataSource.query("CREATE SCHEMA public");
    await dataSource.runMigrations();
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "appointment_services", "appointments" CASCADE'
    );
    encolados = [];

    const outbox = {
      enqueue: jest.fn(
        async (_manager: unknown, evento: { aggregateId: string }) => {
          encolados.push(evento.aggregateId);
          return {};
        }
      ),
    };
    // La zona del proceso: así la hora de pared que se inserta y la que lee el
    // worker son la misma, corra donde corra el test.
    const zonas = {
      de: jest
        .fn()
        .mockResolvedValue(Intl.DateTimeFormat().resolvedOptions().timeZone),
    };
    const config = { get: () => undefined } as unknown as ConfigService;

    worker = new RemindersWorker(
      dataSource,
      outbox as unknown as OutboxService,
      zonas as unknown as ZonaDelNegocioService,
      config
    );
  });

  /**
   * Deja `cuantas` citas dentro de la ventana de 24 horas, todas el mismo día
   * y a la misma hora salvo el minuto, que es lo que obliga al cursor a
   * desempatar por id.
   */
  async function citasPendientes(cuantas: number): Promise<void> {
    // La fecha y la hora son de pared, las dos en el mismo reloj: mezclar el
    // día en UTC con la hora local desplaza la cita cinco horas y la saca de
    // la ventana que se quiere probar.
    const dosDigitos = (n: number) => `${n}`.padStart(2, "0");
    const manana = new Date(Date.now() + 20 * 3600000);
    const fecha = `${manana.getFullYear()}-${dosDigitos(
      manana.getMonth() + 1
    )}-${dosDigitos(manana.getDate())}`;
    const hora = `${dosDigitos(manana.getHours())}:00`;

    await dataSource.query(
      `
      INSERT INTO "appointments"
        ("id", "business_id", "client_id", "professional_id",
         "date", "start_time", "end_time", "status", "totalAmount", "created_at")
      SELECT gen_random_uuid(), $1, $2, $3, $4::date, $5, '23:59', 'CONFIRMED', 0,
             now() - interval '72 hours'
      FROM generate_series(1, $6)
      `,
      [NEGOCIO, CLIENTE, PROFESIONAL, fecha, hora, cuantas]
    );
  }

  it("atiende también las citas de la segunda página", async () => {
    // Una más que el tamaño de página: con OFFSET, marcar las mil primeras
    // desplaza el conjunto y la segunda página sale vacía.
    await citasPendientes(1001);

    await worker.poll();

    expect(encolados).toHaveLength(1001);
    const sinAvisar = await dataSource
      .getRepository(Appointment)
      .createQueryBuilder("cita")
      .where("cita.reminder24hSentAt IS NULL")
      .getCount();
    expect(sinAvisar).toBe(0);
  }, 120000);
});
