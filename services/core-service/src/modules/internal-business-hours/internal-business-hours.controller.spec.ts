import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InternalBusinessHoursController } from "./internal-business-hours.controller";
import { BusinessHours } from "../../entities/business-hours.entity";
import { SpecialDaysService } from "../business-hours/special-days.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
/** Un miércoles, que es el día 3 del horario del fixture. */
const MIERCOLES = "2026-08-19";

describe("InternalBusinessHoursController", () => {
  let controller: InternalBusinessHoursController;
  let mockRepo: jest.Mocked<any>;
  let especiales: { delDia: jest.Mock };

  beforeEach(async () => {
    mockRepo = { find: jest.fn().mockResolvedValue([]) } as any;
    especiales = { delDia: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalBusinessHoursController],
      providers: [
        { provide: getRepositoryToken(BusinessHours), useValue: mockRepo },
        { provide: SpecialDaysService, useValue: especiales },
      ],
    }).compile();

    controller = module.get<InternalBusinessHoursController>(
      InternalBusinessHoursController
    );
  });

  it("devuelve los tramos del negocio con el contrato que espera booking", async () => {
    mockRepo.find.mockResolvedValue([
      { dayOfWeek: 3, openTime: "09:00", closeTime: "13:00", active: true },
      { dayOfWeek: 3, openTime: "15:00", closeTime: "19:00", active: true },
    ]);

    await expect(controller.delNegocio(NEGOCIO)).resolves.toEqual([
      { dayOfWeek: 3, openTime: "09:00", closeTime: "13:00" },
      { dayOfWeek: 3, openTime: "15:00", closeTime: "19:00" },
    ]);
  });

  it("solo devuelve los tramos activos del negocio pedido", async () => {
    await controller.delNegocio(NEGOCIO);

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { businessId: NEGOCIO, active: true },
      order: { dayOfWeek: "ASC", openTime: "ASC" },
    });
  });

  // Quien lo consume distingue "sin horario configurado" de "cerrado", así que
  // la lista vacía tiene que llegar tal cual y no convertirse en otra cosa.
  it("devuelve una lista vacía si el negocio no tiene horario", async () => {
    await expect(controller.delNegocio(NEGOCIO)).resolves.toEqual([]);
  });

  describe("apertura de una fecha", () => {
    beforeEach(() => {
      mockRepo.find.mockResolvedValue([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "19:00", active: true },
        { dayOfWeek: 4, openTime: "09:00", closeTime: "19:00", active: true },
      ]);
    });

    it("resuelve por el horario de ese día de la semana", async () => {
      await expect(controller.delDia(NEGOCIO, MIERCOLES)).resolves.toEqual({
        tramos: [{ openTime: "09:00", closeTime: "19:00" }],
        origen: "semanal",
        configurado: true,
      });
    });

    it("cierra el día declarado como festivo", async () => {
      especiales.delDia.mockResolvedValue({
        closed: true,
        openTime: null,
        closeTime: null,
        motivo: "20 de julio",
      });

      await expect(controller.delDia(NEGOCIO, MIERCOLES)).resolves.toEqual({
        tramos: [],
        origen: "especial",
        configurado: true,
        motivo: "20 de julio",
      });
    });

    it("aplica el horario propio del día especial, y no el de la semana", async () => {
      especiales.delDia.mockResolvedValue({
        closed: false,
        openTime: "09:00",
        closeTime: "14:00",
        motivo: "Nochebuena",
      });

      await expect(
        controller.delDia(NEGOCIO, MIERCOLES)
      ).resolves.toMatchObject({
        tramos: [{ openTime: "09:00", closeTime: "14:00" }],
        origen: "especial",
      });
    });

    it("dice que no hay horario configurado, que no es lo mismo que cerrado", async () => {
      mockRepo.find.mockResolvedValue([]);

      await expect(controller.delDia(NEGOCIO, MIERCOLES)).resolves.toEqual({
        tramos: [],
        origen: "semanal",
        configurado: false,
      });
    });

    it("pasa la sede al buscar el día especial", async () => {
      await controller.delDia(NEGOCIO, MIERCOLES, "sede-1");

      expect(especiales.delDia).toHaveBeenCalledWith(
        NEGOCIO,
        MIERCOLES,
        "sede-1"
      );
    });
  });
});
