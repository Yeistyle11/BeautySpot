import { ConflictException, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import {
  CatalogoTenantService,
  EntidadDeCatalogo,
} from "./catalogo-tenant.service";

interface Categoria extends EntidadDeCatalogo {
  color?: string;
}

/** Subclase mínima, como las que hay en los servicios de dominio. */
class CategoriasService extends CatalogoTenantService<Categoria> {
  constructor(repo: Repository<Categoria>) {
    super(repo, { singular: "Categoría", conArticulo: "La categoría" });
  }
}

describe("CatalogoTenantService", () => {
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    findAndCount: jest.Mock;
    manager: { transaction: jest.Mock };
    target: string;
  };
  let service: CategoriasService;
  let repoDeLaTransaccion: { update: jest.Mock };

  const categoria: Categoria = {
    id: "cat-1",
    businessId: "negocio-1",
    name: "Color",
    sortOrder: 1,
    active: true,
  };

  beforeEach(() => {
    repoDeLaTransaccion = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entidad) => entidad),
      find: jest.fn().mockResolvedValue([categoria]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findAndCount: jest.fn().mockResolvedValue([[categoria], 1]),
      manager: {
        transaction: jest.fn(async (cb) =>
          cb({ getRepository: () => repoDeLaTransaccion })
        ),
      },
      target: "categorias",
    };
    service = new CategoriasService(repo as unknown as Repository<Categoria>);
  });

  describe("create", () => {
    it("guarda el elemento dentro del negocio", async () => {
      const creado = await service.create("negocio-1", { name: "Corte" });

      expect(creado).toMatchObject({ name: "Corte", businessId: "negocio-1" });
    });

    it("rechaza un nombre que ya usa otro del mismo negocio", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await expect(
        service.create("negocio-1", { name: "Color" })
      ).rejects.toThrow(ConflictException);
    });

    it("si el que choca está desactivado, dice que se reactive", async () => {
      repo.findOne.mockResolvedValue({ ...categoria, active: false });

      await expect(
        service.create("negocio-1", { name: "Color" })
      ).rejects.toThrow(/desactivada/);
    });
  });

  describe("findByBusiness", () => {
    it("lista solo los activos y en su orden", async () => {
      await service.findByBusiness("negocio-1");

      expect(repo.find).toHaveBeenCalledWith({
        where: { businessId: "negocio-1", active: true },
        order: { sortOrder: "ASC", name: "ASC" },
      });
    });

    it("incluye los desactivados cuando se piden", async () => {
      await service.findByBusiness("negocio-1", false);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: "negocio-1" } })
      );
    });
  });

  describe("findPaginated", () => {
    const params = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "createdAt",
      order: "DESC" as const,
    };

    it("devuelve la página con su metadata", async () => {
      const pagina = await service.findPaginated("negocio-1", params);

      expect(pagina.data).toEqual([categoria]);
      expect(pagina.meta.total).toBe(1);
    });

    it("busca por nombre sin distinguir tildes ni mayúsculas", async () => {
      await service.findPaginated("negocio-1", params, true, "coloracion");

      const opciones = repo.findAndCount.mock.calls[0][0];
      expect(opciones.where).toHaveProperty("name");
      expect(opciones.where.active).toBe(true);
    });
  });

  describe("findById", () => {
    it("acota la búsqueda al negocio", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await expect(service.findById("cat-1", "negocio-1")).resolves.toEqual(
        categoria
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "cat-1", businessId: "negocio-1" },
      });
    });

    it("lanza 404 con el nombre del catálogo", async () => {
      await expect(service.findById("cat-1", "negocio-1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("update", () => {
    it("comprueba el nombre solo cuando cambia", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await service.update("cat-1", "negocio-1", { sortOrder: 3 });

      expect(repo.update).toHaveBeenCalledWith(
        { id: "cat-1", businessId: "negocio-1" },
        { sortOrder: 3 }
      );
    });

    it("rechaza renombrarlo como otro que ya existe", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await expect(
        service.update("cat-1", "negocio-1", { name: "Otro" })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove", () => {
    it("da de baja sin borrar, para no perder lo que lo referencia", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await service.remove("cat-1", "negocio-1");

      expect(repo.update).toHaveBeenCalledWith(
        { id: "cat-1", businessId: "negocio-1" },
        { active: false }
      );
    });
  });

  describe("toggleActive", () => {
    it("invierte el estado que tenía", async () => {
      repo.findOne.mockResolvedValue(categoria);

      await service.toggleActive("cat-1", "negocio-1");

      expect(repo.update).toHaveBeenCalledWith(
        { id: "cat-1", businessId: "negocio-1" },
        { active: false }
      );
    });
  });

  describe("reorder", () => {
    it("no abre transacción si no hay nada que reordenar", async () => {
      await service.reorder("negocio-1", []);

      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it("aplica el orden de todos en la misma transacción", async () => {
      await service.reorder("negocio-1", [
        { id: "cat-1", sortOrder: 2 },
        { id: "cat-2", sortOrder: 1 },
      ]);

      expect(repoDeLaTransaccion.update).toHaveBeenCalledTimes(2);
    });

    it("un id de otro negocio corta la reordenación entera", async () => {
      repoDeLaTransaccion.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.reorder("negocio-1", [{ id: "ajeno", sortOrder: 1 }])
      ).rejects.toThrow(NotFoundException);
    });
  });
});
