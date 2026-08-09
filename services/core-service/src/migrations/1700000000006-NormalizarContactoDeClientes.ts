import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Deja el correo y el teléfono de los clientes en la forma canónica con la que
 * el alta los coteja: correo en minúsculas y teléfono solo con dígitos,
 * conservando el `+` inicial.
 *
 * Sin esto, una ficha guardada como "+57 300 123 4567" no casaría con la misma
 * persona reservando de nuevo, y se duplicaría.
 */
export class NormalizarContactoDeClientes1700000000006 implements MigrationInterface {
  name = "NormalizarContactoDeClientes1700000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "clients"
      SET "email" = lower(btrim("email"))
      WHERE "email" IS NOT NULL AND "email" <> lower(btrim("email"))
    `);

    await queryRunner.query(`
      UPDATE "clients"
      SET "phone" = CASE
        WHEN btrim("phone") LIKE '+%'
          THEN '+' || regexp_replace("phone", '\\D', '', 'g')
        ELSE regexp_replace("phone", '\\D', '', 'g')
      END
      WHERE "phone" IS NOT NULL AND "phone" <> ''
    `);
  }

  public async down(): Promise<void> {
    // El formato original no se guardó en ninguna parte, así que no se puede
    // reconstruir. Deshacer la migración deja los datos ya normalizados.
  }
}
