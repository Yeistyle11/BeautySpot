import { DataSource } from "typeorm";
import { join } from "path";
import { OutboxService } from "@beautyspot/nest-common";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { entities } from "../orm-entities";
import { AppointmentsService } from "../modules/appointments/appointments.service";
import { Appointment } from "../entities/appointment.entity";
import { Availability } from "../entities/availability.entity";
import { BlockedSlot } from "../entities/blocked-slot.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PROFESIONAL = "22222222-2222-4222-8222-222222222222";
const CLIENTE_A = "33333333-3333-4333-8333-333333333333";
const CLIENTE_B = "44444444-4444-4444-8444-444444444444";
const FECHA = "2026-08-03"; // lunes
const HORA = "10:00";

/**
 * Comprueba contra Postgres real que dos reservas simultáneas del mismo hueco y
 * profesional no pueden confirmarse las dos.
 * Requiere la infraestructura levantada; se ejecuta con `npm run test:int`.
 */
describe("Integración: no se puede reservar dos veces el mismo hueco", () => {
  let dataSource: DataSource;
  let citas: AppointmentsService;

  const servicioDeUnaHora = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Corte",
      price: 50000,
      duration: 60,
    },
  ];

  const reservar = (clientId: string) =>
    citas.create(NEGOCIO, {
      professionalId: PROFESIONAL,
      clientId,
      serviceIds: servicioDeUnaHora,
      date: FECHA,
      startTime: HORA,
    });

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

    // El outbox se sustituye: aquí se comprueba la exclusión mutua de las citas,
    // no la publicación de eventos, que ya tiene su propio test.
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    citas = new AppointmentsService(
      dataSource.getRepository(Appointment),
      dataSource.getRepository(Availability),
      dataSource.getRepository(BlockedSlot),
      dataSource,
      outbox as unknown as OutboxService
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "appointment_services", "appointments", "availabilities", "blocked_slots" CASCADE'
    );
    // El profesional atiende todos los días de 09:00 a 18:00.
    //
    // `create` es necesario: el id lo asigna el @BeforeInsert de BaseEntity, que
    // sólo se ejecuta sobre instancias de la entidad.
    const disponibilidades = dataSource.getRepository(Availability);
    await disponibilidades.save(
      Array.from({ length: 7 }, (_, dia) =>
        disponibilidades.create({
          businessId: NEGOCIO,
          professionalId: PROFESIONAL,
          dayOfWeek: dia,
          startTime: "09:00",
          endTime: "18:00",
        })
      )
    );
  });

  it("acepta una reserva en un hueco libre", async () => {
    const cita = await reservar(CLIENTE_A);

    expect(cita.startTime).toBe(HORA);
    expect(cita.clientId).toBe(CLIENTE_A);
  });

  it("rechaza una segunda reserva secuencial en el mismo hueco", async () => {
    await reservar(CLIENTE_A);

    await expect(reservar(CLIENTE_B)).rejects.toThrow();

    const total = await dataSource.getRepository(Appointment).count();
    expect(total).toBe(1);
  });

  // El caso que de verdad importa: sin la transacción SERIALIZABLE, las dos
  // comprobaciones de conflicto leen "libre" antes de que ninguna haya escrito
  // y ambas insertan.
  it("con dos reservas simultáneas del mismo hueco, solo una prospera", async () => {
    const resultados = await Promise.allSettled([
      reservar(CLIENTE_A),
      reservar(CLIENTE_B),
    ]);

    const aceptadas = resultados.filter((r) => r.status === "fulfilled");
    const rechazadas = resultados.filter((r) => r.status === "rejected");

    expect(aceptadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);

    const total = await dataSource.getRepository(Appointment).count();
    expect(total).toBe(1);
  });

  it("permite reservas simultáneas en huecos que no se solapan", async () => {
    const resultados = await Promise.allSettled([
      reservar(CLIENTE_A),
      citas.create(NEGOCIO, {
        professionalId: PROFESIONAL,
        clientId: CLIENTE_B,
        serviceIds: servicioDeUnaHora,
        date: FECHA,
        startTime: "12:00",
      }),
    ]);

    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await dataSource.getRepository(Appointment).count()).toBe(2);
  });

  it("rechaza una reserva que se solapa parcialmente con otra", async () => {
    await reservar(CLIENTE_A); // 10:00–11:00

    await expect(
      citas.create(NEGOCIO, {
        professionalId: PROFESIONAL,
        clientId: CLIENTE_B,
        serviceIds: servicioDeUnaHora,
        date: FECHA,
        startTime: "10:30",
      })
    ).rejects.toThrow();

    expect(await dataSource.getRepository(Appointment).count()).toBe(1);
  });
});
