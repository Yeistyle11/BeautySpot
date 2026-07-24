import { User } from "../../../entities/user.entity";

/** Usuario sin campos sensibles ni métodos, apto para devolver en respuestas. */
export type SafeUser = Omit<User, "password" | "generateId">;

/** Quita la contraseña (y helpers) de un User antes de enviarlo al cliente. */
export function toSafeUser(user: User): SafeUser {
  const { password: _password, generateId: _generateId, ...rest } = user;
  return rest;
}
