import { DataSource } from "typeorm";
import { entities } from "../orm-entities";
import { CancelReason } from "@beautyspot/shared-types";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const CLIENTE = "22222222-2222-4222-8222-222222222222";
const PROFESIONAL = "33333333-3333-4333-8333-333333333333";
/** Código de error de Postgres para violación de CHECK. */
const CHECK_VIOLATION = "23514";

/**
 * Comprueba contra Postgres real que el motivo de cancelación sigue acotado por
 * la base (`npm run test:int`).
 */
describe("Integración: la base acota el motivo de cancelación", () => {
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
    await dataSource.query('TRUNCATE TABLE "appointments" CASCADE');
  });

  /** Inserta una cita saltándose el servicio, con el motivo que se indique. */
  const insertarCita = (motivo: string | null, status = "CANCELLED") =>
    dataSource.query(
      `INSERT INTO "appointments"
        ("id", "business_id", "client_id", "professional_id", "date",
         "start_time", "end_time", "status", "cancel_reason_type")
       VALUES (gen_random_uuid(), $1, $2, $3, '2026-08-20',
               '10:00', '10:30', $4, $5)`,
      [NEGOCIO, CLIENTE, PROFESIONAL, status, motivo]
    );

  it("acepta un motivo del catálogo", async () => {
    await expect(
      insertarCita(CancelReason.PROFESIONAL_NO_DISPONIBLE)
    ).resolves.toBeDefined();
  });

  // La cita viva no lleva motivo, que es el caso normal de la tabla.
  it("admite la cita sin motivo", async () => {
    await expect(insertarCita(null, "CONFIRMED")).resolves.toBeDefined();
  });

  it("rechaza un motivo que no existe", async () => {
    await expect(insertarCita("SE_LE_OLVIDO")).rejects.toMatchObject({
      code: CHECK_VIOLATION,
    });
  });
});
