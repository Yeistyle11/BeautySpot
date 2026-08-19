import { Test } from "@nestjs/testing";
import { MembershipsService } from "./memberships.service";
import {
  InternalMembershipsController,
  MembershipsController,
} from "./memberships.controller";
import { Role } from "@beautyspot/shared-types";

/**
 * Endpoints servicio-a-servicio, con secreto interno en lugar de rol: se
 * comprueba que datos salen y con que argumentos se llama al servicio.
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

/**
 * Endpoints de cara al panel: de donde sale el negocio sobre el que se actua y
 * quien queda registrado como autor.
 */
describe("MembershipsController", () => {
  let controller: MembershipsController;
  let service: {
    create: jest.Mock;
    updateRole: jest.Mock;
    deactivate: jest.Mock;
    findByBusiness: jest.Mock;
  };

  const DUENA = "user-1";
  const NEGOCIO = "biz-1";

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "mem-1" }),
      updateRole: jest.fn().mockResolvedValue({ id: "mem-1" }),
      deactivate: jest.fn().mockResolvedValue(undefined),
      findByBusiness: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [{ provide: MembershipsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(MembershipsController);
  });

  const invitacion = {
    userId: "user-2",
    businessId: "biz-ajeno",
    role: Role.ADMIN,
  };

  // El negocio del cuerpo se ignora: quien invita solo puede hacerlo en el suyo,
  // y el suyo lo dice el token.
  it("una dueña invita siempre a su propio negocio", async () => {
    await controller.create(invitacion, DUENA, Role.OWNER, NEGOCIO);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: NEGOCIO, invitedBy: DUENA }),
      { userId: DUENA, role: Role.OWNER, businessId: NEGOCIO }
    );
  });

  // El SUPER_ADMIN es de la plataforma, no de un negocio: para él el destino sí
  // llega en el cuerpo.
  it("un SUPER_ADMIN invita al negocio que indique", async () => {
    await controller.create(invitacion, DUENA, Role.SUPER_ADMIN, NEGOCIO);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz-ajeno" }),
      expect.anything()
    );
  });

  it("cambia el rol pasando al actor que lo pide", async () => {
    await controller.updateRole(
      "mem-1",
      { role: Role.RECEPTIONIST },
      DUENA,
      Role.OWNER,
      NEGOCIO
    );

    expect(service.updateRole).toHaveBeenCalledWith(
      "mem-1",
      Role.RECEPTIONIST,
      { userId: DUENA, role: Role.OWNER, businessId: NEGOCIO }
    );
  });

  it("da de baja una membresía y lo confirma con un mensaje", async () => {
    const resultado = await controller.deactivate(
      "mem-1",
      DUENA,
      Role.OWNER,
      NEGOCIO
    );

    expect(service.deactivate).toHaveBeenCalledWith("mem-1", {
      userId: DUENA,
      role: Role.OWNER,
      businessId: NEGOCIO,
    });
    expect(resultado).toEqual({ message: "Membresía desactivada" });
  });

  // El negocio consultado llega por la ruta, pero el actor va aparte: es el
  // servicio quien decide si ese actor puede mirar ese negocio.
  it("lista los miembros del negocio pedido, con su actor", async () => {
    await controller.findByBusiness("biz-2", DUENA, Role.OWNER, NEGOCIO);

    expect(service.findByBusiness).toHaveBeenCalledWith("biz-2", {
      userId: DUENA,
      role: Role.OWNER,
      businessId: NEGOCIO,
    });
  });
});
