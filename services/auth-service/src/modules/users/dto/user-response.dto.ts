import { User } from "../../../entities/user.entity";

export type SafeUser = Omit<User, "password" | "generateId">;

export function toSafeUser(user: User): SafeUser {
  const { password: _password, generateId: _generateId, ...rest } = user;
  return rest;
}
