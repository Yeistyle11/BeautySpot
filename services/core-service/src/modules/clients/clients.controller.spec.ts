import { Test } from "@nestjs/testing";
import { ROLES_KEY } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

/**
 * Comprueba que el rol de quien pregunta decide que listado de la cartera se
 * le sirve.
 */
describe("ClientsController", () => {
  let controller: ClientsController;
  let service: {
    create: jest.Mock;
    findByBusiness: jest.Mock;
    findByBusinessParaProfesional: jest.Mock;
    findNamesByIds: jest.Mock;
    findMineConNivel: jest.Mock;
    updateMineByUser: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    anonymize: jest.Mock;
  };

  const NEGOCIO = "biz-1";
  const USUARIO = "user-1";

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "cli-1" }),
      findByBusiness: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findByBusinessParaProfesional: jest
        .fn()
        .mockResolvedValue({ data: [], meta: {} }),
      findNamesByIds: jest.fn().mockResolvedValue([]),
      findMineConNivel: jest.fn().mockResolvedValue({ id: "cli-1" }),
      updateMineByUser: jest.fn().mockResolvedValue({ id: "cli-1" }),
      findById: jest.fn().mockResolvedValue({ id: "cli-1" }),
      update: jest.fn().mockResolvedValue({ id: "cli-1" }),
      anonymize: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ClientsController);
  });

  it("sirve el listado acotado a quien solo atiende", async () => {
    await controller.findAll(NEGOCIO, Role.PROFESSIONAL, USUARIO, {}, "juan");

    expect(service.findByBusinessParaProfesional).toHaveBeenCalledWith(
      NEGOCIO,
      USUARIO,
      "juan",
      expect.objectContaining({ page: 1 })
    );
    expect(service.findByBusiness).not.toHaveBeenCalled();
  });

  it.each([Role.OWNER, Role.ADMIN, Role.RECEPTIONIST])(
    "sirve la cartera completa a %s",
    async (role) => {
      await controller.findAll(NEGOCIO, role, USUARIO, {}, undefined);

      expect(service.findByBusiness).toHaveBeenCalledWith(
        NEGOCIO,
        undefined,
        expect.objectContaining({ page: 1 })
      );
      expect(service.findByBusinessParaProfesional).not.toHaveBeenCalled();
    }
  );

  // Arreglar solo el listado dejaría media puerta abierta: la ficha por id
  // devuelve documento, notas y ficha clínica de cualquier cliente del negocio.
  it("no deja la ficha completa al alcance de quien solo atiende", () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ClientsController.prototype.findById
    );

    expect(roles).not.toContain(Role.PROFESSIONAL);
    expect(roles).toEqual([Role.OWNER, Role.ADMIN, Role.RECEPTIONIST]);
  });

  // Su agenda sigue necesitando poner nombre a las citas del día, y para eso
  // está la ruta que solo devuelve nombres.
  it("mantiene los nombres al alcance de quien atiende", () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ClientsController.prototype.names
    );

    expect(roles).toContain(Role.PROFESSIONAL);
  });

  it("registra el cliente en el negocio del token", async () => {
    const dto = { name: "Carlos Pérez" };

    await controller.create(NEGOCIO, dto);

    expect(service.create).toHaveBeenCalledWith(NEGOCIO, dto);
  });

  it("resuelve los nombres pedidos dentro del negocio", async () => {
    await controller.names(NEGOCIO, { ids: ["cli-1", "cli-2"] });

    expect(service.findNamesByIds).toHaveBeenCalledWith(NEGOCIO, [
      "cli-1",
      "cli-2",
    ]);
  });

  it("sirve al cliente su propia ficha con el nivel resuelto", async () => {
    await controller.findMine(USUARIO);

    expect(service.findMineConNivel).toHaveBeenCalledWith(USUARIO);
  });

  it("actualiza los datos del cliente autenticado", async () => {
    const dto = { name: "Carlos P." };

    await controller.updateMine(USUARIO, dto);

    expect(service.updateMineByUser).toHaveBeenCalledWith(USUARIO, dto);
  });

  // Quien reservó como invitado no tiene ficha: el 404 manda al llamador a su
  // usuario de auth en vez de dejarle creer que guardó.
  it("avisa si el usuario autenticado no tiene ficha", async () => {
    service.updateMineByUser.mockResolvedValue(null);

    await expect(controller.updateMine(USUARIO, {})).rejects.toThrow(
      "El usuario no tiene ficha de cliente"
    );
  });

  it("busca una ficha por id dentro del negocio", async () => {
    await controller.findById("cli-1", NEGOCIO);

    expect(service.findById).toHaveBeenCalledWith("cli-1", NEGOCIO);
  });

  it("actualiza una ficha del negocio", async () => {
    const dto = { notes: "alérgico al amoníaco" };

    await controller.update("cli-1", NEGOCIO, dto);

    expect(service.update).toHaveBeenCalledWith("cli-1", NEGOCIO, dto);
  });

  it("ejerce el derecho de supresión sobre una ficha", async () => {
    await controller.anonymize("cli-1", NEGOCIO);

    expect(service.anonymize).toHaveBeenCalledWith("cli-1", NEGOCIO);
  });
});
