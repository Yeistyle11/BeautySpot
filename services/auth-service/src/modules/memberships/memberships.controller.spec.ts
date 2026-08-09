import { Test } from "@nestjs/testing";
import { MembershipsService } from "./memberships.service";
import { InternalMembershipsController } from "./memberships.controller";
import { Role } from "@beautyspot/shared-types";

/**
 * Endpoints servicio-a-servicio. No pasan por el control de rol del llamante
 * —lo sustituye el secreto interno—, así que lo que se comprueba aquí es qué
 * datos salen y con qué argumentos se llama al servicio.
 */
describe("InternalMembershipsController", () => {
  let controller: InternalMembershipsController;
  let service: { create: jest.Mock; findByBusiness: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "mem-1" }),
      findByBusiness: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalMembershipsController],
      providers: [{ provide: MembershipsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(InternalMembershipsController);
  });

  describe("create", () => {
    it("crea la membresía con quien la invita", async () => {
      await controller.create({
        userId: "user-1",
        businessId: "biz-1",
        role: Role.OWNER,
        invitedBy: "user-2",
      });

      expect(service.create).toHaveBeenCalledWith({
        userId: "user-1",
        businessId: "biz-1",
        role: Role.OWNER,
        invitedBy: "user-2",
      });
    });

    // Quien crea su propio negocio se invita a sí mismo: no hay nadie más.
    it("se atribuye la invitación al propio usuario si no viene", async () => {
      await controller.create({
        userId: "user-1",
        businessId: "biz-1",
        role: Role.OWNER,
      });

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ invitedBy: "user-1" })
      );
    });
  });

  describe("findByBusiness", () => {
    it("devuelve solo el identificador y el rol de cada miembro", async () => {
      service.findByBusiness.mockResolvedValue([
        {
          userId: "user-1",
          role: Role.OWNER,
          user: { email: "duena@ejemplo.com", passwordHash: "secreto" },
        },
        { userId: "user-2", role: Role.PROFESSIONAL, user: {} },
      ]);

      const resultado = await controller.findByBusiness("biz-1");

      // Quien llama solo necesita a quién avisar; los datos de la persona no
      // tienen por qué salir del servicio que los guarda.
      expect(resultado).toEqual([
        { userId: "user-1", role: Role.OWNER },
        { userId: "user-2", role: Role.PROFESSIONAL },
      ]);
    });

    it("consulta el negocio pedido sin actor que limite el alcance", async () => {
      await controller.findByBusiness("biz-1");

      expect(service.findByBusiness).toHaveBeenCalledWith("biz-1");
    });

    it("devuelve una lista vacía si el negocio no tiene miembros", async () => {
      service.findByBusiness.mockResolvedValue([]);

      expect(await controller.findByBusiness("biz-1")).toEqual([]);
    });
  });
});
