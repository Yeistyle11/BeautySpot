import { DataSource } from "typeorm";
import { join } from "path";
import {
  InternalHttpClient,
  OutboxService,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { createMigrationDataSourceOptions } from "@beautyspot/database";
import { HorarioDelNegocioService } from "../modules/appointments/horario-del-negocio.service";
import { PoliticaDeReservaService } from "../modules/appointments/politica-de-reserva.service";
import { entities } from "../orm-entities";
import { AppointmentsService } from "../modules/appointments/appointments.service";
import { AvailabilityQueryService } from "../modules/appointments/availability-query.service";
import { ahoraEnElNegocio } from "../common/hora-del-negocio";
import { Appointment } from "../entities/appointment.entity";
import { AppointmentServiceEntity } from "../entities/appointment-service.entity";
import { Availability } from "../entities/availability.entity";
import { BlockedSlot } from "../entities/blocked-slot.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PROFESIONAL = "22222222-2222-4222-8222-222222222222";
const CLIENTE = "33333333-3333-4333-8333-333333333333";
const SERVICIO = "55555555-5555-4555-8555-555555555555";

/** Fecha futura derivada del mismo reloj que valida el servicio. */
const NOCHE = (() => {
  const dia = new Date(`${ahoraEnElNegocio().fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 30);
  return dia.toISOString().split("T")[0];
})();

/** El día siguiente, que es donde cae lo que la cita de la noche invade. */
const MADRUGADA = (() => {
  const dia = new Date(`${NOCHE}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().split("T")[0];
})();

/**
 * Comprueba contra Postgres real que una cita que termina pasada la medianoche
 * ocupa la madrugada del día siguiente.
 *
 * La ocupación se consulta por fecha, así que sin traer ese sobrante la agenda
 * del día siguiente daría la franja por libre y la vendería otra vez.
 *
 * La cita de anoche se escribe directamente en la tabla en los casos que solo
 * miran la ocupación: así el escenario queda montado sin depender de la jornada
 * del profesional, que es lo que prueban aparte los casos del cierre de
 * madrugada.
 */
describe("Integración: la cita de anoche ocupa la madrugada", () => {
  let dataSource: DataSource;
  let citas: AppointmentsService;
  let disponibilidad: AvailabilityQueryService;

  /**
   * Escribe una cita de la noche anterior con su línea de servicio, saltándose
   * la reserva. Es la única forma de montar el estado que se quiere probar.
   */
  const citaDeAnoche = async (startTime: string, endTime: string) => {
    const cita = await dataSource.getRepository(Appointment).save(
      dataSource.getRepository(Appointment).create({
        businessId: NEGOCIO,
        professionalId: PROFESIONAL,
        clientId: CLIENTE,
        date: NOCHE,
        startTime,
        endTime,
        totalAmount: 50000,
      })
    );
    await dataSource.getRepository(AppointmentServiceEntity).save(
      dataSource.getRepository(AppointmentServiceEntity).create({
        appointmentId: cita.id,
        serviceId: SERVICIO,
        serviceName: "Corte",
        price: 50000,
        duration: 60,
        orden: 0,
      })
    );
    return cita;
  };

  /** Servicio de una hora, tal y como lo resuelve el catálogo del core. */
  const catalogo = [
    {
      id: SERVICIO,
      name: "Corte",
      price: 50000,
      duration: 60,
      procesadoDesde: null,
      procesadoMinutos: null,
      bufferDespues: 0,
    },
  ];

  const reservar = (date: string, startTime: string) =>
    citas.create(NEGOCIO, {
      professionalId: PROFESIONAL,
      clientId: CLIENTE,
      serviceIds: [SERVICIO],
      date,
      startTime,
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

    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const http = {
      pedir: jest.fn(),
      enviar: jest
        .fn()
        .mockImplementation(async (_servicio: string, ruta: string) =>
          ruta === "/internal/services/resolve" ? catalogo : { id: CLIENTE }
        ),
    };
    const zonas = {
      de: jest.fn().mockResolvedValue("America/Bogota"),
    } as unknown as ZonaDelNegocioService;
    // Sin horario de apertura: aquí se comprueba el cruce de días, no los
    // límites de la jornada.
    const horarioDelNegocio = {
      tramosDelDia: jest.fn().mockResolvedValue(null),
    } as unknown as HorarioDelNegocioService;

    disponibilidad = new AvailabilityQueryService(
      dataSource.getRepository(Appointment),
      dataSource.getRepository(Availability),
      dataSource.getRepository(BlockedSlot),
      dataSource.getRepository(AppointmentServiceEntity),
      zonas,
      horarioDelNegocio
    );

    citas = new AppointmentsService(
      dataSource.getRepository(Appointment),
      dataSource,
      outbox as unknown as OutboxService,
      http as unknown as InternalHttpClient,
      disponibilidad,
      zonas,
      {
        horasMinimasDeCancelacion: jest.fn().mockResolvedValue(2),
      } as unknown as PoliticaDeReservaService
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  /**
   * Deja al profesional trabajando los siete días entre esas dos horas.
   *
   * La salida se guarda como la marca el reloj, así que una anterior a la
   * entrada es la del día siguiente: `20:00`–`01:00` es el turno de noche.
   */
  const jornada = async (startTime: string, endTime: string) => {
    const disponibilidades = dataSource.getRepository(Availability);
    await disponibilidades.delete({ businessId: NEGOCIO });
    await disponibilidades.save(
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) =>
        disponibilidades.create({
          businessId: NEGOCIO,
          professionalId: PROFESIONAL,
          dayOfWeek,
          startTime,
          endTime,
          active: true,
        })
      )
    );
  };

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "appointment_services", "appointments" CASCADE'
    );
    // Jornada que acaba dentro del día: la restricción que se prueba en la
    // mayoría de los casos es la ocupación, no el horario.
    await jornada("00:00", "23:59");
  });

  it("no admite una cita que se salga de la jornada por la medianoche", async () => {
    await expect(reservar(NOCHE, "23:30")).rejects.toThrow(
      /no esta disponible/i
    );
  });

  it("admite esa misma cita si la jornada llega hasta la madrugada", async () => {
    // Turno de noche que sale a la 1: la cita de 23:30 a 00:30 cabe entera.
    await jornada("20:00", "01:00");

    await expect(reservar(NOCHE, "23:30")).resolves.toBeDefined();
  });

  it("la cita reservada de noche ocupa la madrugada siguiente", async () => {
    await jornada("20:00", "01:00");
    await reservar(NOCHE, "23:30");

    // La madrugada del día siguiente la cubre el arrastre de la jornada, así
    // que la franja existe; lo que la ocupa es la cita de anoche.
    await expect(reservar(MADRUGADA, "00:00")).rejects.toThrow(
      /ya existe una cita/i
    );
  });

  it("rechaza la cita de la madrugada que pisa a la de anoche", async () => {
    await citaDeAnoche("23:30", "00:30");

    await expect(reservar(MADRUGADA, "00:00")).rejects.toThrow(
      /ya existe una cita/i
    );
  });

  it("deja reservar la madrugada en cuanto la de anoche ha terminado", async () => {
    await citaDeAnoche("23:30", "00:30");

    await expect(reservar(MADRUGADA, "00:30")).resolves.toBeDefined();
  });

  it("no estorba si la de anoche acaba antes de medianoche", async () => {
    await citaDeAnoche("22:00", "23:00");

    await expect(reservar(MADRUGADA, "00:00")).resolves.toBeDefined();
  });

  it("las franjas de la madrugada aparecen ocupadas", async () => {
    await citaDeAnoche("23:30", "00:30");

    const franjas = await disponibilidad.franjasDeProfesional(
      NEGOCIO,
      PROFESIONAL,
      MADRUGADA,
      30
    );

    expect(franjas.find((f) => f.startTime === "00:00")?.available).toBe(false);
    expect(franjas.find((f) => f.startTime === "01:00")?.available).toBe(true);
  });
});
