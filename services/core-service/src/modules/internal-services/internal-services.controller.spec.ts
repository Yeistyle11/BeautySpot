import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException } from "@nestjs/common";
import { InternalServicesController } from "./internal-services.controller";
import { Service } from "../../entities/service.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CORTE = "22222222-2222-4222-8222-222222222222";
const BARBA = "33333333-3333-4333-8333-333333333333";
const PROFESIONAL = "44444444-4444-4444-8444-444444444444";

describe("InternalServicesController", () => {
  let controller: InternalServicesController;
  let mockServiceRepo: jest.Mocked<any>;
  let mockProfessionalServiceRepo: jest.Mocked<any>;

  const corte = { id: CORTE, name: "Corte", price: 30000, duration: 45 };
  const barba = { id: BARBA, name: "Barba", price: 15000, duration: 20 };

  beforeEach(async () => {
    mockServiceRepo = { find: jest.fn().mockResolvedValue([corte]) } as any;
    mockProfessionalServiceRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalServicesController],
      providers: [
        { provide: getRepositoryToken(Service), useValue: mockServiceRepo },
        {
          provide: getRepositoryToken(ProfessionalService),
          useValue: mockProfessionalServiceRepo,
        },
      ],
    }).compile();

    controller = module.get<InternalServicesController>(
      InternalServicesController
    );
  });

  it("devuelve el precio y la duración del catálogo", async () => {
    const resuelto = await controller.resolve({
      businessId: NEGOCIO,
      ids: [CORTE],
    });

    expect(resuelto).toEqual([
      { id: CORTE, name: "Corte", price: 30000, duration: 45 },
    ]);
  });

  it("solo busca servicios activos del negocio pedido", async () => {
    await controller.resolve({ businessId: NEGOCIO, ids: [CORTE] });

    expect(mockServiceRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ businessId: NEGOCIO, active: true }),
    });
  });

  it("rechaza los ids que no son del negocio, no existen o están inactivos", async () => {
    mockServiceRepo.find.mockResolvedValue([corte]);

    await expect(
      controller.resolve({ businessId: NEGOCIO, ids: [CORTE, BARBA] })
    ).rejects.toThrow(BadRequestException);
  });

  it("no cuenta dos veces un id repetido", async () => {
    mockServiceRepo.find.mockResolvedValue([corte]);

    await expect(
      controller.resolve({ businessId: NEGOCIO, ids: [CORTE, CORTE] })
    ).resolves.toHaveLength(1);
  });

  it("aplica el precio y la duración propios del profesional", async () => {
    mockServiceRepo.find.mockResolvedValue([corte, barba]);
    mockProfessionalServiceRepo.find.mockResolvedValue([
      { serviceId: CORTE, customPrice: 50000, customDuration: 60 },
    ]);

    const resuelto = await controller.resolve({
      businessId: NEGOCIO,
      ids: [CORTE, BARBA],
      professionalId: PROFESIONAL,
    });

    expect(resuelto).toEqual([
      { id: CORTE, name: "Corte", price: 50000, duration: 60 },
      { id: BARBA, name: "Barba", price: 15000, duration: 20 },
    ]);
  });

  it("cae al precio del catálogo cuando el profesional no tiene uno propio", async () => {
    mockProfessionalServiceRepo.find.mockResolvedValue([
      { serviceId: CORTE, customPrice: null, customDuration: null },
    ]);

    const resuelto = await controller.resolve({
      businessId: NEGOCIO,
      ids: [CORTE],
      professionalId: PROFESIONAL,
    });

    expect(resuelto[0]).toMatchObject({ price: 30000, duration: 45 });
  });

  it("no consulta los precios propios si no viene profesional", async () => {
    await controller.resolve({ businessId: NEGOCIO, ids: [CORTE] });

    expect(mockProfessionalServiceRepo.find).not.toHaveBeenCalled();
  });
});
