import * as bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { User } from "../../../../services/auth-service/src/entities/user.entity";
import { Membership } from "../../../../services/auth-service/src/entities/membership.entity";
import { CONTRASENA, type Siembra } from "../datos";
import { idDe } from "../identidades";
import { guardar } from "./comun";

/**
 * Coste del hash. El de los servicios es 12; aquí basta con menos porque estas
 * cuentas no protegen nada y son seis: a 12 la siembra se pasa varios segundos
 * quemando CPU sin ganar nada.
 */
const COSTE = 10;

/**
 * Usuarios y membresías. Las cuentas nacen con el correo ya verificado: el alta
 * normal deja `emailVerified` en falso y el login lo exige, así que sin esto la
 * siembra dejaría seis cuentas por las que no se puede entrar.
 */
export async function sembrarAuth(dataSource: DataSource, siembra: Siembra) {
  // Un solo hash para las seis: comparten contraseña, así que calcularlo una
  // vez no cambia nada y ahorra cinco cifrados.
  const clave = await bcrypt.hash(CONTRASENA, COSTE);

  const usuarios = siembra.cuentas.map((cuenta) => {
    const usuario = new User();
    usuario.id = cuenta.id;
    usuario.email = cuenta.email;
    usuario.password = clave;
    usuario.name = cuenta.nombre;
    usuario.phone = cuenta.telefono;
    usuario.emailVerified = true;
    usuario.active = true;
    usuario.currentBusinessId = cuenta.negocioId as string;
    usuario.tokenVersion = 0;
    usuario.failedLoginAttempts = 0;
    usuario.lockedUntil = null;
    usuario.lockoutCount = 0;
    return usuario;
  });

  const membresias = siembra.cuentas
    .filter((cuenta) => cuenta.rol && cuenta.negocioId)
    .map((cuenta) => {
      const membresia = new Membership();
      membresia.id = idDe(`membresia:${cuenta.email}:${cuenta.negocioId}`);
      membresia.userId = cuenta.id;
      membresia.businessId = cuenta.negocioId!;
      membresia.role = cuenta.rol!;
      membresia.active = true;
      membresia.acceptedAt = new Date();
      return membresia;
    });

  return {
    usuarios: await guardar(dataSource, User, usuarios),
    membresias: await guardar(dataSource, Membership, membresias),
  };
}

/** Retira las cuentas sembradas y sus membresías. */
export async function limpiarAuth(dataSource: DataSource, siembra: Siembra) {
  const ids = siembra.cuentas.map((c) => c.id);
  await dataSource.query(
    `DELETE FROM "memberships" WHERE "user_id" = ANY($1)`,
    [ids]
  );
  await dataSource.query(`DELETE FROM "audit_logs" WHERE "user_id" = ANY($1)`, [
    ids,
  ]);
  await dataSource.query(`DELETE FROM "users" WHERE "id" = ANY($1)`, [ids]);
}
