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
import { PublicBookingService } from "../modules/public-booking/public-booking.service";
import { ahoraEnElNegocio } from "../common/hora-del-negocio";
import { Appointment } from "../entities/appointment.entity";
import { AppointmentServiceEntity } from "../entities/appointment-service.entity";
import { Availability } from "../entities/availability.entity";
import { BlockedSlot } from "../entities/blocked-slot.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PROFESIONAL = "22222222-2222-4222-8222-222222222222";
const FICHA = "33333333-3333-4333-8333-333333333333";
const USUARIO = "66666666-6666-4666-8666-666666666666";
const SERVICIO = "55555555-5555-4555-8555-555555555555";

/** Fecha futura derivada del mismo reloj que valida el servicio. */
const FECHA = (() => {
  const dia = new Date(`${ahoraEnElNegocio().fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 30);
  return dia.toISOString().split("T")[0];
})();

/**
 * Comprueba contra Postgres real que la reserva del escaparate hecha con sesión
 * queda ligada al usuario y aparece en *Mis Citas*, que es lo que habilita
 * cancelar, reagendar y reseñar (`npm run test:int`).
 */
describe("Integración: la reserva con sesión aparece en el panel del cliente", () => {
  let dataSource: DataSource;
  let citas: AppointmentsService;
  let reserva: PublicBookingService;
  /** Fichas del core por usuario, como las devuelve `/internal/clients`. */
  let fichasPorUsuario: Record<string, string[]>;
  let vinculado: string | undefined;

  const catalogo = [
    {
      id: SERVICIO,
      name: "Barba",
      price: 20000,
      duration: 30,
      procesadoDesde: null,
      procesadoMinutos: null,
      bufferDespues: 0,
    },
  ];

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

    // El core se simula, pero conservando su regla: `find-or-create` vincula la
    // ficha al usuario que le manden, y `by-user` solo devuelve las vinculadas.
    const http = {
      pedir: jest
        .fn()
        .mockImplementation(async (_servicio: string, ruta: string) => {
          const match = ruta.match(/\/internal\/clients\/by-user\/([^?]+)/);
          if (match) {
            return (fichasPorUsuario[match[1]] ?? []).map((id) => ({ id }));
          }
          return null;
        }),
      enviar: jest
        .fn()
        .mockImplementation(
          async (
            _servicio: string,
            ruta: string,
            cuerpo?: { userId?: string }
          ) => {
            if (ruta === "/internal/services/resolve") return catalogo;
            if (cuerpo?.userId) {
              vinculado = cuerpo.userId;
              fichasPorUsuario[cuerpo.userId] = [FICHA];
            }
            return { id: FICHA };
          }
        ),
    };

    const zonas = {
      de: jest.fn().mockResolvedValue("America/Bogota"),
    } as unknown as ZonaDelNegocioService;
    const horarioDelNegocio = {
      tramosDelDia: jest.fn().mockResolvedValue(null),
    } as unknown as HorarioDelNegocioService;

    const disponibilidad = new AvailabilityQueryService(
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

    reserva = new PublicBookingService(
      dataSource.getRepository(Appointment),
      dataSource.getRepository(Availability),
      dataSource.getRepository(BlockedSlot),
      dataSource.getRepository(AppointmentServiceEntity),
      http as unknown as InternalHttpClient,
      citas
    );
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "appointment_services", "appointments", "availabilities", "blocked_slots" CASCADE'
    );
    fichasPorUsuario = {};
    vinculado = undefined;
    // Disponibilidad los siete días, para que la fecha elegida siempre valga.
    // `create` es necesario: el id lo asigna el @BeforeInsert de BaseEntity, que
    // sólo se ejecuta sobre instancias de la entidad.
    const disponibilidades = dataSource.getRepository(Availability);
    await disponibilidades.save(
      Array.from({ length: 7 }, (_, dia) =>
        disponibilidades.create({
          businessId: NEGOCIO,
          professionalId: PROFESIONAL,
          dayOfWeek: dia,
          startTime: "08:00",
          endTime: "23:00",
        })
      )
    );
  });

  const reservarConSesion = (hora: string) =>
    reserva.createPublicAppointment(
      {
        businessId: NEGOCIO,
        professionalId: PROFESIONAL,
        serviceIds: [SERVICIO],
        date: FECHA,
        startTime: hora,
        guestName: "Camila Cliente",
        guestEmail: "cliente@beautyspot.local",
      },
      USUARIO
    );

  const paginacion = {
    page: 1,
    limit: 20,
    offset: 0,
    sort: "date",
    order: "DESC" as const,
  };

  it("liga la ficha a la cuenta de quien reserva", async () => {
    await reservarConSesion("20:00");

    expect(vinculado).toBe(USUARIO);
  });

  it("la cita reservada con sesión sale en Mis Citas", async () => {
    const creada = await reservarConSesion("20:00");

    const mias = await citas.findByClientUser(USUARIO, paginacion);

    expect(mias.meta.total).toBe(1);
    expect(mias.data[0].id).toBe(creada.id);
  });

  it("la reserva de invitado no queda ligada a ninguna cuenta", async () => {
    await reserva.createPublicAppointment({
      businessId: NEGOCIO,
      professionalId: PROFESIONAL,
      serviceIds: [SERVICIO],
      date: FECHA,
      startTime: "21:00",
      guestName: "Invitada",
      guestEmail: "invitada@example.com",
    });

    expect(vinculado).toBeUndefined();
    await expect(
      citas.findByClientUser(USUARIO, paginacion)
    ).resolves.toMatchObject({ meta: { total: 0 } });
  });
});
