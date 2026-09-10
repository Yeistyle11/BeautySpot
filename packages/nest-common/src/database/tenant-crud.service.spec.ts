import { ConflictException, NotFoundException } from "@nestjs/common";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";
import { Repository } from "typeorm";
import { TenantCrudService, EntidadDeNegocio } from "./tenant-crud.service";

interface Sede extends EntidadDeNegocio {
  name: string;
}

/** Subclase mínima, como las que hay en los servicios de dominio. */
class SedesService extends TenantCrudService<Sede> {
  constructor(repo: Repository<Sede>) {
    super(repo, "Sucursal no encontrada");
  }
}

describe("TenantCrudService", () => {
  let repo: {
    findOne: jest.Mock;
    update: jest.Mock;
    target: string;
    manager: { transaction: jest.Mock };
  };
  /** El repositorio que la escritura condicional usa dentro de la transacción. */
  let enTransaccion: { findOne: jest.Mock; update: jest.Mock };
  let service: SedesService;

  const CARGADA = new Date("2026-08-31T10:00:00.000Z");

  const sede: Sede = {
    id: "sede-1",
    businessId: "negocio-1",
    name: "Centro",
    active: true,
    updatedAt: CARGADA,
  };

  beforeEach(() => {
    enTransaccion = {
      findOne: jest.fn().mockResolvedValue(sede),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      target: "Sede",
      manager: {
        transaction: jest.fn(
          (cb: (manager: { getRepository: jest.Mock }) => unknown) =>
            cb({ getRepository: jest.fn().mockReturnValue(enTransaccion) })
        ),
      },
    };
    service = new SedesService(repo as unknown as Repository<Sede>);
  });

  describe("findById", () => {
    it("acota la búsqueda al negocio", async () => {
      repo.findOne.mockResolvedValue(sede);

      await expect(service.findById("sede-1", "negocio-1")).resolves.toEqual(
        sede
      );
      // El businessId lo pone la clase base, no cada servicio.
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "sede-1", businessId: "negocio-1" },
      });
    });

    it("lanza 404 con el mensaje de la entidad", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById("sede-1", "negocio-1")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findById("sede-1", "negocio-1")).rejects.toThrow(
        "Sucursal no encontrada"
      );
    });

    it("no encuentra un elemento de otro negocio", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById("sede-1", "otro-negocio")).rejects.toThrow(
        NotFoundException
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "sede-1", businessId: "otro-negocio" },
      });
    });
  });

  describe("update", () => {
    it("actualiza acotando al negocio y devuelve cómo queda", async () => {
      const actualizada = { ...sede, name: "Norte" };
      repo.findOne.mockResolvedValue(actualizada);

      await expect(
        service.update("sede-1", "negocio-1", { name: "Norte" })
      ).resolves.toEqual(actualizada);
      expect(repo.update).toHaveBeenCalledWith(
        { id: "sede-1", businessId: "negocio-1" },
        { name: "Norte" }
      );
    });

    it("lanza 404 si el elemento no es del negocio", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update("sede-1", "otro-negocio", { name: "Norte" })
      ).rejects.toThrow(NotFoundException);
    });

    it("sin versión esperada escribe sin leer antes", async () => {
      repo.findOne.mockResolvedValue(sede);

      await service.update("sede-1", "negocio-1", { name: "Norte" });

      // La ruta de siempre no abre transacción ni bloquea la fila.
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe("update con versión esperada", () => {
    it("escribe si la fila sigue como se cargó", async () => {
      const actualizada = { ...sede, name: "Norte" };
      enTransaccion.findOne
        .mockResolvedValueOnce(sede)
        .mockResolvedValueOnce(actualizada);

      await expect(
        service.update("sede-1", "negocio-1", { name: "Norte" }, CARGADA)
      ).resolves.toEqual(actualizada);
      expect(enTransaccion.update).toHaveBeenCalledWith(
        { id: "sede-1", businessId: "negocio-1" },
        { name: "Norte" }
      );
    });

    it("bloquea la fila entre el cotejo y la escritura", async () => {
      enTransaccion.findOne.mockResolvedValue(sede);

      await service.update("sede-1", "negocio-1", { name: "Norte" }, CARGADA);

      expect(enTransaccion.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: "sede-1", businessId: "negocio-1" },
        lock: { mode: "pessimistic_write" },
      });
    });

    it("rechaza con 409 si otra persona guardó mientras tanto", async () => {
      enTransaccion.findOne.mockResolvedValue({
        ...sede,
        updatedAt: new Date("2026-08-31T10:05:00.000Z"),
      });

      await expect(
        service.update("sede-1", "negocio-1", { name: "Norte" }, CARGADA)
      ).rejects.toThrow(ConflictException);
      expect(enTransaccion.update).not.toHaveBeenCalled();
    });

    it("el 409 lleva su propio código, para no confundirlo con el de un dato repetido", async () => {
      enTransaccion.findOne.mockResolvedValue({
        ...sede,
        updatedAt: new Date("2026-08-31T10:05:00.000Z"),
      });

      const error = await service
        .update("sede-1", "negocio-1", { name: "Norte" }, CARGADA)
        .catch((e: ConflictException) => e);

      expect((error as ConflictException).getResponse()).toEqual({
        error: {
          code: CODIGO_EDICION_SIMULTANEA,
          message: expect.stringContaining("Otra persona guardó cambios"),
        },
      });
    });

    it("una fila que ya no existe sigue siendo un 404, no un conflicto", async () => {
      enTransaccion.findOne.mockResolvedValue(null);

      await expect(
        service.update("sede-1", "negocio-1", { name: "Norte" }, CARGADA)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deactivate", () => {
    it("da de baja sin borrar", async () => {
      await service.deactivate("sede-1", "negocio-1");

      expect(repo.update).toHaveBeenCalledWith(
        { id: "sede-1", businessId: "negocio-1" },
        { active: false }
      );
    });
  });
});
