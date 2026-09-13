import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import {
  AppointmentsController,
  InternalAppointmentsController,
} from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";

/**
 * Rutas que consumen otros servicios: comprueba que cada dato de la ruta y de
 * la consulta llega al servicio donde corresponde.
 */
describe("InternalAppointmentsController", () => {
  let controller: InternalAppointmentsController;
  let service: {
    professionalHasHistory: jest.Mock;
    clientIdsAtendidosPor: jest.Mock;
    datosDeCobro: jest.Mock;
    citaReseñablePor: jest.Mock;
  };
  let disponibilidad: { capacidadDelDia: jest.Mock };

  const PROFESIONAL = "prof-1";
  const NEGOCIO = "biz-1";

  beforeEach(async () => {
    service = {
      professionalHasHistory: jest.fn().mockResolvedValue({ hasHistory: true }),
      clientIdsAtendidosPor: jest
        .fn()
        .mockResolvedValue({ clientIds: [], truncado: false }),
      datosDeCobro: jest.fn().mockResolvedValue(null),
      citaReseñablePor: jest.fn().mockResolvedValue({ resenable: false }),
    };
    disponibilidad = { capacidadDelDia: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalAppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: service },
        { provide: AvailabilityQueryService, useValue: disponibilidad },
      ],
    }).compile();

    controller = moduleRef.get(InternalAppointmentsController);
  });

  it("consulta el historial de citas del profesional", async () => {
    await controller.professionalHasHistory(PROFESIONAL, NEGOCIO);

    expect(service.professionalHasHistory).toHaveBeenCalledWith(
      PROFESIONAL,
      NEGOCIO
    );
  });

  // El negocio acota la respuesta: sin él, un profesional que trabaje en dos
  // sitios arrastraría los clientes de uno al listado del otro.
  it("pide los clientes atendidos acotados al negocio", async () => {
    await controller.clientIdsAtendidos(PROFESIONAL, NEGOCIO);

    expect(service.clientIdsAtendidosPor).toHaveBeenCalledWith(
      PROFESIONAL,
      NEGOCIO
    );
  });

  it("devuelve la capacidad del día", async () => {
    await controller.capacidad(NEGOCIO, "2026-08-17");

    expect(disponibilidad.capacidadDelDia).toHaveBeenCalledWith(
      NEGOCIO,
      "2026-08-17"
    );
  });

  it("devuelve los datos de cobro de una cita", async () => {
    await controller.datosDeCobro("appt-1", NEGOCIO);

    expect(service.datosDeCobro).toHaveBeenCalledWith("appt-1", NEGOCIO);
  });

  it("indica si un usuario puede reseñar la cita", async () => {
    await controller.citaResenable("appt-1", "user-1", NEGOCIO);

    expect(service.citaReseñablePor).toHaveBeenCalledWith(
      "appt-1",
      "user-1",
      NEGOCIO
    );
  });
});

