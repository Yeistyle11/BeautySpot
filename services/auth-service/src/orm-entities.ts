import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { User } from "./entities/user.entity";
import { Membership } from "./entities/membership.entity";
import { PasswordReset } from "./entities/password-reset.entity";
import { AuditLog } from "./entities/audit-log.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  User,
  Membership,
  PasswordReset,
  AuditLog,
  OutboxMessageEntity,
];
