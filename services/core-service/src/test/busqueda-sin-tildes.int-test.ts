import { DataSource, Repository } from "typeorm";
import { contieneTexto, paginate } from "@beautyspot/database";
import { entities } from "../orm-entities";
import { Business } from "../entities/business.entity";
import { Client } from "../entities/client.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PAGINA = {
  page: 1,
  limit: 20,
  offset: 0,
  sort: "name",
  order: "ASC" as const,
};

/**
 * Comprueba contra Postgres real que la condición de búsqueda que usan los
 * listados encuentra lo mismo con tildes y sin ellas (`npm run test:int`).
 */
describe("Integración: la búsqueda no distingue tildes", () => {
  let dataSource: DataSource;
  let clientes: Repository<Client>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();
    clientes = dataSource.getRepository(Client);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "clients", "businesses" CASCADE');
    await dataSource.getRepository(Business).save({
      id: NEGOCIO,
      name: "Salón de prueba",
      slug: "salon-de-prueba",
      timezone: "America/Bogota",
    });
    await clientes.save([
      { businessId: NEGOCIO, name: "Carlos Pérez", active: true },
      { businessId: NEGOCIO, name: "Ana Muñoz", active: true },
      { businessId: NEGOCIO, name: "Sofía Gómez", active: true },
    ]);
  });

  /** Nombres que devuelve el listado paginado buscando ese texto. */
  const buscar = async (texto: string): Promise<string[]> => {
    const pagina = await paginate(clientes, PAGINA, {
      where: { businessId: NEGOCIO, active: true, name: contieneTexto(texto) },
    });
    return pagina.data.map((c) => c.name);
  };

  it("encuentra a Pérez escribiendo Perez", async () => {
    expect(await buscar("Perez")).toEqual(["Carlos Pérez"]);
  });

  it("encuentra a Perez escribiendo Pérez", async () => {
    expect(await buscar("Pérez")).toEqual(["Carlos Pérez"]);
  });

  it("ignora también las mayúsculas", async () => {
    expect(await buscar("SOFIA")).toEqual(["Sofía Gómez"]);
  });

  it("conserva la eñe, que distingue palabras", async () => {
    expect(await buscar("muñoz")).toEqual(["Ana Muñoz"]);
    expect(await buscar("munoz")).toEqual([]);
  });

  it("trata los comodines como texto tecleado", async () => {
    expect(await buscar("%")).toEqual([]);
  });
});
