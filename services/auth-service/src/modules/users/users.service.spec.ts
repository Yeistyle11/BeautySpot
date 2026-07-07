import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "./users.service";
import { User } from "../../entities/user.entity";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { NotFoundException } from "@nestjs/common";
import { Role } from "@beautyspot/shared-types";
import { TokenVersionStore } from "@beautyspot/nest-common";

describe("UsersService", () => {
  let service: UsersService;
  let mockUserRepository: jest.Mocked<any>;
  let mockMembershipRepository: jest.Mocked<any>;
  let mockAuditLogRepository: jest.Mocked<any>;
  let mockTokenVersionStore: jest.Mocked<TokenVersionStore>;

  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    phone: "+573001234567",
    password: "hashed-password",
    active: true,
    avatar: "",
    emailVerified: false,
    currentBusinessId: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
    passwordResets: [],
    generateId: () => {},
  };

  const mockMembership: Membership = {
    id: "membership-123",
    userId: "user-123",
    role: Role.OWNER,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    invitedBy: "",
    acceptedAt: null,
    businessId: "business-123",
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockMembershipRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const mockManager = {
      getRepository: jest.fn((target: any) => {
        if (target === User) return mockUserRepository;
        if (target === Membership) return mockMembershipRepository;
        return mockAuditLogRepository;
      }),
    };
    const mockDataSource: any = {
      transaction: jest.fn((cb: any) => cb(mockManager)),
    };
    mockTokenVersionStore = {
      getVersion: jest.fn().mockResolvedValue(0),
      bumpVersion: jest.fn().mockResolvedValue(1),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: mockMembershipRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TokenVersionStore, useValue: mockTokenVersionStore },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "BCRYPT_SALT_ROUNDS") return "12";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("findById", () => {
    it("debería retornar el usuario cuando existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById("user-123");

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
    });

    it("debería lanzar NotFoundException cuando el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findById("non-existent")).rejects.toThrow(
        "Usuario no encontrado"
      );
    });
  });

  describe("findByEmail", () => {
    it("debería retornar el usuario cuando existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("debería retornar null cuando el usuario no existe", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    it("debería manejar diferentes cases de email", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.findByEmail("TEST@EXAMPLE.COM");

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: "TEST@EXAMPLE.COM" },
      });
    });
  });

  describe("updateProfile", () => {
    it("debería actualizar el perfil correctamente", async () => {
      const updateData = {
        name: "Updated Name",
        phone: "+573009876543",
      };

      const updatedUser = { ...mockUser, ...updateData } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        "user-123",
        updateData
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
      expect(result).not.toHaveProperty("password");
      expect(result.name).toBe("Updated Name");
      expect(result.phone).toBe("+573009876543");
    });

    it("debería permitir actualizar solo el nombre", async () => {
      const updateData = { name: "New Name" };

      const updatedUser = { ...mockUser, name: "New Name" } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        "user-123",
        updateData
      );
      expect(result.name).toBe("New Name");
    });

    it("debería permitir actualizar solo el teléfono", async () => {
      const updateData = { phone: "+573009876543" };

      const updatedUser = { ...mockUser, phone: "+573009876543" } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(result.phone).toBe("+573009876543");
    });

    it("debería permitir actualizar el avatar", async () => {
      const updateData = { avatar: "https://example.com/avatar.jpg" };

      const updatedUser = {
        ...mockUser,
        avatar: "https://example.com/avatar.jpg",
      } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(result.avatar).toBe("https://example.com/avatar.jpg");
    });

    it("debería permitir actualizar solo el teléfono", async () => {
      const updateData = { phone: "+573009876543" };

      const updatedUser = { ...mockUser, phone: "+573009876543" } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(result.phone).toBe("+573009876543");
    });

    it("debería permitir actualizar el avatar", async () => {
      const updateData = { avatar: "https://example.com/avatar.jpg" };

      const updatedUser = {
        ...mockUser,
        avatar: "https://example.com/avatar.jpg",
      } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(result.avatar).toBe("https://example.com/avatar.jpg");
    });

    it("debería actualizar múltiples campos simultáneamente", async () => {
      const updateData = {
        name: "Complete Update",
        phone: "+573001112223",
        avatar: "https://example.com/new-avatar.jpg",
      };

      const updatedUser = { ...mockUser, ...updateData } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", updateData);

      expect(result.name).toBe("Complete Update");
      expect(result.phone).toBe("+573001112223");
      expect(result.avatar).toBe("https://example.com/new-avatar.jpg");
    });

    it("no debería incluir el password en la respuesta", async () => {
      const updatedUser = { ...mockUser, name: "Test" } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", { name: "Test" });

      expect(result).not.toHaveProperty("password");
    });

    it("no debería incluir el password en la respuesta", async () => {
      const updatedUser = { ...mockUser, name: "Test" } as any;

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.updateProfile("user-123", { name: "Test" });

      expect(result).not.toHaveProperty("password");
    });
  });

  describe("deactivate", () => {
    it("debería desactivar el usuario correctamente", async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate("user-123");

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        active: false,
      });
    });

    it("debería manejar usuarios ya desactivados", async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.deactivate("user-123")).resolves.not.toThrow();
    });
  });

  describe("getUserMemberships", () => {
    it("debería retornar membresías activas del usuario", async () => {
      const mockMemberships = [mockMembership];
      mockMembershipRepository.find.mockResolvedValue(mockMemberships);

      const result = await service.getUserMemberships("user-123");

      expect(result).toEqual(mockMemberships);
      expect(mockMembershipRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-123", active: true },
      });
    });

    it("debería retornar array vacío si no hay membresías", async () => {
      mockMembershipRepository.find.mockResolvedValue([]);

      const result = await service.getUserMemberships("user-123");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("debería filtrar membresías inactivas", async () => {
      const inactiveMembership = { ...mockMembership, active: false };
      mockMembershipRepository.find.mockResolvedValue([mockMembership]);

      const result = await service.getUserMemberships("user-123");

      expect(result).not.toContainEqual(inactiveMembership);
    });

    it("debería retornar todas las membresías activas del usuario", async () => {
      const mockMemberships: any = [
        mockMembership,
        {
          ...mockMembership,
          id: "membership-456",
          businessId: "business-456",
          role: Role.ADMIN,
        },
      ];
      mockMembershipRepository.find.mockResolvedValue(mockMemberships);

      const result = await service.getUserMemberships("user-123");

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(mockMembership);
    });
  });

  describe("manejo de errores", () => {
    it("debería propagar errores del repositorio", async () => {
      mockUserRepository.findOne.mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(service.findById("user-123")).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("debería manejar usuarios no encontrados en updateProfile", async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile("non-existent", { name: "Test" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("configuración", () => {
    it("debería ser instanciable correctamente", () => {
      expect(service).toBeInstanceOf(UsersService);
    });

    it("debería tener los métodos necesarios", () => {
      expect(typeof service.findById).toBe("function");
      expect(typeof service.findByEmail).toBe("function");
      expect(typeof service.updateProfile).toBe("function");
      expect(typeof service.deactivate).toBe("function");
      expect(typeof service.getUserMemberships).toBe("function");
    });
  });
});
