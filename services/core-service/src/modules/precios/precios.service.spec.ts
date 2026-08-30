import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In, Not, IsNull } from "typeorm";
import { PreciosService } from "./precios.service";
import { ProfessionalService } from "../../entities/professional-service.entity";
import { Service } from "../../entities/service.entity";

/** Servicio del catálogo: media hora por veinte mil. */
const corte = {
  id: "svc-1",
  name: "Corte",
  price: 20000,
  duration: 30,
  procesadoDesde: null,
  procesadoMinutos: null,
  bufferDespues: 0,
} as unknown as Service;

/** Tinte con ventana de procesado: el profesional queda libre del 20 al 50. */
const tinte = {
  id: "svc-2",
  name: "Tinte completo",
  price: 90000,
  duration: 60,
  procesadoDesde: 20,
  procesadoMinutos: 30,
  bufferDespues: 10,
} as unknown as Service;

describe("PreciosService", () => {
  let service: PreciosService;
  let mockRepo: jest.Mocked<{ find: jest.Mock }>;

  beforeEach(async () => {
    mockRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreciosService,
        {
          provide: getRepositoryToken(ProfessionalService),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get(PreciosService);
  });

  describe("resolver", () => {
    it("sin tarifa propia manda el catálogo", () => {
      expect(service.resolver(corte)).toMatchObject({
        price: 20000,
        duration: 30,
      });
    });

    it("la tarifa del profesional pisa el precio y la duración", () => {
      const propia = {
        customPrice: 45000,
        customDuration: 45,
      } as ProfessionalService;

      expect(service.resolver(corte, propia)).toMatchObject({
        price: 45000,
        duration: 45,
      });
    });

    // Las columnas son nullable aunque el tipo diga `number`: una tarifa que
    // solo cambia el precio no puede llevarse por delante la duración.
    it("una tarifa a medias solo pisa lo que trae", () => {
      const soloPrecio = {
        customPrice: 45000,
        customDuration: null,
      } as unknown as ProfessionalService;

      expect(service.resolver(corte, soloPrecio)).toMatchObject({
        price: 45000,
        duration: 30,
      });
    });

    it("conserva la ventana de procesado si sigue cabiendo", () => {
      expect(service.resolver(tinte)).toMatchObject({
        procesadoDesde: 20,
        procesadoMinutos: 30,
        bufferDespues: 10,
      });
    });

    // Con una duración propia más corta, la ventana ya no cabe: propagarla
    // dejaría al profesional libre después del final de su propia cita.
    it("descarta la ventana que no cabe en la duración propia", () => {
      const masCorto = {
        customPrice: null,
        customDuration: 40,
      } as unknown as ProfessionalService;

      expect(service.resolver(tinte, masCorto)).toMatchObject({
        duration: 40,
        procesadoDesde: null,
        procesadoMinutos: null,
      });
    });
  });

  describe("tarifasDe", () => {
    it("indexa por servicio las del profesional", async () => {
      mockRepo.find.mockResolvedValue([
        { serviceId: "svc-1", customPrice: 45000 },
      ]);

      const tarifas = await service.tarifasDe(["svc-1", "svc-2"], "pro-1");

      expect(tarifas.get("svc-1")).toMatchObject({ customPrice: 45000 });
      expect(tarifas.get("svc-2")).toBeUndefined();
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { professionalId: "pro-1", serviceId: In(["svc-1", "svc-2"]) },
      });
    });

    it("sin profesional no consulta nada", async () => {
      expect(await service.tarifasDe(["svc-1"])).toEqual(new Map());
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it("sin servicios tampoco", async () => {
      expect(await service.tarifasDe([], "pro-1")).toEqual(new Map());
      expect(mockRepo.find).not.toHaveBeenCalled();
    });
  });

  describe("idsConTarifaPropia", () => {
    it("señala los servicios que alguien cobra o dura distinto", async () => {
      mockRepo.find.mockResolvedValue([{ serviceId: "svc-2" }]);

      const variables = await service.idsConTarifaPropia(["svc-1", "svc-2"]);

      expect(variables.has("svc-2")).toBe(true);
      expect(variables.has("svc-1")).toBe(false);
    });

    it("mira tanto el precio propio como la duración propia", async () => {
      await service.idsConTarifaPropia(["svc-1"]);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: [
          { serviceId: In(["svc-1"]), customPrice: Not(IsNull()) },
          { serviceId: In(["svc-1"]), customDuration: Not(IsNull()) },
        ],
        select: ["serviceId"],
      });
    });

    it("sin servicios no consulta nada", async () => {
      expect(await service.idsConTarifaPropia([])).toEqual(new Set());
      expect(mockRepo.find).not.toHaveBeenCalled();
    });
  });
});
