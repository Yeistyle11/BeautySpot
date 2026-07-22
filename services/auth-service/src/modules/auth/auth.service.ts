import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, IsNull, Repository } from "typeorm";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { User } from "../../entities/user.entity";
import { PasswordReset } from "../../entities/password-reset.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { Role, IJwtPayload } from "@beautyspot/shared-types";
import { EventNames } from "@beautyspot/event-types";
import {
  EventBusService,
  OutboxService,
  assertJwtSecret,
  TokenVersionStore,
  TOKEN_VERSION_DEFAULT,
} from "@beautyspot/nest-common";
import { toSafeUser, SafeUser } from "../users/dto/user-response.dto";

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  /** Promesa memoizada del hash señuelo (ver getDecoyHash). */
  private decoyHash?: Promise<string>;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
    private readonly tokenVersionStore: TokenVersionStore
  ) {}

  async register(
    dto: RegisterDto
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("El email ya está registrado");
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.getSaltRounds());

    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const created = userRepo.create({
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
      });
      const saved = await userRepo.save(created);
      await this.logAction(
        saved.id,
        "USER_REGISTERED",
        "users",
        saved.id,
        manager
      );
      return saved;
    });

    this.eventBus.emit(EventNames.AUTH_USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const { accessToken, refreshToken } = await this.generateTokens(user);
    return { user: toSafeUser(user), accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<{
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.validateUser(dto.email, dto.password);
    await this.logAction(user.id, "USER_LOGGED_IN", "users", user.id);

    this.eventBus.emit(EventNames.AUTH_USER_LOGGED_IN, {
      userId: user.id,
      email: user.email,
    });

    const { accessToken, refreshToken } = await this.generateTokens(user);
    return { user: toSafeUser(user), accessToken, refreshToken };
  }

  /**
   * Emite un nuevo par de tokens a partir de un refresh token válido.
   *
   * Comprueba la versión de token además de la firma: sin ese control, un
   * refresh token robado seguiría produciendo access tokens durante toda su
   * vigencia (7 días por defecto) pese a un logout o un cambio de contraseña.
   */
  async refreshToken(
    token: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: IJwtPayload;
    try {
      payload = this.jwtService.verify<IJwtPayload>(token, {
        secret: assertJwtSecret(
          this.configService.get<string>("JWT_REFRESH_SECRET"),
          "JWT_REFRESH_SECRET"
        ),
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ["memberships"],
    });
    if (!user || !user.active) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const currentVersion = await this.tokenVersionStore.getVersion(user.id);
    if ((payload.tokenVersion ?? TOKEN_VERSION_DEFAULT) !== currentVersion) {
      throw new UnauthorizedException("Sesión invalidada");
    }

    return this.generateTokens(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { message: "Si el email existe, recibirás instrucciones" };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.dataSource.transaction(async (manager) => {
      const resetRepo = manager.getRepository(PasswordReset);
      const reset = resetRepo.create({
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt,
      });
      await resetRepo.save(reset);

      await this.logAction(
        user.id,
        "PASSWORD_RESET_REQUESTED",
        "users",
        user.id,
        manager
      );

      await this.outboxService.enqueue(manager, {
        eventType: EventNames.AUTH_PASSWORD_RESET_REQUESTED,
        aggregateType: "users",
        aggregateId: user.id,
        payload: {
          userId: user.id,
          email: user.email,
          name: user.name,
          resetToken: rawToken,
          expiresAt: expiresAt.toISOString(),
        },
      });
    });
    return { message: "Si el email existe, recibirás instrucciones" };
  }

  /**
   * Restablece la contraseña a partir de un token de recuperación.
   *
   * Consume el token usado y anula los demás pendientes del usuario, para que
   * una cadena de solicitudes no deje varios tokens válidos en circulación.
   * Al terminar revoca las sesiones abiertas incrementando la versión de token.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const reset = await this.passwordResetRepository.findOne({
      where: { tokenHash: hashResetToken(dto.token) },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException("Token inválido o expirado");
    }

    const user = await this.userRepository.findOne({
      where: { id: reset.userId },
    });
    if (!user || !user.active) {
      throw new BadRequestException("Token inválido o expirado");
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      this.getSaltRounds()
    );

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const resetRepo = manager.getRepository(PasswordReset);
      await userRepo.update(reset.userId, { password: hashedPassword });
      await resetRepo.update(
        { userId: reset.userId, usedAt: IsNull() },
        { usedAt: new Date() }
      );

      await this.logAction(
        reset.userId,
        "PASSWORD_RESET_COMPLETED",
        "users",
        reset.userId,
        manager
      );
    });
    await this.tokenVersionStore.bumpVersion(reset.userId);
    return { message: "Contraseña actualizada correctamente" };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Contraseña actual incorrecta");
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.getSaltRounds());

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      await userRepo.update(userId, { password: hashedPassword });
      await this.logAction(
        userId,
        "PASSWORD_CHANGED",
        "users",
        userId,
        manager
      );
    });
    await this.tokenVersionStore.bumpVersion(userId);
    return { message: "Contraseña actualizada correctamente" };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.tokenVersionStore.bumpVersion(userId);
    await this.logAction(userId, "USER_LOGGED_OUT", "users", userId);
    return { message: "Sesión cerrada correctamente" };
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["memberships"],
    });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }
    return toSafeUser(user);
  }

  /**
   * Valida credenciales y devuelve el usuario con sus membresías cargadas.
   *
   * Compara siempre contra un hash —el real o uno señuelo— para que el tiempo
   * de respuesta no revele si el email existe: un retorno temprano sin ejecutar
   * bcrypt permitiría enumerar cuentas midiendo la latencia.
   */
  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["memberships"],
    });

    const hashToCompare = user?.password ?? (await this.getDecoyHash());
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    if (!user.active) {
      throw new UnauthorizedException("Cuenta desactivada");
    }

    return user;
  }

  /**
   * Hash señuelo usado cuando el email no existe. Se calcula una sola vez y se
   * reutiliza, con el mismo coste de bcrypt que los hashes reales.
   */
  private getDecoyHash(): Promise<string> {
    if (!this.decoyHash) {
      this.decoyHash = bcrypt.hash(
        "usuario-inexistente",
        this.getSaltRounds()
      ) as Promise<string>;
    }
    return this.decoyHash;
  }

  /** Coste de bcrypt configurado para el servicio. */
  private getSaltRounds(): number {
    return Number(this.configService.get<string>("BCRYPT_SALT_ROUNDS", "12"));
  }

  private getMembershipsData(user: User) {
    const memberships = (user as any).memberships as
      | Array<{ businessId: string; role: string; active: boolean }>
      | undefined;
    if (!memberships || memberships.length === 0) {
      return {
        role: Role.CLIENT,
        businessId: undefined,
        businessIds: [] as string[],
      };
    }
    const active = memberships.filter((m) => m.active);
    const primary = active[0];
    const businessIds = active.map((m) => m.businessId);
    return {
      role: primary?.role || Role.CLIENT,
      businessId: primary?.businessId || undefined,
      businessIds,
    };
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { role, businessId, businessIds } = this.getMembershipsData(user);
    const tokenVersion = await this.tokenVersionStore.getVersion(user.id);
    const payload: Omit<IJwtPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      role: role as Role,
      businessId,
      businessIds,
      tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: assertJwtSecret(
        this.configService.get<string>("JWT_SECRET"),
        "JWT_SECRET"
      ),
      expiresIn: this.configService.get<string>(
        "JWT_EXPIRES_IN",
        "15m"
      ) as JwtSignOptions["expiresIn"],
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, email: user.email, tokenVersion },
      {
        secret: assertJwtSecret(
          this.configService.get<string>("JWT_REFRESH_SECRET"),
          "JWT_REFRESH_SECRET"
        ),
        expiresIn: this.configService.get<string>(
          "JWT_REFRESH_EXPIRES_IN",
          "7d"
        ) as JwtSignOptions["expiresIn"],
      }
    );

    return { accessToken, refreshToken };
  }

  private async logAction(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(AuditLog)
      : this.auditLogRepository;
    const log = repo.create({
      userId,
      action,
      entity,
      entityId,
    });
    await repo.save(log);
  }
}
