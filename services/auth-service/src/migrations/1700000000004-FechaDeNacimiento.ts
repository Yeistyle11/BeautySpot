import { MigrationInterface, QueryRunner } from "typeorm";

/** Añade la fecha de nacimiento de la cuenta. */
export class FechaDeNacimiento1700000000004 implements MigrationInterface {
  name = "FechaDeNacimiento1700000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" date`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "birth_date"`
    );
  }
}
