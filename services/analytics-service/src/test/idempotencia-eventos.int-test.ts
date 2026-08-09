import { DataSource } from "typeorm";
import { join } from "path";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "../orm-entities";
import { MetricsService } from "../modules/metrics/metrics.service";
import { DailyMetricEntity } from "../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../entities/professional-metric.entity";
import { AnalyticsEventListeners } from "../modules/event-listeners/analytics-event-listeners.service";
import { AppointmentCreatedEvent } from "@beautyspot/event-types";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PROFESIONAL = "22222222-2222-4222-8222-222222222222";

/**
 * Comprueba contra Postgres real que un evento entregado dos veces se
 * contabiliza una sola vez.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: los eventos duplicados no inflan las métricas", () => {
  let dataSource: DataSource;
  let listeners: AnalyticsEventListeners;

  const eventoCitaCreada = (eventId: string, importe: number) =>
    ({
      eventId,
      eventType: "booking.appointment.created",
      timestamp: new Date(),
      correlationId: "apt-1",
      payload: {
        appointmentId: "apt-1",
        businessId: NEGOCIO,
        professionalId: PROFESIONAL,
        clientId: "cli-1",
        date: "2026-07-25",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: importe,
      },
    }) as unknown as AppointmentCreatedEvent;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...createMigrationDataSourceOptions(
        entities,
        join(__dirname, "..", "migrations")
      ),
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.query("DROP SCHEMA public CASCADE");
    await dataSource.query("CREATE SCHEMA public");
    await dataSource.runMigrations();

    const metrics = new MetricsService(
      dataSource.getRepository(DailyMetricEntity),
      dataSource.getRepository(ProfessionalMetricEntity),
      dataSource
    );
    listeners = new AnalyticsEventListeners(
      metrics,
      new ProcessedEventsStore(dataSource)
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "processed_events", "daily_metrics", "professional_metrics"'
    );
  });

  /** Contadores de la métrica diaria del negocio de prueba. */
  const metricaDiaria = async () =>
    dataSource
      .getRepository(DailyMetricEntity)
      .findOne({ where: { businessId: NEGOCIO } });

  it("cuenta una sola vez el mismo evento entregado dos veces", async () => {
    const evento = eventoCitaCreada(
      "33333333-3333-4333-8333-333333333333",
      50000
    );

    await listeners.handleAppointmentCreated(evento);
    await listeners.handleAppointmentCreated(evento);

    const metrica = await metricaDiaria();
    expect(metrica?.totalAppointments).toBe(1);
    // Crear la cita no mueve los ingresos: su importe es una previsión y el
    // dinero lo anota el evento de pago, el día en que se cobra.
    expect(Number(metrica?.totalRevenue)).toBe(0);
  });

  it("cuenta por separado dos eventos distintos", async () => {
    await listeners.handleAppointmentCreated(
      eventoCitaCreada("44444444-4444-4444-8444-444444444444", 10000)
    );
    await listeners.handleAppointmentCreated(
      eventoCitaCreada("55555555-5555-4555-8555-555555555555", 20000)
    );

    const metrica = await metricaDiaria();
    expect(metrica?.totalAppointments).toBe(2);
    expect(Number(metrica?.totalRevenue)).toBe(0);
  });

  it("deja constancia del evento aplicado con su handler", async () => {
    const eventId = "66666666-6666-4666-8666-666666666666";

    await listeners.handleAppointmentCreated(eventoCitaCreada(eventId, 1000));

    const marcas = await dataSource.query(
      'SELECT handler, event_type FROM "processed_events" WHERE event_id = $1',
      [eventId]
    );
    expect(marcas).toEqual([
      {
        handler: "analytics:cita creada",
        event_type: "booking.appointment.created",
      },
    ]);
  });

  // Si el trabajo falla, la marca tiene que desaparecer con él: en caso
  // contrario el evento quedaría dado por aplicado sin haberse contabilizado, y
  // una reentrega posterior no lo arreglaría.
  it("no deja marca si el incremento falla", async () => {
    const eventId = "77777777-7777-4777-8777-777777777777";
    const store = new ProcessedEventsStore(dataSource);

    await expect(
      store.once(
        { eventId, eventType: "booking.appointment.created" },
        "analytics:prueba",
        async () => {
          throw new Error("fallo simulado");
        }
      )
    ).rejects.toThrow("fallo simulado");

    const marcas = await dataSource.query(
      'SELECT 1 FROM "processed_events" WHERE event_id = $1',
      [eventId]
    );
    expect(marcas).toHaveLength(0);
  });
});
