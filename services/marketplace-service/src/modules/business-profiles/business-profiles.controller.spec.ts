import { Test } from "@nestjs/testing";
import {
  BusinessProfilesController,
  InternalBusinessProfilesController,
  PublicProfilesController,
} from "./business-profiles.controller";
import { BusinessProfilesService } from "./business-profiles.service";

/**
 * Comprueba de donde sale el negocio sobre el que se escribe en la ruta del
 * panel y en la interna.
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

  // El DTO del panel no admite businessId: no se puede apuntar el alta al
  // negocio de otro por el cuerpo.
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

/** El resto de rutas del panel, que escriben sobre el negocio del token. */
describe("BusinessProfilesController · resto de rutas", () => {
  let controller: BusinessProfilesController;
  let service: Record<string, jest.Mock>;

  const NEGOCIO = "biz-1";

  beforeEach(async () => {
    service = {
      findByBusinessId: jest.fn().mockResolvedValue({ id: "p-1" }),
      updateConfig: jest.fn().mockResolvedValue({ id: "p-1" }),
      addGalleryImages: jest.fn().mockResolvedValue({ id: "p-1" }),
      updateGalleryImage: jest.fn().mockResolvedValue({ id: "p-1" }),
      removeGalleryImage: jest.fn().mockResolvedValue({ id: "p-1" }),
      publish: jest.fn().mockResolvedValue({ id: "p-1" }),
      unpublish: jest.fn().mockResolvedValue({ id: "p-1" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BusinessProfilesController],
      providers: [{ provide: BusinessProfilesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(BusinessProfilesController);
  });

  it("lee el perfil del negocio del token", async () => {
    expect(await controller.findMyProfile(NEGOCIO)).toEqual({ id: "p-1" });
    expect(service.findByBusinessId).toHaveBeenCalledWith(NEGOCIO);
  });

  it("guarda la configuración sobre ese mismo negocio", async () => {
    await controller.updateConfig(NEGOCIO, { descripcion: "Hola" } as never);

    expect(service.updateConfig).toHaveBeenCalledWith(NEGOCIO, {
      descripcion: "Hola",
    });
  });

  describe("galería", () => {
    it("añade, cambia y quita imágenes del negocio del token", async () => {
      await controller.addGalleryImages(NEGOCIO, {
        images: ["a.jpg"],
      } as never);
      await controller.updateGalleryImage(NEGOCIO, {
        index: 0,
        url: "b.jpg",
      } as never);
      await controller.removeGalleryImage(NEGOCIO, 2);

      expect(service.addGalleryImages).toHaveBeenCalledWith(NEGOCIO, {
        images: ["a.jpg"],
      });
      expect(service.updateGalleryImage).toHaveBeenCalledWith(NEGOCIO, {
        index: 0,
        url: "b.jpg",
      });
      expect(service.removeGalleryImage).toHaveBeenCalledWith(NEGOCIO, 2);
    });
  });

  it("publica y despublica el escaparate", async () => {
    await controller.publish(NEGOCIO);
    await controller.unpublish(NEGOCIO);

    expect(service.publish).toHaveBeenCalledWith(NEGOCIO);
    expect(service.unpublish).toHaveBeenCalledWith(NEGOCIO);
  });
});

/** Las rutas del escaparate, que se sirven sin token y solo por slug. */
describe("PublicProfilesController", () => {
  let controller: PublicProfilesController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findBySlug: jest.fn().mockResolvedValue({ slug: "spa-aurora" }),
      findProfessionalBySlug: jest.fn().mockResolvedValue({ slug: "ana" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PublicProfilesController],
      providers: [{ provide: BusinessProfilesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PublicProfilesController);
  });

  it("sirve el perfil del negocio por su slug", async () => {
    expect(await controller.findBySlug("spa-aurora")).toEqual({
      slug: "spa-aurora",
    });
    expect(service.findBySlug).toHaveBeenCalledWith("spa-aurora");
  });

  it("sirve el del profesional dentro de ese negocio", async () => {
    await controller.findProfessionalBySlug("spa-aurora", "ana");

    expect(service.findProfessionalBySlug).toHaveBeenCalledWith(
      "spa-aurora",
      "ana"
    );
  });
});
