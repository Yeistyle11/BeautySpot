import { User } from "../../../entities/user.entity";

/**
 * Usuario apto para devolver en una respuesta: sin la contraseña y sin la
 * maquinaria de la sesión —versión de token, contador de fallos y bloqueo—, que
 * no le importa a nadie fuera de auth.
 */
export type SafeUser = Omit<
  User,
  | "password"
  | "tokenVersion"
  | "failedLoginAttempts"
  | "lockoutCount"
  | "lockedUntil"
  | "generateId"
>;

/** Quita de un User lo que no debe salir de auth antes de enviarlo al cliente. */
export function toSafeUser(user: User): SafeUser {
  const {
    password: _password,
    tokenVersion: _tokenVersion,
    failedLoginAttempts: _failedLoginAttempts,
    lockoutCount: _lockoutCount,
    lockedUntil: _lockedUntil,
    generateId: _generateId,
    ...rest
  } = user;
  return rest;
}