/** Rutas de la agenda del negocio que componen datos de varias consultas. */
describe("AppointmentsController", () => {
  let controller: AppointmentsController;
  let service: Record<string, jest.Mock>;
  let disponibilidad: Record<string, jest.Mock>;

  const NEGOCIO = "biz-1";
  const CITA = "1a2b3c4d-0000-4000-8000-000000000000";

  beforeEach(async () => {
    service = {
      contarPorEstado: jest.fn().mockResolvedValue({ PENDING: 11 }),
      contarVencidas: jest.fn().mockResolvedValue(15),
      create: jest.fn().mockResolvedValue({ id: CITA }),
      registrarWalkIn: jest.fn().mockResolvedValue({ id: CITA }),
      findByBusiness: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByClientUser: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByIdForClientUser: jest.fn().mockResolvedValue({ id: CITA }),
      findById: jest.fn().mockResolvedValue({ id: CITA }),
      confirm: jest.fn().mockResolvedValue({ id: CITA }),
      startService: jest.fn().mockResolvedValue({ id: CITA }),
      complete: jest.fn().mockResolvedValue({ id: CITA }),
      cancel: jest.fn().mockResolvedValue({ id: CITA }),
      markNoShow: jest.fn().mockResolvedValue({ id: CITA }),
      reschedule: jest.fn().mockResolvedValue({ id: CITA }),
      cancelForClientUser: jest.fn().mockResolvedValue({ id: CITA }),
      rescheduleForClientUser: jest.fn().mockResolvedValue({ id: CITA }),
    };
    disponibilidad = {
      capacidadDelDia: jest.fn(),
      franjasDeProfesionalPublico: jest.fn().mockResolvedValue([]),
      franjasDelNegocio: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: service },
        { provide: AvailabilityQueryService, useValue: disponibilidad },
      ],
    }).compile();

    controller = moduleRef.get(AppointmentsController);
  });

  // La sede del encabezado es el respaldo: si el cuerpo nombra una, manda esa.
  it("crea la cita en la sede del cuerpo y la firma quien la crea", async () => {
    await controller.create(NEGOCIO, "sede-cabecera", "user-1", {
      branchId: "sede-cuerpo",
    } as never);

    expect(service.create).toHaveBeenCalledWith(
      NEGOCIO,
      expect.objectContaining({ branchId: "sede-cuerpo", createdBy: "user-1" })
    );
  });

  it("el walk-in hereda la sede del encabezado cuando el cuerpo no la trae", async () => {
    await controller.walkIn(NEGOCIO, "sede-cabecera", "user-1", {} as never);

    expect(service.registrarWalkIn).toHaveBeenCalledWith(
      NEGOCIO,
      expect.objectContaining({
        branchId: "sede-cabecera",
        createdBy: "user-1",
      })
    );
  });

  describe("disponibilidad pública", () => {
    it("con profesional pregunta por su agenda", async () => {
      await controller.getAvailability({
        professionalId: "prof-1",
        date: "2026-09-20",
        duration: 30,
      } as never);

      expect(disponibilidad.franjasDeProfesionalPublico).toHaveBeenCalledWith(
        "prof-1",
        "2026-09-20",
        30
      );
    });

    it("sin profesional pregunta por la del equipo", async () => {
      await controller.getAvailability({
        businessId: NEGOCIO,
        date: "2026-09-20",
        duration: 30,
      } as never);

      expect(disponibilidad.franjasDelNegocio).toHaveBeenCalledWith(
        NEGOCIO,
        "2026-09-20",
        30
      );
    });

    it("sin uno ni otro no hay nada que consultar", async () => {
      await expect(
        controller.getAvailability({ date: "2026-09-20" } as never)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("citas del cliente", () => {
    // El destinatario sale del token: la query no puede apuntar a otro.
    it("lista las suyas por el usuario del token", async () => {
      await controller.findMine("user-1", { page: "2" });

      expect(service.findByClientUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ page: 2 })
      );
    });

    it("el detalle también se acota al usuario del token", async () => {
      await controller.findMineById(CITA, "user-1");

      expect(service.findByIdForClientUser).toHaveBeenCalledWith(
        CITA,
        "user-1"
      );
    });
  });

  describe("transiciones de estado", () => {
    it("confirma, inicia, completa y marca el plantón", async () => {
      await controller.confirm(CITA, NEGOCIO);
      await controller.start(CITA, NEGOCIO);
      await controller.complete(CITA, NEGOCIO);
      await controller.noShow(CITA, NEGOCIO);

      expect(service.confirm).toHaveBeenCalledWith(CITA, NEGOCIO);
      expect(service.startService).toHaveBeenCalledWith(CITA, NEGOCIO);
      expect(service.complete).toHaveBeenCalledWith(CITA, NEGOCIO);
      expect(service.markNoShow).toHaveBeenCalledWith(CITA, NEGOCIO);
    });

    it("la cancelación lleva el motivo, la nota y quién la firma", async () => {
      await controller.cancel(CITA, NEGOCIO, "user-1", {
        motivo: "DUPLICADA",
        nota: "repetida",
      } as never);

      expect(service.cancel).toHaveBeenCalledWith(CITA, NEGOCIO, {
        tipo: "DUPLICADA",
        nota: "repetida",
        canceladaPor: "user-1",
      });
    });

    it("reagendar pasa el nuevo día y la nueva hora", async () => {
      await controller.reschedule(CITA, NEGOCIO, {
        date: "2026-09-25",
        startTime: "10:00",
      } as never);

      expect(service.reschedule).toHaveBeenCalledWith(
        CITA,
        NEGOCIO,
        "2026-09-25",
        "10:00"
      );
    });
  });

  it("el listado del negocio acota por sede y por estado", async () => {
    await controller.findAll(
      NEGOCIO,
      "sede-1",
      { sort: "date" },
      "PENDING" as never,
      "2026-09-20",
      "prof-1",
      "cli-1",
      "ana",
      "true"
    );

    expect(service.findByBusiness).toHaveBeenCalledWith(
      NEGOCIO,
      expect.objectContaining({
        status: "PENDING",
        date: "2026-09-20",
        professionalId: "prof-1",
        clientId: "cli-1",
        search: "ana",
        branchId: "sede-1",
        vencidas: true,
        ordenPedido: true,
      }),
      expect.anything()
    );
  });

  it("el resumen lleva los estados y las que quedan por cerrar", async () => {
    expect(
      await controller.resumenPorEstado("biz-1", undefined, "ana")
    ).toEqual({
      PENDING: 11,
      VENCIDAS: 15,
    });
    expect(service.contarVencidas).toHaveBeenCalledWith("biz-1", {
      search: "ana",
      branchId: undefined,
    });
  });
});
