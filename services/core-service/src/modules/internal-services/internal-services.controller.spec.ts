import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException } from "@nestjs/common";
import { InternalServicesController } from "./internal-services.controller";
import { Service } from "../../entities/service.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

const TINTE = "11111111-1111-4111-8111-111111111111";
const CORTE = "22222222-2222-4222-8222-222222222222";
const NEGOCIO = "33333333-3333-4333-8333-333333333333";
const PROFESIONAL = "44444444-4444-4444-8444-444444444444";

describe("InternalServicesController", () => {
  let controller: InternalServicesController;
  let mockServiceRepo: { find: jest.Mock };
  let mockProfessionalServiceRepo: { find: jest.Mock };

  const tinte = {
    id: TINTE,
    name: "Tinte",
    price: 120000,
    duration: 90,
    procesadoDesde: 20,
    procesadoMinutos: 40,
    bufferDespues: 10,
  } as Service;

  const corte = {
    id: CORTE,
    name: "Corte",
    price: 30000,
    duration: 30,
    procesadoDesde: null,
    procesadoMinutos: null,
    bufferDespues: 0,
  } as Service;

  beforeEach(async () => {
    // Postgres devuelve las filas en el orden que quiere, no en el de los ids.
    mockServiceRepo = { find: jest.fn().mockResolvedValue([corte, tinte]) };
    mockProfessionalServiceRepo = { find: jest.fn().mockResolvedValue([]) };

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

  it("responde en el orden en que se pidieron los servicios", async () => {
    const resueltos = await controller.resolve({
      businessId: NEGOCIO,
      ids: [TINTE, CORTE],
    });

    expect(resueltos.map((s) => s.id)).toEqual([TINTE, CORTE]);
  });

  it("lleva el procesado y la limpieza a quien reserva", async () => {
    mockServiceRepo.find.mockResolvedValue([tinte]);

    const [resuelto] = await controller.resolve({
      businessId: NEGOCIO,
      ids: [TINTE],
    });

    expect(resuelto).toMatchObject({
      procesadoDesde: 20,
      procesadoMinutos: 40,
      bufferDespues: 10,
    });
  });

  it("descarta el procesado si el profesional acorta el servicio", async () => {
    // Con 50 minutos, la ventana 20+40 no cabe.
    mockServiceRepo.find.mockResolvedValue([tinte]);
    mockProfessionalServiceRepo.find.mockResolvedValue([
      { serviceId: TINTE, customDuration: 50, customPrice: null },
    ]);

    const [resuelto] = await controller.resolve({
      businessId: NEGOCIO,
      ids: [TINTE],
      professionalId: PROFESIONAL,
    });

    expect(resuelto.duration).toBe(50);
    expect(resuelto.procesadoDesde).toBeNull();
    expect(resuelto.procesadoMinutos).toBeNull();
  });

  it("rechaza si algún servicio no es del negocio", async () => {
    mockServiceRepo.find.mockResolvedValue([corte]);

    await expect(
      controller.resolve({ businessId: NEGOCIO, ids: [TINTE, CORTE] })
    ).rejects.toThrow(BadRequestException);
  });
});
