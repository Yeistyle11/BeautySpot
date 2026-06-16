import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferenceEntity } from './notification-preference.entity';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let mockRepo: jest.Mocked<Repository<NotificationPreferenceEntity>>;

  const mockPreference: NotificationPreferenceEntity = {
    id: 'pref-123',
    userId: 'user-123',
    businessId: 'biz-123',
    type: 'APPOINTMENT_REMINDER',
    channel: 'EMAIL',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferenceEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
  });

  describe('findByUser', () => {
    it('debería retornar preferencias de un usuario', async () => {
      const preferences = [mockPreference];
      mockRepo.find.mockResolvedValue(preferences);

      const result = await service.findByUser('user-123', 'biz-123');

      expect(result).toEqual(preferences);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-123', businessId: 'biz-123' }
      });
    });

    it('debería retornar array vacío si no hay preferencias', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByUser('user-999', 'biz-999');

      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('debería actualizar preferencia existente', async () => {
      const data = {
        businessId: 'biz-123',
        userId: 'user-123',
        type: 'APPOINTMENT_REMINDER',
        channel: 'EMAIL',
        enabled: false,
      };

      mockRepo.findOne.mockResolvedValue(mockPreference);
      mockRepo.save.mockResolvedValue({ ...mockPreference, enabled: false } as any);

      await service.upsert(data);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-123',
          userId: 'user-123',
          type: 'APPOINTMENT_REMINDER',
          channel: 'EMAIL',
        }
      });
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });

    it('debería crear nueva preferencia si no existe', async () => {
      const data = {
        businessId: 'biz-456',
        userId: 'user-456',
        type: 'APPOINTMENT_REMINDER',
        channel: 'EMAIL',
        enabled: true,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockPreference);
      mockRepo.save.mockResolvedValue(mockPreference);

      await service.upsert(data);

      expect(mockRepo.create).toHaveBeenCalledWith(data);
      expect(mockRepo.save).toHaveBeenCalledWith(mockPreference);
    });
  });

  describe('isNotificationEnabled', () => {
    it('debería retornar enabled si existe preferencia', async () => {
      const enabledPref = { ...mockPreference, enabled: true, generateId: () => {} };
      mockRepo.findOne.mockResolvedValue(enabledPref as any);

      const result = await service.isNotificationEnabled('user-123', 'biz-123', 'APPOINTMENT_REMINDER', 'EMAIL');

      expect(result).toBe(true);
    });

    it('debería retornar enabled false si preferencia está desactivada', async () => {
      const disabledPref = { ...mockPreference, enabled: false, generateId: () => {} };
      mockRepo.findOne.mockResolvedValue(disabledPref as any);

      const result = await service.isNotificationEnabled('user-123', 'biz-123', 'APPOINTMENT_REMINDER', 'EMAIL');

      expect(result).toBe(false);
    });

    it('debería retornar true por defecto si no existe preferencia', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.isNotificationEnabled('user-999', 'biz-999', 'APPOINTMENT_REMINDER', 'EMAIL');

      expect(result).toBe(true);
    });
  });
});