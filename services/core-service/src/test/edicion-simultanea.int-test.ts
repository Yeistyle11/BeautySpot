import { ConflictException } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";
import { entities } from "../orm-entities";
import { Business } from "../entities/business.entity";
import { Service } from "../entities/service.entity";
import { ServiceCategoryEntity } from "../entities/service-category.entity";
import { ServicesService } from "../modules/services/services.service";
import { ServiceCategoriesService } from "../modules/service-categories/service-categories.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const SERVICIO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

/**
 * Comprueba contra Postgres real que guardar con una versión vieja se rechaza:
 * la marca sobrevive al viaje por la base —`timestamptz` guarda microsegundos y
 * el driver los da en milisegundos— (`npm run test:int`).
 */
describe("Integración: dos ediciones a la vez", () => {
  let dataSource: DataSource;
  let servicios: Repository<Service>;
  let service: ServicesService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();
    servicios = dataSource.getRepository(Service);
    service = new ServicesService(
      servicios,
      new ServiceCategoriesService(
        dataSource.getRepository(ServiceCategoryEntity)
      )
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "services", "businesses" CASCADE');
    await dataSource.getRepository(Business).save({
      id: NEGOCIO,
      name: "Salón de prueba",
      slug: "salon-de-prueba",
      timezone: "America/Bogota",
    });
    await servicios.save({
      id: SERVICIO,
      businessId: NEGOCIO,
      name: "Corte",
      description: "",
      category: "",
      price: 40000,
      duration: 30,
    });
  });

  /** La versión que vería quien abre el formulario ahora mismo. */
  const versionActual = async (): Promise<Date> =>
    (await service.findById(SERVICIO, NEGOCIO)).updatedAt;

  it("guarda cuando el servicio sigue como se cargó", async () => {
    const cargada = await versionActual();

    const guardado = await service.update(
      SERVICIO,
      NEGOCIO,
      { price: 45000 },
      cargada
    );

    expect(guardado.price).toBe(45000);
  });

  it("avisa en vez de pisar el precio que otra persona acaba de guardar", async () => {
    const cargada = await versionActual();
    // La otra pestaña, que guardó primero.
    await service.update(SERVICIO, NEGOCIO, { price: 50000 }, cargada);

    const error = await service
      .update(SERVICIO, NEGOCIO, { duration: 45 }, cargada)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: { code: CODIGO_EDICION_SIMULTANEA },
    });
    // Y el precio de la otra persona sigue en pie.
    const enBase = await service.findById(SERVICIO, NEGOCIO);
    expect(enBase.price).toBe(50000);
    expect(enBase.duration).toBe(30);
  });

  it("guardar dos veces seguidas desde el mismo sitio no choca consigo mismo", async () => {
    const primera = await service.update(
      SERVICIO,
      NEGOCIO,
      { price: 45000 },
      await versionActual()
    );

    // La respuesta trae la versión nueva, que es con la que sigue el formulario.
    await expect(
      service.update(SERVICIO, NEGOCIO, { price: 47000 }, primera.updatedAt)
    ).resolves.toMatchObject({ price: 47000 });
  });

  it("sin versión esperada se guarda como siempre", async () => {
    await expect(
      service.update(SERVICIO, NEGOCIO, { price: 45000 })
    ).resolves.toMatchObject({ price: 45000 });
  });
});
