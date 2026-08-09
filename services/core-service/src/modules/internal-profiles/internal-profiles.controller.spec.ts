import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  InternalProfilesController,
  CLAVE_FACTURACION,
  CLAVE_RESERVAS,
} from "./internal-profiles.controller";
import { Client } from "../../entities/client.entity";
import { Professional } from "../../entities/professional.entity";
import { Business } from "../../entities/business.entity";
import { BusinessConfig } from "../../entities/business-config.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";

describe("InternalProfilesController", () => {
  let controller: InternalProfilesController;
  let mockClientRepo: jest.Mocked<any>;
  let mockProfessionalRepo: jest.Mocked<any>;
  let mockBusinessRepo: jest.Mocked<any>;
  let mockConfigRepo: jest.Mocked<any>;

  const negocio = {
    name: "Salón Aurora",
    address: "Carrera 7 #12-34",
    phone: "+57 320 000 0000",
    email: "hola@aurora.co",
  };

  beforeEach(async () => {
    mockClientRepo = { findOne: jest.fn().mockResolvedValue(null) } as any;
    mockProfessionalRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as any;
    mockBusinessRepo = { findOne: jest.fn().mockResolvedValue(negocio) } as any;
    mockConfigRepo = { find: jest.fn().mockResolvedValue([]) } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalProfilesController],
      providers: [
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        {
          provide: getRepositoryToken(Professional),
          useValue: mockProfessionalRepo,
        },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        {
          provide: getRepositoryToken(BusinessConfig),
          useValue: mockConfigRepo,
        },
      ],
    }).compile();

    controller = module.get<InternalProfilesController>(
      InternalProfilesController
    );
  });

  it("devuelve los datos fiscales configurados por el negocio", async () => {
    mockConfigRepo.find.mockResolvedValue([
      {
        key: CLAVE_FACTURACION,
        value: { nit: "901555222-3", razonSocial: "Aurora Belleza S.A.S." },
      },
    ]);

    const { business } = await controller.resolve(
      undefined,
      undefined,
      NEGOCIO
    );

    expect(business).toMatchObject({
      name: "Salón Aurora",
      email: "hola@aurora.co",
      facturacion: { nit: "901555222-3" },
    });
  });

  it("devuelve las reglas de reserva configuradas por el negocio", async () => {
    mockConfigRepo.find.mockResolvedValue([
      { key: CLAVE_RESERVAS, value: { horasMinimasCancelacion: 24 } },
    ]);

    const { business } = await controller.resolve(
      undefined,
      undefined,
      NEGOCIO
    );

    expect(business?.reservas).toEqual({ horasMinimasCancelacion: 24 });
    // Cada ajuste llega por su clave, sin mezclarse con los demás.
    expect(business?.facturacion).toEqual({});
  });

  it("devuelve la facturación vacía si el negocio no la ha configurado", async () => {
    const { business } = await controller.resolve(
      undefined,
      undefined,
      NEGOCIO
    );

    expect(business?.facturacion).toEqual({});
  });

  it("devuelve el documento del cliente para identificarlo en la factura", async () => {
    mockClientRepo.findOne.mockResolvedValue({
      name: "Juan Pérez",
      email: "juan@example.com",
      phone: "+57 310 000 0000",
      documento: "1020304050",
      userId: null,
    });

    const { client } = await controller.resolve(CLIENTE);

    expect(client).toEqual({
      name: "Juan Pérez",
      email: "juan@example.com",
      phone: "+57 310 000 0000",
      documento: "1020304050",
      userId: null,
    });
  });

  it("deja el documento en blanco cuando el cliente no lo aportó", async () => {
    mockClientRepo.findOne.mockResolvedValue({
      name: "Invitada",
      email: null,
      phone: null,
      documento: null,
      userId: null,
    });

    const { client } = await controller.resolve(CLIENTE);

    expect(client).toMatchObject({ documento: "", email: "", phone: "" });
  });

  it("devuelve null para el negocio que no existe", async () => {
    mockBusinessRepo.findOne.mockResolvedValue(null);

    const { business } = await controller.resolve(
      undefined,
      undefined,
      NEGOCIO
    );

    expect(business).toBeNull();
  });
});
