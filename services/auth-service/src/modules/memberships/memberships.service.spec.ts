import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MembershipsService, MembershipActor } from "./memberships.service";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { Role } from "@beautyspot/shared-types";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("MembershipsService", () => {
  let service: MembershipsService;
  let mockRepo: jest.Mocked<Repository<Membership>>;
  let mockAuditRepo: jest.Mocked<Repository<AuditLog>>;

  const actor: MembershipActor = {
    userId: "admin-123",
    role: Role.OWNER,
    businessId: "biz-123",
  };

  const mockMembership: Membership = {
    id: "mem-123",
    userId: "user-123",
    businessId: "biz-123",
    role: Role.ADMIN,
    active: true,
    acceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    mockAuditRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: getRepositoryToken(Membership), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
  });

  describe("create", () => {
    it("debería crear una membresía exitosamente", async () => {
      const data = {
        userId: "user-456",
        businessId: "biz-456",
        role: Role.RECEPTIONIST,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockMembership);
      mockRepo.save.mockResolvedValue(mockMembership);

      const result = await service.create(data, actor);

      expect(result).toEqual(mockMembership);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          userId: data.userId,
          businessId: data.businessId,
          active: true,
        },
      });
      expect(mockRepo.create).toHaveBeenCalledWith({
        ...data,
        acceptedAt: expect.any(Date),
      });
    });

    it("debería crear una membresía sin actor (uso interno)", async () => {
      const data = {
        userId: "user-456",
        businessId: "biz-456",
        role: Role.RECEPTIONIST,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockMembership);
      mockRepo.save.mockResolvedValue(mockMembership);

      await service.create(data);

      expect(mockAuditRepo.save).not.toHaveBeenCalled();
    });

    it("debería lanzar ForbiddenException si el usuario ya es miembro", async () => {
      const data = {
        userId: "user-123",
        businessId: "biz-123",
        role: Role.RECEPTIONIST,
      };

      mockRepo.findOne.mockResolvedValue(mockMembership);

      await expect(service.create(data)).rejects.toThrow(ForbiddenException);
      await expect(service.create(data)).rejects.toThrow(
        "El usuario ya es miembro de este negocio"
      );
    });

    it("debería aceptar invitedBy opcional", async () => {
      const data = {
        userId: "user-789",
        businessId: "biz-789",
        role: Role.PROFESSIONAL,
        invitedBy: "user-123",
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockMembership);
      mockRepo.save.mockResolvedValue(mockMembership);

      await service.create(data);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ invitedBy: "user-123" })
      );
    });

    it("debería registrar audit log al crear con actor", async () => {
      const data = {
        userId: "user-456",
        businessId: "biz-456",
        role: Role.RECEPTIONIST,
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockMembership);
      mockRepo.save.mockResolvedValue(mockMembership);

      await service.create(data, actor);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actor.userId,
          action: "MEMBERSHIP_CREATED",
          entity: "memberships",
        })
      );
    });
  });

  describe("updateRole", () => {
    it("debería actualizar el rol de una membresía", async () => {
      const membership = {
        ...mockMembership,
        role: Role.RECEPTIONIST,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(membership);
      mockRepo.save.mockResolvedValue({
        ...membership,
        role: Role.ADMIN,
      } as any);

      const result = await service.updateRole("mem-123", Role.ADMIN, actor);

      expect(result.role).toBe(Role.ADMIN);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.ADMIN })
      );
    });

    it("debería lanzar NotFoundException si la membresía no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole("mem-999", Role.ADMIN, actor)
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar NotFoundException si la membresía pertenece a otro negocio (IDOR)", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const otherBizActor: MembershipActor = {
        userId: "admin-123",
        role: Role.OWNER,
        businessId: "biz-OTHER",
      };
      await expect(
        service.updateRole("mem-123", Role.ADMIN, otherBizActor)
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar ForbiddenException si se intenta cambiar rol del OWNER sin ser Super Admin", async () => {
      const ownerMembership = {
        ...mockMembership,
        role: Role.OWNER,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(ownerMembership);

      await expect(
        service.updateRole("mem-123", Role.ADMIN, actor)
      ).rejects.toThrow(ForbiddenException);
    });

    it("debería permitir cambiar rol del OWNER si requester es Super Admin", async () => {
      const ownerMembership = {
        ...mockMembership,
        role: Role.OWNER,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(ownerMembership);
      mockRepo.save.mockResolvedValue({
        ...ownerMembership,
        role: Role.ADMIN,
        generateId: () => {},
      } as any);

      const superAdminActor: MembershipActor = {
        userId: "super-1",
        role: Role.SUPER_ADMIN,
      };
      const result = await service.updateRole(
        "mem-123",
        Role.ADMIN,
        superAdminActor
      );

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.role).toBe(Role.ADMIN);
    });

    it("debería registrar audit log con previousRole y newRole", async () => {
      const membership = {
        ...mockMembership,
        role: Role.RECEPTIONIST,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(membership);
      mockRepo.save.mockResolvedValue({
        ...membership,
        role: Role.ADMIN,
      } as any);

      await service.updateRole("mem-123", Role.ADMIN, actor);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MEMBERSHIP_ROLE_CHANGED",
          changes: expect.objectContaining({
            previousRole: Role.RECEPTIONIST,
            newRole: Role.ADMIN,
          }),
        })
      );
    });

    it("SUPER_ADMIN debería poder operar sin restricción de businessId", async () => {
      const superAdminActor: MembershipActor = {
        userId: "super-1",
        role: Role.SUPER_ADMIN,
      };
      const membership = {
        ...mockMembership,
        businessId: "biz-OTHER",
        role: Role.ADMIN,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(membership);
      mockRepo.save.mockResolvedValue(membership);

      await service.updateRole("mem-123", Role.PROFESSIONAL, superAdminActor);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: "mem-123" },
      });
    });
  });

  describe("deactivate", () => {
    it("debería desactivar una membresía", async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate("mem-123", actor);

      expect(mockRepo.update).toHaveBeenCalledWith("mem-123", {
        active: false,
      });
    });

    it("debería lanzar NotFoundException si la membresía no existe", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate("mem-999", actor)).rejects.toThrow(
        NotFoundException
      );
    });

    it("debería lanzar ForbiddenException si se intenta desactivar al OWNER", async () => {
      const ownerMembership = {
        ...mockMembership,
        role: Role.OWNER,
        generateId: () => {},
      };
      mockRepo.findOne.mockResolvedValue(ownerMembership);

      await expect(service.deactivate("mem-123", actor)).rejects.toThrow(
        ForbiddenException
      );
    });

    it("debería registrar audit log al desactivar", async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.deactivate("mem-123", actor);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MEMBERSHIP_DEACTIVATED",
        })
      );
    });
  });

  describe("findByUserAndBusiness", () => {
    it("debería encontrar membresía activa por usuario y negocio", async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);

      const result = await service.findByUserAndBusiness("user-123", "biz-123");

      expect(result).toEqual(mockMembership);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { userId: "user-123", businessId: "biz-123", active: true },
      });
    });

    it("debería retornar null si no encuentra membresía", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findByUserAndBusiness("user-999", "biz-999");

      expect(result).toBeNull();
    });
  });

  describe("findByBusiness", () => {
    it("debería encontrar todas las membresías activas de un negocio", async () => {
      const memberships = [
        mockMembership,
        { ...mockMembership, id: "mem-456", userId: "user-456" } as any,
      ];

      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.find.mockResolvedValue(memberships);

      const result = await service.findByBusiness("biz-123", actor);

      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { businessId: "biz-123", active: true },
        relations: ["user"],
      });
    });

    it("debería lanzar ForbiddenException si el caller no pertenece al negocio", async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findByBusiness("biz-OTHER", actor)).rejects.toThrow(
        ForbiddenException
      );
    });

    it("SUPER_ADMIN debería poder listar sin verificación de membresía", async () => {
      mockRepo.find.mockResolvedValue([mockMembership]);

      const superAdminActor: MembershipActor = {
        userId: "super-1",
        role: Role.SUPER_ADMIN,
      };
      await service.findByBusiness("biz-ANY", superAdminActor);

      expect(mockRepo.findOne).not.toHaveBeenCalled();
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it("debería retornar array vacío si no hay membresías", async () => {
      mockRepo.findOne.mockResolvedValue(mockMembership);
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findByBusiness("biz-999", actor);

      expect(result).toEqual([]);
    });
  });
});
