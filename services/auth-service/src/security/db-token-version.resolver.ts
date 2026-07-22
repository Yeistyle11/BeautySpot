import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenVersionResolver } from "@beautyspot/nest-common";
import { User } from "../entities/user.entity";

/**
 * Implementación del TokenVersionResolver respaldada por la tabla `users`.
 *
 * auth-service es el único servicio dueño de esa tabla, así que es el único
 * que puede dar persistencia a la revocación de sesiones.
 */
@Injectable()
export class DbTokenVersionResolver implements TokenVersionResolver {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  /** Devuelve la versión almacenada; 0 si el usuario ya no existe. */
  async load(userId: string): Promise<number> {
    const row = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, tokenVersion: true },
    });
    return row?.tokenVersion ?? 0;
  }

  /**
   * Incrementa la versión en una sola sentencia SQL para evitar la condición de
   * carrera de un read-modify-write entre revocaciones concurrentes.
   */
  async bump(userId: string): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ tokenVersion: () => '"token_version" + 1' })
      .where("id = :userId", { userId })
      .returning('"token_version"')
      .execute();

    const raw = result.raw as Array<{ token_version: number }> | undefined;
    return raw?.[0]?.token_version ?? 0;
  }
}
