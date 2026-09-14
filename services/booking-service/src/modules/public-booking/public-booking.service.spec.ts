import { Test } from "@nestjs/testing";
import { PublicBookingService } from "./public-booking.service";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { AppointmentsService } from "../appointments/appointments.service";
import { AvailabilityQueryService } from "../appointments/availability-query.service";

const CORTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BARBA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Lo que el catálogo del core-service devuelve para los servicios del fixture. */
/** Sin procesado ni limpieza: cada servicio ocupa su bloque entero. */
const sinReparto = {
  procesadoDesde: null,
  procesadoMinutos: null,
  bufferDespues: 0,
};

const CATALOGO = [
  {
    id: CORTE,
    name: "Corte de cabello",
    price: 30000,
    duration: 30,
    ...sinReparto,
  },
  { id: BARBA, name: "Barba", price: 20000, duration: 20, ...sinReparto },
];

describe("PublicBookingService", () => {
  let service: PublicBookingService;
  let mockHttp: { enviar: jest.Mock; pedir: jest.Mock };
  let mockAppointments: { create: jest.Mock };
  let mockDisponibilidad: { primerProfesionalLibre: jest.Mock };

  const mockAppointment: Appointment = {
    id: "appt-123",
    businessId: "business-123",
    clientId: "client-123",
    professionalId: "prof-123",
    date: "2024-01-15",
    startTime: "10:00",
    endTime: "10:50",
    totalAmount: 50000,
    status: AppointmentStatus.PENDING,
    notes: "Cita de prueba",
    createdAt: new Date(),
    updatedAt: new Date(),
    // La respuesta pública se arma con lo que quedó guardado, no con el cuerpo.
    appointmentServices: [
      { serviceName: "Corte de cabello" },
      { serviceName: "Barba" },
    ],
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    // Por el cliente interno van dos cosas: el alta del cliente invitado y la
    // resolución del catálogo, así que el mock responde según la ruta.
    mockHttp = {
      enviar: jest
        .fn()
        .mockImplementation(async (_servicio, ruta) =>
          ruta === "/internal/services/resolve"
            ? CATALOGO
            : { id: "client-123" }
        ),
      pedir: jest.fn(),
    };

    // La cita la persiste AppointmentsService, que es donde vive la
    // transacción SERIALIZABLE con la comprobación final de conflicto.
    mockAppointments = {
      create: jest.fn().mockResolvedValue(mockAppointment),
    };

    // Quién está libre lo decide el motor de la agenda; aquí solo se comprueba
    // que se le pregunta a él y que se respeta su respuesta.
    mockDisponibilidad = {
      primerProfesionalLibre: jest.fn().mockResolvedValue("prof-123"),
    };

    const module = await Test.createTestingModule({
      providers: [
        PublicBookingService,
        {
          provide: InternalHttpClient,
          useValue: mockHttp,
        },
        {
          provide: AppointmentsService,
          useValue: mockAppointments,
        },
        {
          provide: AvailabilityQueryService,
          useValue: mockDisponibilidad,
        },
      ],
    }).compile();

    service = module.get<PublicBookingService>(PublicBookingService);
  });

  describe("createPublicAppointment", () => {
    const bookingData = {
      businessId: "business-123",
      professionalId: "prof-123",
      serviceIds: [CORTE, BARBA],
      date: "2024-01-15",
      startTime: "10:00",
      notes: "Primera visita",
      guestName: "Juan Pérez",
      guestEmail: "juan@example.com",
      guestPhone: "+573001234567",
    };

    it("debería crear una cita pública exitosamente", async () => {
      const result = await service.createPublicAppointment(bookingData);

      expect(result).toEqual({
        id: "appt-123",
        date: "2024-01-15",
        startTime: "10:00",
        endTime: "10:50",
        status: AppointmentStatus.PENDING,
        totalAmount: 50000,
        services: ["Corte de cabello", "Barba"],
      });
      expect(mockAppointments.create).toHaveBeenCalled();
    });

    describe("sin profesional pedido", () => {
      /** Reserva de "cualquier profesional": el cuerpo omite professionalId. */
      const sinPreferencia = { ...bookingData, professionalId: undefined };

      it("reserva con el profesional que le da el motor de la agenda", async () => {
        mockDisponibilidad.primerProfesionalLibre.mockResolvedValue("prof-b");

        await service.createPublicAppointment(sinPreferencia);

        expect(mockAppointments.create).toHaveBeenCalledWith(
          "business-123",
          expect.objectContaining({ professionalId: "prof-b" })
        );
      });

      it("le pasa la franja y las líneas del catálogo", async () => {
        await service.createPublicAppointment(sinPreferencia);

        expect(mockDisponibilidad.primerProfesionalLibre).toHaveBeenCalledWith(
          "business-123",
          "2024-01-15",
          "10:00",
          "10:50",
          expect.arrayContaining([expect.objectContaining({ id: CORTE })])
        );
      });

      it("avisa cuando el motor no encuentra a nadie libre", async () => {
        mockDisponibilidad.primerProfesionalLibre.mockResolvedValue(null);

        await expect(
          service.createPublicAppointment(sinPreferencia)
        ).rejects.toThrow(BadRequestException);
        expect(mockAppointments.create).not.toHaveBeenCalled();
      });

      it("no pregunta por disponibilidad si ya viene el profesional", async () => {
        await service.createPublicAppointment(bookingData);

        expect(
          mockDisponibilidad.primerProfesionalLibre
        ).not.toHaveBeenCalled();
      });
    });

    it("debería lanzar BadRequestException si no hay disponibilidad", async () => {
      mockAppointments.create.mockRejectedValue(
        new BadRequestException("El horario seleccionado no esta disponible")
      );

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow("El horario seleccionado no esta disponible");
    });

    it("debería lanzar BadRequestException si hay conflicto de horario", async () => {
      mockAppointments.create.mockRejectedValue(
        new BadRequestException("Ya existe una cita en ese horario")
      );

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow("Ya existe una cita en ese horario");
    });

    it("persiste la cita por el camino con transacción, no por su cuenta", async () => {
      await service.createPublicAppointment(bookingData);

      // Delega en AppointmentsService, que trae el re-check dentro de la
      // transacción, el reintento y el evento del outbox.
      expect(mockAppointments.create).toHaveBeenCalledWith("business-123", {
        professionalId: "prof-123",
        clientId: "client-123",
        serviceIds: [CORTE, BARBA],
        date: "2024-01-15",
        startTime: "10:00",
        notes: "Primera visita",
      });
    });

    it("no ata la ficha del invitado a ninguna cuenta", async () => {
      // La ruta es pública y sin token: aceptar un userId dejaría reservar en
      // nombre de otro y ligarle la ficha.
      await service.createPublicAppointment({
        ...bookingData,
        userId: "usuario-ajeno",
      } as never);

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/clients/find-or-create",
        expect.not.objectContaining({ userId: expect.anything() })
      );
    });

    // La reserva con sesión sí liga la ficha, y el vínculo sale del token: es
    // lo que hace que la cita aparezca luego en *Mis Citas* y que el cliente
    // pueda cancelarla, reagendarla y reseñarla.
    it("liga la ficha a la cuenta cuando quien reserva tiene sesión", async () => {
      await service.createPublicAppointment(bookingData, "usuario-propio");

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/clients/find-or-create",
        expect.objectContaining({ userId: "usuario-propio" })
      );
    });

    // El correo del cuerpo dice como avisar; el que identifica es el del token.
    // Mandar ambos es lo que permite al core no fiarse del primero.
    it("manda el correo acreditado por el token, no el que se escribe", async () => {
      await service.createPublicAppointment(
        { ...bookingData, guestEmail: "ajeno@ejemplo.com" },
        "usuario-propio",
        "propio@ejemplo.com"
      );

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/clients/find-or-create",
        expect.objectContaining({
          email: "ajeno@ejemplo.com",
          userEmail: "propio@ejemplo.com",
        })
      );
    });

    it("no manda correo acreditado en la reserva de invitado", async () => {
      await service.createPublicAppointment({
        ...bookingData,
        guestEmail: "invitado@ejemplo.com",
      });

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/clients/find-or-create",
        expect.not.objectContaining({ userEmail: expect.anything() })
      );
    });

    it("ignora el userId del cuerpo también con sesión", async () => {
      await service.createPublicAppointment(
        { ...bookingData, userId: "usuario-ajeno" } as never,
        "usuario-propio"
      );

      expect(mockHttp.enviar).toHaveBeenCalledWith(
        "core",
        "/internal/clients/find-or-create",
        expect.objectContaining({ userId: "usuario-propio" })
      );
    });

    it("debería calcular correctamente el endTime y totalAmount", async () => {
      const result = await service.createPublicAppointment(bookingData);

      expect(result.endTime).toBe("10:50");
      expect(result.totalAmount).toBe(50000);
    });

    it("debería lanzar ServiceUnavailableException si core-service responde non-2xx (fail-closed)", async () => {
      mockHttp.enviar.mockRejectedValue(
        new ServiceUnavailableException("core-service respondió 500")
      );

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("debería lanzar ServiceUnavailableException si fetch falla (red/timeout)", async () => {
      mockHttp.enviar.mockRejectedValue(
        new ServiceUnavailableException("core-service no está disponible")
      );

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
