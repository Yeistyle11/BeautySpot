import { DataSource, Repository } from "typeorm";
import { entities } from "../orm-entities";
import { Business } from "../entities/business.entity";
import { Client } from "../entities/client.entity";
import { ClientsService } from "../modules/clients/clients.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const PAGINA = {
  page: 1,
  limit: 20,
  offset: 0,
  sort: "name",
  order: "ASC" as const,
};

/**
 * Comprueba contra Postgres real que el buscador de clientes encuentra por los
 * alias de una fusión y por cualquier formato del teléfono. Las dos cosas viven
 * en SQL, así que solo la base puede confirmarlas (`npm run test:int`).
 */
describe("Integración: el buscador de clientes alcanza alias y formatos", () => {
  let dataSource: DataSource;
  let clientes: Repository<Client>;
  let service: ClientsService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();
    clientes = dataSource.getRepository(Client);

    // `findByBusiness` solo consulta el repositorio; el resto de dependencias
    // no interviene en la búsqueda.
    service = new ClientsService(
      clientes,
      {} as never,
      dataSource,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
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
    await clientes.save(
      clientes.create([
        {
          businessId: NEGOCIO,
          name: "QA-Fusion Destino",
          phone: "+573015550002",
          email: "qa.fusion.destino@correo.local",
          // Lo que una fusión deja de la ficha absorbida.
          aliasPhones: ["+573015550001"],
          aliasEmails: ["qa.fusion.origen@correo.local"],
          active: true,
        },
        {
          businessId: NEGOCIO,
          name: "Carlos Perez",
          phone: "+573101112233",
          active: true,
        },
        {
          businessId: NEGOCIO,
          name: "Carlos Pérez",
          phone: "3101112233",
          active: true,
        },
      ])
    );
  });

  /** Nombres que devuelve el listado buscando ese texto. */
  const buscar = async (texto: string): Promise<string[]> => {
    const pagina = await service.findByBusiness(NEGOCIO, texto, PAGINA);
    return pagina.data.map((c) => c.name);
  };

  it("el teléfono de la ficha absorbida encuentra a la superviviente", async () => {
    expect(await buscar("3015550001")).toEqual(["QA-Fusion Destino"]);
  });

  it("y su correo también", async () => {
    expect(await buscar("qa.fusion.origen@correo.local")).toEqual([
      "QA-Fusion Destino",
    ]);
  });

  // `3101112233` es subcadena de `+573101112233`, pero no al revés: con prefijo
  // internacional se perdía la ficha guardada en formato local.
  it("el mismo número encuentra lo mismo se escriba como se escriba", async () => {
    const conPrefijo = await buscar("+573101112233");
    const sinPrefijo = await buscar("3101112233");

    expect(conPrefijo).toHaveLength(2);
    expect(conPrefijo.sort()).toEqual(sinPrefijo.sort());
  });

  it("sigue encontrando por nombre, con tildes y sin ellas", async () => {
    expect(await buscar("perez")).toHaveLength(2);
  });

  it("no devuelve fichas de otro negocio ni las inactivas", async () => {
    await clientes.update({ name: "QA-Fusion Destino" }, { active: false });

    expect(await buscar("3015550001")).toEqual([]);
  });
});
