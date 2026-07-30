import { NotFoundException } from "@nestjs/common";
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
  let repo: { findOne: jest.Mock; update: jest.Mock };
  let service: SedesService;

  const sede: Sede = {
    id: "sede-1",
    businessId: "negocio-1",
    name: "Centro",
    active: true,
  };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
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
