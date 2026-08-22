import { DataSource, Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { entities } from "../orm-entities";
import { Business } from "../entities/business.entity";
import { ProfessionalCategoryEntity } from "../entities/category.entity";
import { CategoriesService } from "../modules/categories/categories.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const OTRO_NEGOCIO = "22222222-2222-4222-8222-222222222222";

/**
 * Comprueba contra Postgres real que reordenar un catálogo escribe el orden
 * pedido en una sola sentencia y que no toca lo que es de otro negocio
 * (`npm run test:int`). El test unitario solo puede mirar el SQL generado.
 */
describe("Integración: reordenar un catálogo", () => {
  let dataSource: DataSource;
  let categorias: Repository<ProfessionalCategoryEntity>;
  let service: CategoriesService;

  const ids = {
    corte: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    color: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    barba: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    ajena: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();
    categorias = dataSource.getRepository(ProfessionalCategoryEntity);
    service = new CategoriesService(categorias);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "professional_categories", "businesses" CASCADE'
    );
    await dataSource.getRepository(Business).save([
      {
        id: NEGOCIO,
        name: "Salón de prueba",
        slug: "salon-de-prueba",
        timezone: "America/Bogota",
      },
      {
        id: OTRO_NEGOCIO,
        name: "Salón vecino",
        slug: "salon-vecino",
        timezone: "America/Bogota",
      },
    ]);
    await categorias.save([
      { id: ids.corte, businessId: NEGOCIO, name: "Corte", sortOrder: 1 },
      { id: ids.color, businessId: NEGOCIO, name: "Color", sortOrder: 2 },
      { id: ids.barba, businessId: NEGOCIO, name: "Barba", sortOrder: 3 },
      { id: ids.ajena, businessId: OTRO_NEGOCIO, name: "Ajena", sortOrder: 1 },
    ]);
  });

  /** Nombres del catálogo del negocio, en el orden en que se listan. */
  const enOrden = async (): Promise<string[]> => {
    const lista = await service.findByBusiness(NEGOCIO);
    return lista.map((c) => c.name);
  };

  it("deja el catálogo en el orden pedido", async () => {
    await service.reorder(NEGOCIO, [
      { id: ids.barba, sortOrder: 1 },
      { id: ids.corte, sortOrder: 2 },
      { id: ids.color, sortOrder: 3 },
    ]);

    expect(await enOrden()).toEqual(["Barba", "Corte", "Color"]);
  });

  it("no toca el catálogo de otro negocio", async () => {
    await expect(
      service.reorder(NEGOCIO, [{ id: ids.ajena, sortOrder: 9 }])
    ).rejects.toThrow(NotFoundException);

    const ajena = await categorias.findOneByOrFail({ id: ids.ajena });
    expect(ajena.sortOrder).toBe(1);
  });

  it("un id ajeno en la lista deshace la reordenación entera", async () => {
    await expect(
      service.reorder(NEGOCIO, [
        { id: ids.barba, sortOrder: 1 },
        { id: ids.ajena, sortOrder: 2 },
      ])
    ).rejects.toThrow(NotFoundException);

    expect(await enOrden()).toEqual(["Corte", "Color", "Barba"]);
  });
});
