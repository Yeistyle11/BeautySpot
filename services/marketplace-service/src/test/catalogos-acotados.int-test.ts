import { DataSource } from "typeorm";
import { entities } from "../orm-entities";
import { ReviewStatus } from "../entities/review.entity";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const CITA = "33333333-3333-4333-8333-333333333333";
/** Código de error de Postgres para violación de CHECK. */
const CHECK_VIOLATION = "23514";

/**
 * Comprueba contra Postgres real que la visibilidad de una reseña y el motivo
 * de una denuncia siguen acotados por la base (`npm run test:int`).
 */
describe("Integración: la base acota los catálogos de reseñas", () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities,
      synchronize: true,
    });
    await dataSource.initialize();
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "reviews", "review_reports" CASCADE'
    );
  });

  /** Inserta una reseña saltándose el servicio, con la visibilidad indicada. */
  const insertarResena = (status: string) =>
    dataSource.query(
      `INSERT INTO "reviews"
        ("id", "business_id", "client_id", "appointment_id", "rating", "status")
       VALUES (gen_random_uuid(), $1, $2, $3, 5, $4) RETURNING id`,
      [NEGOCIO, CLIENTE, CITA, status]
    );

  it("acepta las dos visibilidades del catálogo", async () => {
    await expect(insertarResena(ReviewStatus.PUBLICADA)).resolves.toBeDefined();
    await dataSource.query('TRUNCATE TABLE "reviews" CASCADE');
    await expect(insertarResena(ReviewStatus.OCULTA)).resolves.toBeDefined();
  });

  // Un estado inventado dejaría la reseña fuera del listado y fuera de la
  // media: ni se ve ni cuenta, y nadie se entera.
  it("rechaza una visibilidad que no existe", async () => {
    await expect(insertarResena("BORRADA")).rejects.toMatchObject({
      code: CHECK_VIOLATION,
    });
  });

  it("rechaza un motivo de denuncia que no existe", async () => {
    const [{ id }] = await insertarResena(ReviewStatus.PUBLICADA);

    await expect(
      dataSource.query(
        `INSERT INTO "review_reports" ("id", "review_id", "user_id", "reason")
         VALUES (gen_random_uuid(), $1, $2, 'NO_ME_GUSTA')`,
        [id, CLIENTE]
      )
    ).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("acepta un motivo del catálogo", async () => {
    const [{ id }] = await insertarResena(ReviewStatus.PUBLICADA);

    await expect(
      dataSource.query(
        `INSERT INTO "review_reports" ("id", "review_id", "user_id", "reason")
         VALUES (gen_random_uuid(), $1, $2, 'DATOS_PERSONALES')`,
        [id, CLIENTE]
      )
    ).resolves.toBeDefined();
  });
});
