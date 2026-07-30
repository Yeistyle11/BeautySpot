import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PublicBookingService } from "./public-booking.service";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { AppointmentsService } from "../appointments/appointments.service";

describe("PublicBookingService", () => {
  let service: PublicBookingService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockApptServiceRepo: jest.Mocked<Repository<AppointmentServiceEntity>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockHttp: { enviar: jest.Mock; pedir: jest.Mock };
  let mockAppointments: { create: jest.Mock };

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
    services: [],
    generateId: () => {},
  } as any;

  const mockAvailability: Availability = {
    id: "avail-123",
    businessId: "business-123",
    professionalId: "prof-123",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "18:00",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockApptService: AppointmentServiceEntity = {
    id: "as-123",
    appointmentId: "appt-123",
    serviceId: "service-123",
    serviceName: "Corte de cabello",
    price: 30000,
    duration: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockApptRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockApptServiceRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockAvailRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    mockBlockRepo = {
      find: jest.fn(),
    } as any;

    // El alta del cliente invitado va por el cliente interno.
    mockHttp = {
      enviar: jest.fn().mockResolvedValue({ id: "client-123" }),
      pedir: jest.fn(),
    };

    // La cita la persiste AppointmentsService, que es donde vive la
    // transacción SERIALIZABLE con la comprobación final de conflicto.
    mockAppointments = {
      create: jest.fn().mockResolvedValue(mockAppointment),
    };

    const module = await Test.createTestingModule({
      providers: [
        PublicBookingService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockApptRepo,
        },
        {
          provide: getRepositoryToken(AppointmentServiceEntity),
          useValue: mockApptServiceRepo,
        },
        {
          provide: getRepositoryToken(Availability),
          useValue: mockAvailRepo,
        },
        {
          provide: getRepositoryToken(BlockedSlot),
          useValue: mockBlockRepo,
        },
        {
          provide: InternalHttpClient,
          useValue: mockHttp,
        },
        {
          provide: AppointmentsService,
          useValue: mockAppointments,
        },
      ],
    }).compile();

    service = module.get<PublicBookingService>(PublicBookingService);
  });

  describe("createPublicAppointment", () => {
    const bookingData = {
      businessId: "business-123",
      professionalId: "prof-123",
      serviceIds: [
        {
          id: "service-123",
          name: "Corte de cabello",
          price: 30000,
          duration: 30,
        },
        { id: "service-456", name: "Barba", price: 20000, duration: 20 },
      ],
      date: "2024-01-15",
      startTime: "10:00",
      notes: "Primera visita",
      guestName: "Juan Pérez",
      guestEmail: "juan@example.com",
      guestPhone: "+573001234567",
    };

    it("debería crear una cita pública exitosamente", async () => {
      mockApptRepo.create.mockReturnValue(mockAppointment);
      mockApptRepo.save.mockResolvedValue(mockAppointment);
      mockApptRepo.find.mockResolvedValue([]);
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptServiceRepo.create.mockReturnValue(mockApptService);
      mockApptServiceRepo.save.mockResolvedValue(mockApptService);

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

      beforeEach(() => {
        mockApptRepo.create.mockReturnValue(mockAppointment);
        mockApptRepo.save.mockResolvedValue(mockAppointment);
        mockApptServiceRepo.create.mockReturnValue(mockApptService);
        mockApptServiceRepo.save.mockResolvedValue(mockApptService);
        mockBlockRepo.find.mockResolvedValue([]);
      });

      /** Horarios del dia, en el orden en que los devuelve la tabla. */
      function equipoDelDia(ids: string[]) {
        mockAvailRepo.find.mockResolvedValue(
          ids.map((professionalId) => ({
            ...mockAvailability,
            professionalId,
          })) as never
        );
      }

      it("asigna el primero del equipo que tenga libre la franja", async () => {
        equipoDelDia(["prof-a", "prof-b"]);
        mockApptRepo.find.mockResolvedValue([]);

        await service.createPublicAppointment(sinPreferencia);

        expect(mockAppointments.create).toHaveBeenCalledWith(
          "business-123",
          expect.objectContaining({ professionalId: "prof-a" })
        );
      });

      it("salta al siguiente cuando el primero ya tiene una cita a esa hora", async () => {
        equipoDelDia(["prof-a", "prof-b"]);
        mockApptRepo.find.mockResolvedValue([
          {
            professionalId: "prof-a",
            startTime: "10:00",
            endTime: "10:50",
          },
        ] as never);

        await service.createPublicAppointment(sinPreferencia);

        expect(mockAppointments.create).toHaveBeenCalledWith(
          "business-123",
          expect.objectContaining({ professionalId: "prof-b" })
        );
      });

      it("avisa cuando nadie del equipo tiene libre esa franja", async () => {
        equipoDelDia(["prof-a"]);
        mockApptRepo.find.mockResolvedValue([
          {
            professionalId: "prof-a",
            startTime: "10:00",
            endTime: "10:50",
          },
        ] as never);

        await expect(
          service.createPublicAppointment(sinPreferencia)
        ).rejects.toThrow(BadRequestException);
        expect(mockAppointments.create).not.toHaveBeenCalled();
      });

      it("consulta el equipo entero de una vez", async () => {
        equipoDelDia(["prof-a", "prof-b", "prof-c", "prof-d"]);
        mockApptRepo.find.mockResolvedValue([]);

        await service.createPublicAppointment(sinPreferencia);

        // Horarios, bloqueos y citas: una consulta cada uno, sea cual sea el
        // tamaño del equipo.
        expect(mockAvailRepo.find).toHaveBeenCalledTimes(1);
        expect(mockBlockRepo.find).toHaveBeenCalledTimes(1);
        expect(mockApptRepo.find).toHaveBeenCalledTimes(1);
        expect(mockAvailRepo.findOne).not.toHaveBeenCalled();
      });

      it("avisa cuando nadie trabaja ese dia", async () => {
        equipoDelDia([]);

        await expect(
          service.createPublicAppointment(sinPreferencia)
        ).rejects.toThrow(BadRequestException);
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
        serviceIds: bookingData.serviceIds,
        date: "2024-01-15",
        startTime: "10:00",
        notes: "Primera visita",
      });
      expect(mockApptRepo.save).not.toHaveBeenCalled();
    });

    it("descarta a un profesional con una cita confirmada a esa hora", async () => {
      const sinPreferencia = { ...bookingData, professionalId: undefined };
      mockAvailRepo.find.mockResolvedValue([
        { ...mockAvailability, professionalId: "prof-a" },
        { ...mockAvailability, professionalId: "prof-b" },
      ] as never);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([
        {
          professionalId: "prof-a",
          startTime: "10:00",
          endTime: "10:50",
          status: AppointmentStatus.CONFIRMED,
        },
      ] as never);

      await service.createPublicAppointment(sinPreferencia);

      // Una cita confirmada ocupa la franja igual que una pendiente.
      expect(mockAppointments.create).toHaveBeenCalledWith(
        "business-123",
        expect.objectContaining({ professionalId: "prof-b" })
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
