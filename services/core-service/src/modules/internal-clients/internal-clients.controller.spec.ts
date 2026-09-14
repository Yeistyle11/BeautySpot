import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConflictException } from "@nestjs/common";
import { FindOperator } from "typeorm";
import { InternalClientsController } from "./internal-clients.controller";
import { Client } from "../../entities/client.entity";
import { ClientsService } from "../clients/clients.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const ATACANTE = "22222222-2222-4222-8222-222222222222";
const VICTIMA = "33333333-3333-4333-8333-333333333333";

const CORREO_VICTIMA = "victima@ejemplo.com";
const CORREO_ATACANTE = "atacante@ejemplo.com";
const TELEFONO_VICTIMA = "+573200000000";

/** Ficha de la víctima: tiene contacto pero todavía no tiene dueño. */
const fichaSinDuenno = (): Partial<Client> => ({
  id: "ficha-victima",
  businessId: NEGOCIO,
  name: "Victima",
  email: CORREO_VICTIMA,
  phone: TELEFONO_VICTIMA,
  userId: null,
});

/** Valor de un `where` que puede venir suelto o dentro de un `In(...)`. */
const casa = (condicion: unknown, valor: unknown): boolean => {
  if (!(condicion instanceof FindOperator)) return condicion === valor;

  if (condicion.type === "in") {
    return (condicion.value as unknown[]).includes(valor);
  }
  // `ILike("%texto%")`: el patrón suelto, sin comodines, contra el valor.
  const patron = String(condicion.value).replace(/%/g, "").toLowerCase();
  return String(valor ?? "")
    .toLowerCase()
    .includes(patron);
};

describe("InternalClientsController", () => {
  let controller: InternalClientsController;
  let mockClientRepo: jest.Mocked<any>;
  let mockClients: jest.Mocked<any>;
  let tabla: Partial<Client>[];

  beforeEach(async () => {
    tabla = [];
    mockClients = {
      resolverFichaDeReserva: jest.fn().mockResolvedValue({ id: "ficha" }),
      redeemLoyaltyPoints: jest.fn().mockResolvedValue(true),
      addLoyaltyPoints: jest.fn().mockResolvedValue(undefined),
    } as any;

    const filtrar = (where: any): Partial<Client>[] => {
      const condiciones = Array.isArray(where) ? where : [where];
      return tabla.filter((fila) =>
        condiciones.some((cond) =>
          Object.entries(cond).every(([campo, valor]) =>
            casa(valor, (fila as any)[campo])
          )
        )
      );
    };

    mockClientRepo = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(filtrar(where)[0] ?? null)
      ),
      find: jest.fn(({ where }: any) => Promise.resolve(filtrar(where))),
      save: jest.fn((c: Partial<Client>) => Promise.resolve(c)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalClientsController],
      providers: [
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: ClientsService, useValue: mockClients },
      ],
    }).compile();

    controller = module.get<InternalClientsController>(
      InternalClientsController
    );
  });

  describe("find-or-create", () => {
    // La resolucion vive en ClientsService, que es quien tiene la transaccion
    // y el outbox; aqui solo se comprueba que el controlador no la reimplementa.
    it("delega la resolución de la ficha en ClientsService", async () => {
      const dto = {
        businessId: NEGOCIO,
        name: "Quien reserva",
        email: "escrito@ejemplo.com",
        userId: ATACANTE,
        userEmail: CORREO_ATACANTE,
      };

      await expect(controller.findOrCreate(dto)).resolves.toEqual({
        id: "ficha",
      });
      expect(mockClients.resolverFichaDeReserva).toHaveBeenCalledWith(dto);
    });
  });

  describe("puntos de fidelidad", () => {
    const conPuntos = () => {
      tabla.push({ ...fichaSinDuenno(), id: "ficha", loyaltyPoints: 120 });
    };

    it("devuelve el saldo del cliente del negocio", async () => {
      conPuntos();
      await expect(controller.puntos("ficha", NEGOCIO)).resolves.toEqual({
        loyaltyPoints: 120,
      });
    });

    it("responde nulo si la ficha no es de ese negocio", async () => {
      conPuntos();
      await expect(
        controller.puntos("ficha", "otro-negocio")
      ).resolves.toBeNull();
    });

    it("descuenta y responde el saldo que queda", async () => {
      conPuntos();
      const saldo = await controller.reservarPuntos("ficha", {
        businessId: NEGOCIO,
        puntos: 20,
      });

      expect(mockClients.redeemLoyaltyPoints).toHaveBeenCalledWith(
        "ficha",
        NEGOCIO,
        20
      );
      expect(saldo).toEqual({ loyaltyPoints: 120 });
    });

    // Quien cobra necesita el 409 antes de aplicar el descuento, no despues.
    it("responde 409 cuando no le alcanzan los puntos", async () => {
      conPuntos();
      mockClients.redeemLoyaltyPoints.mockResolvedValue(false);

      await expect(
        controller.reservarPuntos("ficha", { businessId: NEGOCIO, puntos: 999 })
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("devuelve los puntos de un cobro que no llego a registrarse", async () => {
      conPuntos();
      await controller.devolverPuntos("ficha", {
        businessId: NEGOCIO,
        puntos: 20,
      });

      expect(mockClients.addLoyaltyPoints).toHaveBeenCalledWith(
        "ficha",
        NEGOCIO,
        20
      );
    });

    it("da saldo cero si la ficha desaparecio tras el movimiento", async () => {
      await expect(
        controller.devolverPuntos("ficha", { businessId: NEGOCIO, puntos: 5 })
      ).resolves.toEqual({ loyaltyPoints: 0 });
    });
  });

  describe("consultas que usan los otros servicios", () => {
    beforeEach(() => {
      tabla.push(
        { ...fichaSinDuenno(), id: "a", name: "Ana Gomez", userId: VICTIMA },
        {
          ...fichaSinDuenno(),
          id: "b",
          name: "Beto Ruiz",
          email: "beto@ejemplo.com",
          phone: "+573211111111",
        }
      );
    });

    it("resuelve los nombres pedidos dentro del negocio", async () => {
      const nombres = await controller.names(NEGOCIO, " a , b ");
      expect(nombres.map((n) => n.id)).toEqual(["a", "b"]);
    });

    it("no resuelve nombres sin negocio ni sin ids", async () => {
      await expect(controller.names("", "a")).resolves.toEqual([]);
      await expect(controller.names(NEGOCIO, "")).resolves.toEqual([]);
      await expect(controller.names(NEGOCIO)).resolves.toEqual([]);
    });

    it("lista las fichas de un usuario en todos sus negocios", async () => {
      const fichas = await controller.findByUser(VICTIMA);
      expect(fichas.map((f) => f.id)).toEqual(["a"]);
    });

    it("busca por nombre, correo o telefono", async () => {
      await expect(controller.search(NEGOCIO, "gomez")).resolves.toEqual(["a"]);
      await expect(controller.search(NEGOCIO, "beto@")).resolves.toEqual(["b"]);
      await expect(controller.search(NEGOCIO, "3211111111")).resolves.toEqual([
        "b",
      ]);
    });

    it("no busca sin negocio ni con el texto en blanco", async () => {
      await expect(controller.search("", "ana")).resolves.toEqual([]);
      await expect(controller.search(NEGOCIO, "   ")).resolves.toEqual([]);
    });
  });
});
