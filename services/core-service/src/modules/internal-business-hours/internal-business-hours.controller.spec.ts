import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InternalBusinessHoursController } from "./internal-business-hours.controller";
import { BusinessHours } from "../../entities/business-hours.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";

describe("InternalBusinessHoursController", () => {
  let controller: InternalBusinessHoursController;
  let mockRepo: jest.Mocked<any>;

  beforeEach(async () => {
    mockRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalBusinessHoursController],
      providers: [
        { provide: getRepositoryToken(BusinessHours), useValue: mockRepo },
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
});
