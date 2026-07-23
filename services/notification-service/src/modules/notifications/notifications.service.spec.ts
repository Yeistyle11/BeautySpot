import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationsService } from "./notifications.service";
import { NotificationEntity } from "./notification.entity";
import {
  NotificationType,
  NotificationChannel,
} from "@beautyspot/shared-types";
import { NotFoundException } from "@nestjs/common";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let mockRepo: jest.Mocked<Repository<NotificationEntity>>;

  const mockNotification: NotificationEntity = {
    id: "notif-123",
    businessId: "business-123",
    userId: "user-123",
    type: NotificationType.APPOINTMENT_CONFIRMED,
    channel: NotificationChannel.IN_APP,
    title: "Cita confirmada",
    message: "Tu cita ha sido confirmada",
    data: {},
    read: false,
    sentAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
    setSentAt: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn(),
      count: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe("create", () => {
    it("debería crear una notificación exitosamente", async () => {
      const data = {
        businessId: "business-123",
        userId: "user-123",
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: "Cita confirmada",
        message: "Tu cita ha sido confirmada",
      };

      mockRepo.create.mockReturnValue(mockNotification);
      mockRepo.save.mockResolvedValue(mockNotification);

      await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        channel: NotificationChannel.IN_APP,
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockNotification);
    });

    it("debería usar canal especificado si se proporciona", async () => {
      const data = {
        businessId: "business-123",
        userId: "user-123",
        type: NotificationType.REVIEW_RECEIVED,
        title: "Reseña recibida",
        message: "Has recibido una nueva reseña",
        channel: NotificationChannel.EMAIL,
      };

      mockRepo.create.mockReturnValue(mockNotification);
      mockRepo.save.mockResolvedValue(mockNotification);

      await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        channel: NotificationChannel.EMAIL,
      });
    });

    it("debería propagar errores del repositorio", async () => {
      const data = {
        businessId: "business-123",
        userId: "user-123",
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: "Cita confirmada",
        message: "Tu cita ha sido confirmada",
      };

      mockRepo.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create(data)).rejects.toThrow("Database error");
    });
  });

  describe("findByUser", () => {
    it("debería retornar todas las notificaciones del usuario", async () => {
      const mockUnreadNotification = {
        ...mockNotification,
        read: false,
        generateId: () => {},
        setSentAt: () => {},
      } as any;
      mockRepo.findAndCount.mockResolvedValue([[mockUnreadNotification], 1]);

      const result = await service.findByUser(
        "user-123",
        "business-123",
        false,
        {
          page: 1,
          limit: 20,
          offset: 0,
          sort: "createdAt",
          order: "DESC",
        }
      );

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-123", businessId: "business-123" },
          order: { createdAt: "DESC" },
        })
      );
      expect(result.data).toEqual([mockUnreadNotification]);
      expect(result.meta.total).toBe(1);
    });

    it("debería filtrar solo no leídas", async () => {
      const mockReadNotification = {
        ...mockNotification,
        read: true,
        generateId: () => {},
        setSentAt: () => {},
      } as any;
      mockRepo.findOne.mockResolvedValue(mockReadNotification);
      mockRepo.save.mockResolvedValue({
        ...mockReadNotification,
        read: false,
        generateId: () => {},
        setSentAt: () => {},
      } as any);

      await service.markAsRead("notif-123", "user-123");

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "notif-123", userId: "user-123" },
      });
      expect(mockRepo.save).toHaveBeenCalledWith({
        ...mockReadNotification,
        read: true,
      });
    });

    it("debería lanzar NotFoundException si la notificación no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead("non-existent", "user-123")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("markAllAsRead", () => {
    it("debería marcar todas las notificaciones no leídas como leídas", async () => {
      mockRepo.update.mockResolvedValue({
        raw: [],
        generatedMaps: [],
        affected: 5,
      });

      await service.markAllAsRead("user-123", "business-123");

      expect(mockRepo.update).toHaveBeenCalledWith(
        { userId: "user-123", businessId: "business-123", read: false },
        { read: true }
      );
    });
  });

  describe("getUnreadCount", () => {
    it("debería retornar el conteo de notificaciones no leídas", async () => {
      mockRepo.count.mockResolvedValue(3);

      const result = await service.getUnreadCount("user-123", "business-123");

      expect(mockRepo.count).toHaveBeenCalledWith({
        where: { userId: "user-123", businessId: "business-123", read: false },
      });
      expect(result).toBe(3);
    });
  });
});
