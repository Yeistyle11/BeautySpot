import { Test } from "@nestjs/testing";
import { InternalAppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";

/**
 * Rutas que consumen otros servicios. Lo que importa aquí es que cada dato de la
 * ruta y de la consulta llegue al servicio donde corresponde: quien pregunta no
 * tiene sesión, así que no hay ningún otro sitio de donde sacarlos.
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
