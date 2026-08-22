import { Test, TestingModule } from "@nestjs/testing";
import {
  InternalHttpClient,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { DataSource } from "typeorm";
import { ServiceUnavailableException } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { AppointmentStatus, CancelReason } from "@beautyspot/shared-types";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

/** Las fechas del fixture se calculan al vuelo: agendar exige futuro. */
function dentroDeDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const SERVICIO_CORTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FECHA_CITA = dentroDeDias(30);
const FECHA_SIGUIENTE = dentroDeDias(31);
const DIA_DE_LA_SEMANA = new Date(FECHA_CITA + "T12:00:00").getDay();

/**
 * Fecha y hora de una cita inminente, armada con los componentes locales que
 * el servicio interpreta.
 */
function dentroDeMinutos(minutos: number): { date: string; startTime: string } {
  const d = new Date(Date.now() + minutos * 60 * 1000);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    startTime: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

describe("AppointmentsService", () => {
  let service: AppointmentsService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockApptServiceRepo: jest.Mocked<Repository<AppointmentServiceEntity>>;
  let mockDataSource: jest.Mocked<DataSource>;
  /** Manager que recibió el último callback de `transaction`. */
  let mockManager: { update: jest.Mock; [clave: string]: unknown };
  let mockOutbox: any;
  let mockHttp: { pedir: jest.Mock; enviar: jest.Mock };
  let mockZonas: ZonaDelNegocioService;
  let mockHorarioDelNegocio: HorarioDelNegocioService;
  let mockPolitica: { horasMinimasDeCancelacion: jest.Mock };

  /** Lo que el catálogo del core-service devuelve para el servicio del fixture. */
  const CORTE = {
    id: SERVICIO_CORTE,
    name: "Corte",
    price: 30000,
    duration: 30,
  };

  const mockAppointment: Appointment = {
    id: "appt-123",
    businessId: "business-123",
    branchId: "branch-123",
    clientId: "client-123",
    professionalId: "prof-123",
    date: FECHA_CITA,
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: 50000,
    status: AppointmentStatus.PENDING,
    pointsEarned: 0,
    notes: "",
    cancelReason: "",
    cancelReasonType: null,
    cancelledBy: null,
    cancelledAt: null,
    reminder24hSentAt: null,
    reminder1hSentAt: null,
    startedAt: null,
    completedAt: null,
    ocupadoHasta: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // La duracion sale de aqui al reagendar: 60 minutos, de 10:00 a 11:00.
    appointmentServices: [{ duration: 60 } as never],
    generateId: () => {},
  };

  const mockAvailability: Availability = {
    id: "avail-123",
    businessId: "business-123",
    professionalId: "prof-123",
    // El día de la cita del fixture: la agenda descarta los tramos de los demás.
    dayOfWeek: DIA_DE_LA_SEMANA,
    startTime: "09:00",
    endTime: "18:00",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  };

  /**
   * La misma jornada en los dos dias del fixture, incluido el siguiente, que
   * necesitan los tests de reagendado.
   */
  const JORNADAS: Availability[] = [
    mockAvailability,
    {
      ...mockAvailability,
      dayOfWeek: (DIA_DE_LA_SEMANA + 1) % 7,
      generateId: () => {},
    },
  ];

  beforeEach(async () => {
    mockApptRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    // Sin líneas cargadas, cada cita ocupa su bloque entero.
    mockApptServiceRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    mockAvailRepo = {
      findOne: jest.fn(),
      // Los horarios se leen con `find`: un día puede tener varios tramos.
      find: jest.fn().mockResolvedValue([]),
    } as any;

    mockBlockRepo = {
      find: jest.fn(),
    } as any;

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (isolationOrCallback: any, maybeCallback?: any) => {
            // Soporta both signatures: transaction(cb) y transaction(isolationLevel, cb)
            const callback =
              typeof isolationOrCallback === "function"
                ? isolationOrCallback
                : maybeCallback;
            // Se guarda fuera para poder comprobar lo que se escribió dentro
            // de la transacción.
            mockManager = {
              create: jest.fn((_, data) => ({
                id: "test-id",
                ...data,
                generateId: () => {},
              })),
              // TypeORM devuelve la fila guardada, con todo lo que se le paso:
              // el evento de la cita se arma con ella.
              save: jest.fn(async (_entidad: unknown, datos: any) =>
                Array.isArray(datos)
                  ? datos
                  : { id: "test-id", ...datos, generateId: () => {} }
              ),
              findOne: jest.fn().mockResolvedValue({
                id: "test-id",
                appointmentServices: [],
                generateId: () => {},
              }),
              find: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
              getRepository: () => ({ find: jest.fn().mockResolvedValue([]) }),
            };
            return await callback(mockManager);
          }
        ),
    } as any;

    mockOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    mockHttp = {
      pedir: jest.fn().mockResolvedValue([]),
      enviar: jest.fn().mockResolvedValue([CORTE]),
    };

    // El negocio del fixture vive en Bogota y sin horario de apertura: la
    // agenda solo la limita el horario del profesional.
    mockZonas = {
      de: jest.fn().mockResolvedValue("America/Bogota"),
    } as never;
    mockHorarioDelNegocio = {
      tramosDelDia: jest.fn().mockResolvedValue(null),
    } as never;
    mockPolitica = {
      horasMinimasDeCancelacion: jest.fn().mockResolvedValue(2),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockApptRepo,
        },
        {
          // Motor real sobre los repositorios simulados: se comprueba el
          // horario, los bloqueos y los conflictos de extremo a extremo.
          provide: AvailabilityQueryService,
          useFactory: () =>
            new AvailabilityQueryService(
              mockApptRepo,
              mockAvailRepo,
              mockBlockRepo,
              mockApptServiceRepo,
              mockZonas,
              mockHorarioDelNegocio
            ),
        },
        { provide: ZonaDelNegocioService, useValue: mockZonas },
        { provide: PoliticaDeReservaService, useValue: mockPolitica },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: OutboxService,
          useValue: mockOutbox,
        },
        {
          provide: InternalHttpClient,
          useValue: mockHttp,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("create", () => {
    it("debería crear una cita exitosamente", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
        notes: "Cliente VIP",
      };

      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      // Se piden los tramos del día y los del anterior, cuya madrugada puede
      // invadirlo cuando el negocio cierra pasada la medianoche.
      expect(mockAvailRepo.find).toHaveBeenCalledWith({
        where: [
          {
            businessId: "business-123",
            professionalId: In(["prof-123"]),
            dayOfWeek: DIA_DE_LA_SEMANA,
            active: true,
          },
          {
            businessId: "business-123",
            professionalId: In(["prof-123"]),
            dayOfWeek: (DIA_DE_LA_SEMANA + 6) % 7,
            active: true,
          },
        ],
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockOutbox.enqueue).toHaveBeenCalled();
    });

    it("deja anidar una cita en el hueco de procesado de otra", async () => {
      // El pre-check de UX, fuera de la transacción, ya reparte por intervalos.
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          id: "appt-tinte",
          professionalId: "prof-123",
          startTime: "10:00",
          endTime: "11:30",
        },
      ] as never);
      mockApptServiceRepo.find.mockResolvedValue([
        {
          appointmentId: "appt-tinte",
          duration: 90,
          orden: 0,
          procesadoDesde: 20,
          procesadoMinutos: 40,
          bufferDespues: 0,
        },
      ] as never);

      await expect(
        service.create("business-123", {
          professionalId: "prof-123",
          clientId: "client-123",
          serviceIds: [SERVICIO_CORTE],
          date: FECHA_CITA,
          startTime: "10:20",
        })
      ).resolves.toBeDefined();
    });

    it("rechaza la cita que pisa la limpieza de otra", async () => {
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          id: "appt-previa",
          professionalId: "prof-123",
          startTime: "09:00",
          endTime: "10:00",
        },
      ] as never);
      mockApptServiceRepo.find.mockResolvedValue([
        {
          appointmentId: "appt-previa",
          duration: 60,
          orden: 0,
          procesadoDesde: null,
          procesadoMinutos: null,
          bufferDespues: 15,
        },
      ] as never);

      // La clienta anterior se fue a las 10:00, pero hasta las 10:15 se limpia.
      await expect(
        service.create("business-123", {
          professionalId: "prof-123",
          clientId: "client-123",
          serviceIds: [SERVICIO_CORTE],
          date: FECHA_CITA,
          startTime: "10:00",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("guarda hasta cuándo sigue ocupado el profesional", async () => {
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);
      mockHttp.enviar.mockResolvedValue([
        {
          ...CORTE,
          bufferDespues: 15,
          procesadoDesde: null,
          procesadoMinutos: null,
        },
      ]);

      await service.create("business-123", {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        Appointment,
        expect.objectContaining({ endTime: "10:30", ocupadoHasta: "10:45" })
      );
    });

    it("debería lanzar BadRequestException si el horario no está disponible", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue([]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería rechazar una fecha pasada antes de consultar disponibilidad", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: dentroDeDias(-1),
        startTime: "10:00",
      };

      await expect(service.create("business-123", data)).rejects.toThrow(
        "No se puede agendar una cita en el pasado"
      );
      expect(mockAvailRepo.find).not.toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si el slot está fuera del horario de trabajo", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "17:30", // Terminaría a las 19:30, fuera del horario 09:00-18:00
      };

      mockHttp.enviar.mockResolvedValue([{ ...CORTE, duration: 120 }]);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockApptRepo.find.mockResolvedValue([]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar BadRequestException si hay conflicto con otra cita", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });

    it("calcula la duración y el importe con el catálogo, no con lo que llegue del cliente", async () => {
      const BARBA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE, BARBA],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockHttp.enviar.mockResolvedValue([
        CORTE,
        { id: BARBA, name: "Barba", price: 20000, duration: 15 },
      ]);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/services/resolve",
        {
          businessId: "business-123",
          ids: [SERVICIO_CORTE, BARBA],
          professionalId: "prof-123",
        }
      );
      // 30000 + 20000, y 45 minutos desde las 10:00.
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({
            totalAmount: 50000,
            endTime: "10:45",
          }),
        })
      );
    });

    describe("servicios encadenados con distintos profesionales", () => {
      const BARBA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const LA_BARBA = { id: BARBA, name: "Barba", price: 20000, duration: 30 };

      const conAsignacion = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE, BARBA],
        date: FECHA_CITA,
        startTime: "10:00",
        asignaciones: [{ serviceId: BARBA, professionalId: "prof-999" }],
      };

      beforeEach(() => {
        mockAvailRepo.find.mockResolvedValue([
          mockAvailability,
          { ...mockAvailability, professionalId: "prof-999" } as Availability,
        ]);
        mockBlockRepo.find.mockResolvedValue([]);
        mockApptRepo.find.mockResolvedValue([]);
        mockHttp.enviar.mockImplementation(
          (_servicio: string, _ruta: string, cuerpo: { ids: string[] }) =>
            Promise.resolve(
              cuerpo.ids.map((id) => (id === BARBA ? LA_BARBA : CORTE))
            )
        );
      });

      it("resuelve cada servicio con la tarifa de quien lo atiende", async () => {
        await service.create("business-123", conAsignacion);

        expect(mockHttp.enviar).toHaveBeenCalledWith(
          "core",
          "/internal/services/resolve",
          {
            businessId: "business-123",
            ids: [SERVICIO_CORTE],
            professionalId: "prof-123",
          }
        );
        expect(mockHttp.enviar).toHaveBeenCalledWith(
          "core",
          "/internal/services/resolve",
          {
            businessId: "business-123",
            ids: [BARBA],
            professionalId: "prof-999",
          }
        );
      });

      it("guarda en la línea el profesional que no es el titular", async () => {
        await service.create("business-123", conAsignacion);

        const crear = mockManager.create as jest.Mock;
        const lineas = crear.mock.calls
          .filter(([entidad]) => entidad === AppointmentServiceEntity)
          .map(([, datos]) => datos);

        expect(lineas).toEqual([
          expect.objectContaining({
            serviceId: SERVICIO_CORTE,
            professionalId: null,
          }),
          expect.objectContaining({
            serviceId: BARBA,
            professionalId: "prof-999",
          }),
        ]);
      });

      it("comprueba el horario de los dos profesionales", async () => {
        await service.create("business-123", conAsignacion);

        expect(mockAvailRepo.find).toHaveBeenCalledWith({
          where: [
            {
              businessId: "business-123",
              professionalId: In(["prof-123", "prof-999"]),
              dayOfWeek: DIA_DE_LA_SEMANA,
              active: true,
            },
            {
              businessId: "business-123",
              professionalId: In(["prof-123", "prof-999"]),
              dayOfWeek: (DIA_DE_LA_SEMANA + 6) % 7,
              active: true,
            },
          ],
        });
      });

      it("rechaza la cita si el segundo profesional está ocupado", async () => {
        // El titular tiene libre las 10:00; el otro atiende ya a las 10:30.
        mockApptRepo.find.mockResolvedValue([
          {
            id: "appt-otra",
            professionalId: "prof-999",
            startTime: "10:30",
            endTime: "11:00",
          },
        ] as never);

        await expect(
          service.create("business-123", conAsignacion)
        ).rejects.toThrow(BadRequestException);
      });

      it("rechaza asignar un profesional a un servicio que no está en la cita", async () => {
        await expect(
          service.create("business-123", {
            ...conAsignacion,
            asignaciones: [
              {
                serviceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                professionalId: "prof-999",
              },
            ],
          })
        ).rejects.toThrow(BadRequestException);
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });
    });

    describe("sede de la cita", () => {
      const enSede = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
        branchId: "branch-123",
      };

      beforeEach(() => {
        mockAvailRepo.find.mockResolvedValue(JORNADAS);
        mockBlockRepo.find.mockResolvedValue([]);
        mockApptRepo.find.mockResolvedValue([]);
      });

      it("acepta una sede del negocio", async () => {
        mockHttp.pedir.mockResolvedValue([{ id: "branch-123" }]);

        await service.create("business-123", enSede);

        expect(mockHttp.pedir).toHaveBeenCalledWith(
          "core",
          "/internal/branches?businessId=business-123"
        );
        expect(mockDataSource.transaction).toHaveBeenCalled();
      });

      it("la sede viaja en el evento de la cita", async () => {
        mockHttp.pedir.mockResolvedValue([{ id: "branch-123" }]);

        await service.create("business-123", enSede);

        expect(mockOutbox.enqueue).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            payload: expect.objectContaining({ branchId: "branch-123" }),
          })
        );
      });

      it("rechaza una sede que no es del negocio", async () => {
        mockHttp.pedir.mockResolvedValue([{ id: "branch-de-otro" }]);

        await expect(service.create("business-123", enSede)).rejects.toThrow(
          BadRequestException
        );
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });

      it("sin sede no consulta el catálogo de sedes", async () => {
        await service.create("business-123", {
          ...enSede,
          branchId: undefined,
        });

        expect(mockHttp.pedir).not.toHaveBeenCalledWith(
          "core",
          expect.stringContaining("/internal/branches")
        );
      });
    });

    it("no crea la cita si el catálogo no responde", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockHttp.enviar.mockResolvedValue(null);

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("debería usar transacción SERIALIZABLE para prevenir doble-booking", async () => {
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.create("business-123", data);

      // El primer argumento de transaction debe ser el nivel de aislamiento
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        "SERIALIZABLE",
        expect.any(Function)
      );
    });

    it("debería detectar conflicto dentro de la tx (race condition)", async () => {
      // Simula doble-booking: el pre-check pasa (sin conflicto) pero dentro
      // de la tx SERIALIZABLE aparece una cita conflictiva (otra tx insertó).
      const data = {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [SERVICIO_CORTE],
        date: FECHA_CITA,
        startTime: "10:00",
      };

      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      // Pre-check fuera de la tx: sin conflicto
      mockApptRepo.find.mockResolvedValue([]);

      // Re-check dentro de la tx: aparece cita conflictiva (race)
      const conflictingAppt = {
        ...mockAppointment,
        id: "race-appt",
        startTime: "10:00",
        endTime: "10:30",
        generateId: () => {},
      } as any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          const manager = {
            create: jest.fn((_, d) => ({ id: "test-id", ...d })),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([conflictingAppt]),
            update: jest.fn(),
            getRepository: () => ({ find: jest.fn().mockResolvedValue([]) }),
          };
          return await cb(manager);
        }
      );

      await expect(service.create("business-123", data)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("confirm", () => {
    it("debería confirmar una cita pendiente", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.confirm("appt-123", "business-123");

      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
        relations: { appointmentServices: true },
      });
      // El cambio de estado y el evento van en la misma transacción.
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
        })
      );
    });

    // El nombre del servicio solo le llega a notification por el evento: no
    // tiene acceso a la base de booking.
    it("lleva en el evento los servicios de la cita", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        appointmentServices: [
          {
            serviceId: "serv-1",
            serviceName: "Corte",
            price: "30000",
            duration: 60,
          },
        ],
      } as never);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.confirm("appt-123", "business-123");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payload: expect.objectContaining({
            services: [
              {
                serviceId: "serv-1",
                name: "Corte",
                price: 30000,
                duration: 60,
              },
            ],
          }),
        })
      );
    });

    it("debería lanzar BadRequestException si la cita no está pendiente", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);

      await expect(service.confirm("appt-123", "business-123")).rejects.toThrow(
        BadRequestException
      );
    });

    it("debería lanzar NotFoundException si la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.confirm("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("startService", () => {
    it("debería iniciar una cita confirmada", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.startService("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        { id: "appt-123", businessId: "business-123" },
        {
          status: AppointmentStatus.IN_PROGRESS,
          startedAt: expect.any(Date),
        }
      );
    });

    it("no pisa la hora real de inicio al reiniciar una cita", async () => {
      const empezada = new Date("2026-01-01T10:03:00Z");
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
        startedAt: empezada,
        generateId: () => {},
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.startService("appt-123", "business-123");

      expect(mockApptRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ startedAt: empezada })
      );
    });

    it("debería lanzar BadRequestException si la cita no está confirmada", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      await expect(
        service.startService("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("complete", () => {
    it("debería completar una cita y otorgar puntos (10% del monto)", async () => {
      const confirmedAppt = {
        ...mockAppointment,
        // Ya empezada: el servicio rechaza completar lo que aún no ha
        // sucedido.
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(confirmedAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      // El cambio de estado y el evento se encolan en la misma transacción;
      // el enqueue del outbox captura la intención (con los puntos calculados).
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_COMPLETED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
          payload: expect.objectContaining({ pointsEarned: 5000 }),
        })
      );
    });

    it("guarda la hora real de fin", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        expect.objectContaining({ completedAt: expect.any(Date) })
      );
    });

    it("debería lanzar BadRequestException si la cita no está en estado válido", async () => {
      const cancelledAppt = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(cancelledAppt);

      await expect(
        service.complete("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería permitir completar una cita en progreso", async () => {
      const inProgressAppt = {
        ...mockAppointment,
        ...dentroDeMinutos(-30),
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(inProgressAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete("appt-123", "business-123");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_COMPLETED,
        })
      );
    });

    // Completar arrastra el cobro: una cita futura daría un ingreso real por
    // un servicio que no se ha prestado.
    it("rechaza completar una cita que aún no ha empezado", async () => {
      const futureAppt = {
        ...mockAppointment,
        ...dentroDeMinutos(120),
        status: AppointmentStatus.CONFIRMED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(futureAppt);

      await expect(
        service.complete("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
      expect(mockOutbox.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("debería cancelar una cita con política de 2 horas", async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 3);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const futureAppt: any = {
        ...mockAppointment,
        date: futureDateStr,
        // Con ceros a la izquierda: "6:00" no es una hora de pared válida.
        startTime: `${String(futureDate.getHours()).padStart(2, "0")}:00`,
        generateId: () => {},
      };

      mockApptRepo.findOne.mockResolvedValue(futureAppt);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancel("appt-123", "business-123", {
        tipo: CancelReason.NEGOCIO_CANCELA,
        nota: "Cambio de planes",
      });

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_CANCELLED,
          aggregateId: "appt-123",
          payload: expect.objectContaining({
            cancelReason: "Cambio de planes",
          }),
        })
      );
    });

    it("guarda el motivo tipificado, la nota y quién canceló", async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: futureDate.toISOString().split("T")[0],
        startTime: `${String(futureDate.getHours()).padStart(2, "0")}:00`,
        generateId: () => {},
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancel("appt-123", "business-123", {
        tipo: CancelReason.PROFESIONAL_NO_DISPONIBLE,
        nota: "Baja médica",
        canceladaPor: "user-9",
      });

      expect(mockManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        expect.objectContaining({
          cancelReasonType: CancelReason.PROFESIONAL_NO_DISPONIBLE,
          cancelReason: "Baja médica",
          cancelledBy: "user-9",
          cancelledAt: expect.any(Date),
        })
      );
    });

    it("el camino del cliente fija su propio motivo", async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const cita = {
        ...mockAppointment,
        date: futureDate.toISOString().split("T")[0],
        startTime: `${String(futureDate.getHours()).padStart(2, "0")}:00`,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(cita);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockHttp.pedir.mockResolvedValue([{ id: "client-123" }]);

      await service.cancelForClientUser("appt-123", "user-cliente");

      expect(mockManager.update).toHaveBeenCalledWith(
        Appointment,
        expect.anything(),
        expect.objectContaining({
          cancelReasonType: CancelReason.CLIENTE_CANCELA,
          cancelledBy: "user-cliente",
        })
      );
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", async () => {
      const inminente = dentroDeMinutos(60);
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...inminente,
      } as any);

      await expect(
        service.cancel(
          "appt-123",
          "business-123",
          {
            tipo: CancelReason.NEGOCIO_CANCELA,
            nota: "Cambio de planes",
          },
          {
            esCliente: true,
          }
        )
      ).rejects.toThrow(ForbiddenException);
    });

    // Si el profesional se enferma, el salón tiene que poder vaciar la agenda
    // de las próximas dos horas.
    it("el negocio puede cancelar una cita inminente", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(60),
      } as any);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.cancel("appt-123", "business-123", {
          tipo: CancelReason.NEGOCIO_CANCELA,
          nota: "Profesional enfermo",
        })
      ).resolves.toBeDefined();
    });

    it("respeta el umbral que configure el negocio", async () => {
      mockPolitica.horasMinimasDeCancelacion.mockResolvedValue(24);
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        ...dentroDeMinutos(60 * 5),
      } as any);

      await expect(
        service.cancel(
          "appt-123",
          "business-123",
          {
            tipo: CancelReason.NEGOCIO_CANCELA,
            nota: "Cambio de planes",
          },
          {
            esCliente: true,
          }
        )
      ).rejects.toThrow(/24 horas/);
    });

    it("debería lanzar BadRequestException si la cita ya está completada", async () => {
      const completedAppt = {
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(completedAppt);

      await expect(
        service.cancel("appt-123", "business-123", {
          tipo: CancelReason.NEGOCIO_CANCELA,
          nota: "Cambio de planes",
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("markNoShow", () => {
    it("debería marcar una cita como no asistida", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockApptRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.markNoShow("appt-123", "business-123");

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_NO_SHOWED,
          aggregateType: "appointment",
          aggregateId: "appt-123",
        })
      );
    });

    it("debería lanzar BadRequestException si la cita está en progreso", async () => {
      const inProgressAppt = {
        ...mockAppointment,
        status: AppointmentStatus.IN_PROGRESS,
        generateId: () => {},
      } as any;
      mockApptRepo.findOne.mockResolvedValue(inProgressAppt);

      await expect(
        service.markNoShow("appt-123", "business-123")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("reschedule", () => {
    beforeEach(() => {
      jest
        .useFakeTimers()
        .setSystemTime(new Date("2024-01-15T08:00:00").getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });
    it("debería reagendar una cita correctamente dentro de tx SERIALIZABLE", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const futureAppt: any = {
        ...mockAppointment,
        date: futureDateStr,
        startTime: "14:00",
        generateId: () => {},
      };

      mockApptRepo.findOne.mockResolvedValue(futureAppt);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      // Capturar el manager para verificar el update dentro de la tx
      let capturedManager: any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          const manager = {
            create: jest.fn((_, d) => ({ id: "test-id", ...d })),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          capturedManager = manager;
          return await cb(manager);
        }
      );

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "15:00"
      );

      // Debe usar tx SERIALIZABLE (prevencion de doble-booking)
      expect(mockDataSource.transaction).toHaveBeenCalledWith(
        "SERIALIZABLE",
        expect.any(Function)
      );
      // El update ocurre dentro de la tx via el manager, con la duración real
      // de los servicios de la cita (60 min) y sin tocar el estado.
      expect(capturedManager.update).toHaveBeenCalledWith(
        Appointment,
        { id: "appt-123", businessId: "business-123" },
        {
          date: FECHA_SIGUIENTE,
          startTime: "15:00",
          endTime: "16:00",
          // Sin limpieza configurada coincide con el fin.
          ocupadoHasta: "16:00",
        }
      );
    });

    it("conserva la duración de los servicios en vez de asumir 30 minutos", async () => {
      const largo: any = {
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        startTime: "14:00",
        endTime: "15:30",
        appointmentServices: [{ duration: 60 }, { duration: 30 }],
      };

      mockApptRepo.findOne.mockResolvedValue(largo);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      let capturedManager: any;
      mockDataSource.transaction.mockImplementationOnce(
        async (isolationOrCb: any, maybeCb?: any) => {
          const cb =
            typeof isolationOrCb === "function" ? isolationOrCb : maybeCb;
          capturedManager = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          return await cb(capturedManager);
        }
      );

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "10:00"
      );

      expect(capturedManager.update).toHaveBeenCalledWith(
        Appointment,
        expect.anything(),
        expect.objectContaining({ endTime: "11:30" })
      );
    });

    it.each([
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.IN_PROGRESS,
    ])("no deja reagendar una cita en estado %s", async (status) => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        status,
      } as any);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it("emite el evento de reagendado con la fecha anterior", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        startTime: "14:00",
      } as any);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await service.reschedule(
        "appt-123",
        "business-123",
        FECHA_SIGUIENTE,
        "10:00"
      );

      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EventNames.BOOKING_APPOINTMENT_RESCHEDULED,
          payload: expect.objectContaining({
            startTime: "10:00",
            previousStartTime: "14:00",
          }),
        })
      );
    });

    it("rechaza una cita sin servicios, en vez de darle una duración inventada", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        date: FECHA_SIGUIENTE,
        appointmentServices: [],
      } as any);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar ForbiddenException con menos de 2 horas de anticipación", () => {
      jest.useFakeTimers();
      // La cita del fixture es a las 10:00; nos situamos 30 minutos antes.
      jest.setSystemTime(new Date(`${FECHA_CITA}T09:30:00`));

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      return expect(
        service.reschedule("appt-123", "business-123", FECHA_CITA, "15:00", {
          esCliente: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("el negocio puede reagendar una cita inminente", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(`${FECHA_CITA}T09:30:00`));

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_CITA, "15:00")
      ).resolves.toBeDefined();
    });

    it("debería lanzar BadRequestException si el nuevo horario no está disponible", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue([]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });

    it("debería lanzar BadRequestException si hay conflicto en el nuevo horario", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2); // 2 días en el futuro para pasar la política de 2 horas

      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockAvailRepo.find.mockResolvedValue(JORNADAS);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          ...mockAppointment,
          id: "other-appt",
          date: FECHA_SIGUIENTE,
          startTime: "14:30",
          endTime: "15:30",
          generateId: () => "other-id",
        } as any,
      ]);

      await expect(
        service.reschedule("appt-123", "business-123", FECHA_SIGUIENTE, "15:00")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("debería retornar la cita cuando existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);

      const result = await service.findById("appt-123", "business-123");

      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
        relations: { appointmentServices: true },
      });
      expect(result).toEqual(mockAppointment);
    });

    it("debería lanzar NotFoundException cuando la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByClientUser", () => {
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "date",
      order: "DESC" as const,
    };

    afterEach(() => {
      delete (global as { fetch?: unknown }).fetch;
    });

    /** Fichas que core devuelve para el usuario consultado. */
    function coreDevuelve(clients: { id: string }[]) {
      mockHttp.pedir.mockResolvedValue(clients);
    }

    it("busca las citas de todas las fichas del usuario", async () => {
      coreDevuelve([{ id: "cliente-a" }, { id: "cliente-b" }]);
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      const result = await service.findByClientUser("user-1", pagination);

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: In(["cliente-a", "cliente-b"]) },
        })
      );
      expect(result.data).toEqual([mockAppointment]);
    });

    it("nunca consulta sin filtro cuando el usuario no tiene fichas", async () => {
      coreDevuelve([]);

      const result = await service.findByClientUser(
        "user-sin-fichas",
        pagination
      );

      expect(mockApptRepo.findAndCount).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it("avisa si core no responde, en vez de devolver una lista vacía", async () => {
      mockHttp.pedir.mockRejectedValue(
        new ServiceUnavailableException("core-service no está disponible")
      );

      await expect(
        service.findByClientUser("user-1", pagination)
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("findByIdForClientUser", () => {
    it("devuelve la cita cuando es de una ficha del usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockHttp.pedir.mockResolvedValue([{ id: "client-123" }]);

      const result = await service.findByIdForClientUser("appt-123", "user-1");

      expect(result).toEqual(mockAppointment);
    });

    it("responde 404 si la cita es de otro cliente, sin revelar que existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(mockAppointment);
      mockHttp.pedir.mockResolvedValue([{ id: "otra-ficha" }]);

      await expect(
        service.findByIdForClientUser("appt-123", "user-2")
      ).rejects.toThrow(NotFoundException);
    });

    it("responde 404 si la cita no existe", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdForClientUser("no-existe", "user-1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("datosDeCobro", () => {
    it("devuelve el importe, el estado y el cliente de la cita", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        appointmentServices: [],
      } as never);

      await expect(
        service.datosDeCobro("appt-123", "business-123")
      ).resolves.toEqual({
        clientId: "client-123",
        totalAmount: 50000,
        status: AppointmentStatus.PENDING,
        services: [],
      });
    });

    // El recibo del cobro dice qué se pagó, y payment solo guarda el importe.
    it("devuelve los servicios de la cita", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...mockAppointment,
        appointmentServices: [
          {
            serviceId: "serv-1",
            serviceName: "Corte",
            price: "30000",
            duration: 30,
          },
        ],
      } as never);

      await expect(
        service.datosDeCobro("appt-123", "business-123")
      ).resolves.toMatchObject({
        services: [
          { serviceId: "serv-1", name: "Corte", price: 30000, duration: 30 },
        ],
      });
    });

    it("devuelve null para una cita de otro negocio", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.datosDeCobro("appt-123", "business-123")
      ).resolves.toBeNull();
      expect(mockApptRepo.findOne).toHaveBeenCalledWith({
        where: { id: "appt-123", businessId: "business-123" },
        relations: { appointmentServices: true },
      });
    });
  });

  describe("citaReseñablePor", () => {
    const completada: Appointment = {
      ...mockAppointment,
      clientId: "ficha-a",
      professionalId: "prof-123",
      status: AppointmentStatus.COMPLETED,
      appointmentServices: [{ serviceName: "Corte" } as never],
      generateId: () => {},
    };

    it("acepta una cita completada del propio usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-a" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toMatchObject({ resenable: true });
    });

    // El marketplace los usa para no fiarse del cuerpo de la resena.
    it("devuelve el profesional y los servicios atendidos", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-a" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({
        resenable: true,
        professionalId: "prof-123",
        servicios: ["Corte"],
      });
    });

    it("no filtra el profesional de una cita que no es del usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-de-otro" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita de otro usuario", async () => {
      mockApptRepo.findOne.mockResolvedValue(completada);
      mockHttp.pedir.mockResolvedValue([{ id: "ficha-de-otro" }]);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita que aún no se ha atendido", async () => {
      mockApptRepo.findOne.mockResolvedValue({
        ...completada,
        status: AppointmentStatus.CONFIRMED,
      } as Appointment);

      await expect(
        service.citaReseñablePor("appt-1", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
    });

    it("rechaza una cita inexistente o de otro negocio", async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.citaReseñablePor("inventada", "user-1", "business-123")
      ).resolves.toEqual({ resenable: false });
      // La búsqueda va acotada al negocio que dice la reseña.
      expect(mockApptRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inventada", businessId: "business-123" },
        })
      );
    });
  });

  describe("findByBusiness", () => {
    const pagination = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "date",
      order: "DESC" as const,
    };

    it("devuelve una página con data + meta (ordenada por fecha y hora)", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123" },
          relations: ["appointmentServices"],
          order: { date: "DESC", startTime: "ASC" },
          skip: 0,
          take: 20,
        })
      );
      expect(result.data).toEqual([mockAppointment]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("la agenda de una sede no trae las citas de otra", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      await service.findByBusiness(
        "business-123",
        { branchId: "branch-123" },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", branchId: "branch-123" },
        })
      );
    });

    it("calcula los metadatos de paginación en page 2 limit 10", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[], 15]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        { page: 2, limit: 10, offset: 10, sort: "date", order: "DESC" }
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(15);
      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(true);
    });

    it("debería filtrar por status con paginación", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      await service.findByBusiness(
        "business-123",
        { status: AppointmentStatus.CONFIRMED },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: "business-123",
            status: AppointmentStatus.CONFIRMED,
          },
        })
      );
    });

    it("debería filtrar por fecha con paginación", async () => {
      mockApptRepo.findAndCount.mockResolvedValue([[mockAppointment], 1]);

      await service.findByBusiness(
        "business-123",
        { date: FECHA_CITA },
        pagination
      );

      expect(mockApptRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", date: FECHA_CITA },
        })
      );
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(AppointmentsService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.create).toBe("function");
      expect(typeof service.confirm).toBe("function");
      expect(typeof service.startService).toBe("function");
      expect(typeof service.complete).toBe("function");
      expect(typeof service.cancel).toBe("function");
      expect(typeof service.markNoShow).toBe("function");
      expect(typeof service.reschedule).toBe("function");
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findByBusiness).toBe("function");
    });
  });

  describe("clientIdsAtendidosPor", () => {
    /** Deja el constructor de consultas devolviendo esas filas agrupadas. */
    function conFilas(clientIds: string[]) {
      const getRawMany = jest
        .fn()
        .mockResolvedValue(clientIds.map((clientId) => ({ clientId })));
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany,
      };
      (mockApptRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
      return qb;
    }

    it("devuelve los clientes del profesional en ese negocio", async () => {
      const qb = conFilas(["client-1", "client-2"]);

      const resultado = await service.clientIdsAtendidosPor(
        "prof-123",
        "business-123"
      );

      expect(resultado).toEqual({
        clientIds: ["client-1", "client-2"],
        truncado: false,
      });
      expect(qb.where).toHaveBeenCalledWith(
        "a.professional_id = :professionalId",
        { professionalId: "prof-123" }
      );
      expect(qb.andWhere).toHaveBeenCalledWith("a.business_id = :businessId", {
        businessId: "business-123",
      });
    });

    // Reservar y cancelar no crea relación con la ficha; si contara, bastaría
    // eso para adoptar un cliente ajeno.
    it("deja fuera las citas canceladas", async () => {
      const qb = conFilas([]);

      await service.clientIdsAtendidosPor("prof-123", "business-123");

      expect(qb.andWhere).toHaveBeenCalledWith("a.status != :cancelada", {
        cancelada: AppointmentStatus.CANCELLED,
      });
    });

    it("agrupa por cliente y ordena por la cita más reciente", async () => {
      const qb = conFilas([]);

      await service.clientIdsAtendidosPor("prof-123", "business-123");

      expect(qb.groupBy).toHaveBeenCalledWith("a.client_id");
      expect(qb.orderBy).toHaveBeenCalledWith("MAX(a.date)", "DESC");
    });

    it("avisa de que hay más clientes de los que caben", async () => {
      const qb = conFilas(["client-1", "client-2", "client-3"]);

      const resultado = await service.clientIdsAtendidosPor(
        "prof-123",
        "business-123",
        2
      );

      expect(resultado).toEqual({
        clientIds: ["client-1", "client-2"],
        truncado: true,
      });
      // Se pide uno de más justo para poder decirlo.
      expect(qb.limit).toHaveBeenCalledWith(3);
    });

    it("devuelve la lista vacía si no ha atendido a nadie", async () => {
      conFilas([]);

      const resultado = await service.clientIdsAtendidosPor(
        "prof-123",
        "business-123"
      );

      expect(resultado).toEqual({ clientIds: [], truncado: false });
    });
  });
});
