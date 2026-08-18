import { Test } from "@nestjs/testing";
import {
  BusinessProfilesController,
  InternalBusinessProfilesController,
} from "./business-profiles.controller";
import { BusinessProfilesService } from "./business-profiles.service";

/**
 * Lo que se comprueba aquí es de dónde sale el negocio sobre el que se escribe.
 * El servicio decide qué se puede hacer, pero solo con lo que el controlador le
 * pase, y esa es toda la diferencia entre la ruta del panel y la interna.
 */
describe("BusinessProfilesController", () => {
  let controller: BusinessProfilesController;
  let service: { crearParaNegocio: jest.Mock };

  const NEGOCIO = "biz-1";

  beforeEach(async () => {
    service = { crearParaNegocio: jest.fn().mockResolvedValue({ id: "p-1" }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [BusinessProfilesController],
      providers: [{ provide: BusinessProfilesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(BusinessProfilesController);
  });

  it("da de alta el perfil del negocio que dice el token", async () => {
    const dto = { name: "Barbería La Noche", businessType: "BARBERIA" };

    await controller.crear(NEGOCIO, dto);

    expect(service.crearParaNegocio).toHaveBeenCalledWith(NEGOCIO, dto);
  });

  // El DTO del panel no admite businessId, así que un dueño no puede apuntar el
  // alta al negocio de otro ni colándolo en el cuerpo.
  it("ignora un negocio colado en el cuerpo", async () => {
    const dto = {
      name: "Barbería La Noche",
      businessType: "BARBERIA",
      businessId: "biz-ajeno",
    } as never;

    await controller.crear(NEGOCIO, dto);

    expect(service.crearParaNegocio).toHaveBeenCalledWith(NEGOCIO, dto);
  });
});

/**
 * La ruta interna sí recibe el negocio en el cuerpo: quien llama es otro
 * servicio detrás del secreto interno, no un usuario con sesión.
 */
describe("InternalBusinessProfilesController", () => {
  let controller: InternalBusinessProfilesController;
  let service: { createOrUpdate: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    service = {
      createOrUpdate: jest.fn().mockResolvedValue({ id: "p-1" }),
      findById: jest.fn().mockResolvedValue({ id: "p-1" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalBusinessProfilesController],
      providers: [{ provide: BusinessProfilesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(InternalBusinessProfilesController);
  });

  it("sincroniza con el negocio que llega en el cuerpo", async () => {
    const dto = { businessId: "biz-1", slug: "la-noche", name: "La Noche" };

    await controller.createOrUpdate(dto);

    expect(service.createOrUpdate).toHaveBeenCalledWith(dto);
  });

  it("busca el perfil por su id interno", async () => {
    await controller.findById("p-1");

    expect(service.findById).toHaveBeenCalledWith("p-1");
  });
});
