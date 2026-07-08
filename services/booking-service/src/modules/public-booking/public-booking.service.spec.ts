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
import { ConfigService } from "@nestjs/config";
import { setMockFetchResponse } from "../../test/setup";

describe("PublicBookingService", () => {
  let service: PublicBookingService;
  let mockApptRepo: jest.Mocked<Repository<Appointment>>;
  let mockApptServiceRepo: jest.Mocked<Repository<AppointmentServiceEntity>>;
  let mockAvailRepo: jest.Mocked<Repository<Availability>>;
  let mockBlockRepo: jest.Mocked<Repository<BlockedSlot>>;
  let mockConfigService: jest.Mocked<ConfigService>;

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

    mockConfigService = {
      get: jest.fn(),
    } as any;

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
          provide: ConfigService,
          useValue: mockConfigService,
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
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });

      mockApptRepo.create.mockReturnValue(mockAppointment);
      mockApptRepo.save.mockResolvedValue(mockAppointment);
      mockApptRepo.find.mockResolvedValue([]);
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptServiceRepo.create.mockReturnValue(mockApptService);
      mockApptServiceRepo.save.mockResolvedValue(mockApptService);

      setMockFetchResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "client-123" } }),
      });

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
      expect(mockApptRepo.create).toHaveBeenCalled();
      expect(mockApptRepo.save).toHaveBeenCalled();
    });

    it("debería lanzar BadRequestException si no hay disponibilidad", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });
      mockAvailRepo.findOne.mockResolvedValue(null);

      setMockFetchResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "client-123" } }),
      });

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow("El horario seleccionado no esta disponible");
    });

    it("debería lanzar BadRequestException si hay conflicto de horario", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptRepo.find.mockResolvedValue([mockAppointment]);

      setMockFetchResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "client-123" } }),
      });

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow("Ya existe una cita en ese horario");
    });

    it("debería calcular correctamente el endTime y totalAmount", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });
      mockApptRepo.create.mockReturnValue(mockAppointment);
      mockApptRepo.save.mockResolvedValue(mockAppointment);
      mockApptRepo.find.mockResolvedValue([]);
      mockAvailRepo.findOne.mockResolvedValue(mockAvailability);
      mockBlockRepo.find.mockResolvedValue([]);
      mockApptServiceRepo.create.mockReturnValue(mockApptService);
      mockApptServiceRepo.save.mockResolvedValue(mockApptService);

      setMockFetchResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "client-123" } }),
      });

      const result = await service.createPublicAppointment(bookingData);

      expect(result.endTime).toBe("10:50");
      expect(result.totalAmount).toBe(50000);
    });

    it("debería lanzar ServiceUnavailableException si core-service responde non-2xx (fail-closed)", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });

      setMockFetchResponse({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal error" }),
      });

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("debería lanzar ServiceUnavailableException si fetch falla (red/timeout)", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === "CORE_SERVICE_URL") return "http://localhost:3002";
        if (key === "INTERNAL_API_SECRET") return "secret123";
        return undefined;
      });

      const { getMockFetch } = require("../../test/setup");
      getMockFetch().mockRejectedValueOnce(new Error("Network error"));

      await expect(
        service.createPublicAppointment(bookingData)
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
