import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { User } from "./entities/user.entity";
import { Membership } from "./entities/membership.entity";
import { PasswordReset } from "./entities/password-reset.entity";
import { AuditLog } from "./entities/audit-log.entity";

/**
 * Entidades que gestiona este servicio, en un módulo aparte para que el
 * app.module y el data-source de migraciones compartan la misma lista.
 *
 * Si divergieran, `migration:generate` compararía el esquema contra una lista
 * incompleta y propondría borrar las tablas que le faltasen.
 */
export const entities = [
  User,
  Membership,
  PasswordReset,
  AuditLog,
  OutboxMessageEntity,
];
