import { randomUUID } from "crypto";
import { RefreshTokenStore } from "./refresh-token.store";
import {
  Injectable,
  Logger,
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
import { Role, IJwtPayload, Membresia } from "@beautyspot/shared-types";
import {
  BLOQUEO_BASE_MINUTOS,
  BLOQUEO_MAXIMO_MINUTOS,
  HORAS_VERIFICACION_CORREO,
  MAX_INTENTOS_FALLIDOS,
} from "@beautyspot/shared-constants";
import { EmailVerification } from "../../entities/email-verification.entity";
import { EventNames } from "@beautyspot/event-types";
import {
  EventBusService,
  OutboxService,
  assertJwtSecret,
  TokenVersionStore,
  TOKEN_VERSION_DEFAULT,
} from "@beautyspot/nest-common";
import { toSafeUser, SafeUser } from "../users/dto/user-response.dto";

/** Lo que se le dice a quien tiene la cuenta desactivada, entre o renueve. */
const MENSAJE_CUENTA_DESACTIVADA =
  "Tu cuenta ha sido desactivada. Habla con el administrador del negocio.";

/** SHA-256 del token de recuperación: en la BD solo se guarda el hash, nunca el token en claro. */
function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Gestiona el ciclo de autenticación: registro, login, emisión y refresco de
 * tokens JWT, y recuperación/cambio de contraseña, con auditoría de cada acción.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Promesa memoizada del hash señuelo (ver getDecoyHash). */
  private decoyHash?: Promise<string>;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly tokenVersionStore: TokenVersionStore
  ) {}

  /**
   * Crea la cuenta (rechazando emails duplicados), la audita y encola el correo
   * de confirmación. No emite tokens: la cuenta entra cuando confirma.
   */
  async register(
    dto: RegisterDto
  ): Promise<{ user: SafeUser; message: string }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      // Mensaje genérico para no revelar qué correos están dados de alta.
      throw new ConflictException("No se pudo completar el registro");
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.getSaltRounds()
    );

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

      await this.outboxService.enqueue(manager, {
        eventType: EventNames.AUTH_USER_REGISTERED,
        aggregateType: "users",
        aggregateId: saved.id,
        payload: {
          userId: saved.id,
          email: saved.email,
          name: saved.name,
        },
      });

      await this.emitirVerificacion(manager, saved);
      return saved;
    });

    // Sin tokens: la cuenta no puede entrar hasta confirmar el correo.
    return {
      user: toSafeUser(user),
      message: "Te enviamos un correo para confirmar tu cuenta",
    };
  }

  /** Genera el token de verificación y encola el correo en la misma transacción. */
  private async emitirVerificacion(
    manager: EntityManager,
    user: User
  ): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + HORAS_VERIFICACION_CORREO * 60 * 60 * 1000
    );

    const verificacion = manager.getRepository(EmailVerification).create({
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt,
    });
    await manager.getRepository(EmailVerification).save(verificacion);

    await this.outboxService.enqueue(manager, {
      eventType: EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
      aggregateType: "users",
      aggregateId: user.id,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        verificationToken: rawToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  /** Marca el correo como verificado y gasta el token. */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const verificacion = await this.emailVerificationRepository.findOne({
      where: { tokenHash: hashResetToken(token) },
    });

    if (
      !verificacion ||
      verificacion.usedAt ||
      verificacion.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException("El enlace no es válido o ya venció");
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update(verificacion.userId, { emailVerified: true });
      await manager
        .getRepository(EmailVerification)
        .update(verificacion.id, { usedAt: new Date() });
    });

    await this.logAction(
      verificacion.userId,
      "EMAIL_VERIFIED",
      "users",
      verificacion.userId
    );
    return { message: "Correo confirmado: ya puedes iniciar sesión" };
  }

  /**
   * Reenvía el correo de confirmación. Responde siempre lo mismo para no
   * revelar qué direcciones están dadas de alta.
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const generico = {
      message: "Si la cuenta existe y falta confirmarla, recibirás un correo",
    };

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.emailVerified) return generico;

    await this.dataSource.transaction((manager) =>
      this.emitirVerificacion(manager, user)
    );
    return generico;
  }

  /** Valida credenciales y emite un nuevo par de tokens para el usuario. */
  async login(dto: LoginDto): Promise<{
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.validateUser(dto.email, dto.password);
    await this.logAction(user.id, "USER_LOGGED_IN", "users", user.id);

    // El aviso de inicio de sesion no debe tumbar el login si el bus falla.
    await this.eventBus
      .emit(EventNames.AUTH_USER_LOGGED_IN, {
        userId: user.id,
        email: user.email,
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `No se pudo publicar el inicio de sesion: ${String(error)}`
        );
      });

    const { accessToken, refreshToken } = await this.generateTokens(user);
    return { user: toSafeUser(user), accessToken, refreshToken };
  }

  /**
   * Emite un nuevo par de tokens a partir de un refresh válido, comprobando la
   * firma y también la versión de token, que un logout o un cambio de
   * contraseña incrementan.
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
    if (!user) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }
    if (!user.active) {
      throw new UnauthorizedException(MENSAJE_CUENTA_DESACTIVADA);
    }

    const currentVersion = await this.tokenVersionStore.getVersion(user.id);
    if ((payload.tokenVersion ?? TOKEN_VERSION_DEFAULT) !== currentVersion) {
      throw new UnauthorizedException("Sesión invalidada");
    }

    await this.canjearRefresh(user, payload.jti);

    return this.generateTokens(user);
  }

  /**
   * Retira el refresh recibido de los vivos; si ya no lo estaba lo trata como
   * reutilización y revoca todas las sesiones del usuario. Los refresh sin
   * identificador se aceptan una vez y salen con uno.
   */
  private async canjearRefresh(
    user: User,
    jti: string | undefined
  ): Promise<void> {
    if (!jti) return;

    const canje = await this.refreshTokens.canjear(user.id, jti);
    if (canje.resultado !== "reutilizado") return;

    this.logger.warn(
      `Refresh token reutilizado para ${user.id}: se revocan sus sesiones`
    );
    await this.refreshTokens.revocarTodos(user.id);
    await this.tokenVersionStore.bumpVersion(user.id);
    throw new UnauthorizedException("Sesión invalidada");
  }

  /**
   * Genera un token de recuperación y encola el correo con instrucciones.
   * Devuelve siempre el mismo mensaje genérico para no revelar si el email existe.
   */
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

  /** Cambia la contraseña verificando la actual y revoca las sesiones abiertas. */
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

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      this.getSaltRounds()
    );

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

  /** Cierra la sesión invalidando los tokens vigentes (sube la versión de token). */
  async logout(userId: string): Promise<{ message: string }> {
    await this.tokenVersionStore.bumpVersion(userId);
    await this.logAction(userId, "USER_LOGGED_OUT", "users", userId);
    return { message: "Sesión cerrada correctamente" };
  }

  /** Devuelve el perfil del usuario autenticado junto con sus membresías. */
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

    // El bloqueo se comprueba después de bcrypt para no acortar la respuesta.
    if (user) this.rechazarSiEstaBloqueada(user);

    if (!user || !isPasswordValid) {
      if (user) await this.anotarFalloDeAcceso(user);
      throw new UnauthorizedException("Credenciales inválidas");
    }
    if (!user.active) {
      throw new UnauthorizedException(MENSAJE_CUENTA_DESACTIVADA);
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        "Confirma tu correo antes de iniciar sesión. Puedes pedir un enlace nuevo"
      );
    }

    await this.limpiarFallosDeAcceso(user);
    return user;
  }

  /** Corta el intento mientras el bloqueo siga vigente. */
  private rechazarSiEstaBloqueada(user: User): void {
    if (!user.lockedUntil || user.lockedUntil.getTime() <= Date.now()) return;

    const minutos = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    throw new UnauthorizedException(
      `Cuenta bloqueada por varios intentos fallidos. Vuelve a intentarlo en ${minutos} minuto(s)`
    );
  }

  /**
   * Suma un fallo y bloquea la cuenta al llegar al máximo. Cada bloqueo
   * encadenado dobla la espera del siguiente, hasta el tope.
   */
  private async anotarFalloDeAcceso(user: User): Promise<void> {
    const intentos = user.failedLoginAttempts + 1;

    if (intentos < MAX_INTENTOS_FALLIDOS) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: intentos,
      });
      return;
    }

    const bloqueos = user.lockoutCount + 1;
    const minutos = Math.min(
      BLOQUEO_BASE_MINUTOS * 2 ** (bloqueos - 1),
      BLOQUEO_MAXIMO_MINUTOS
    );

    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockoutCount: bloqueos,
      lockedUntil: new Date(Date.now() + minutos * 60000),
    });
    await this.logAction(user.id, "USER_LOCKED_OUT", "users", user.id);
  }

  /** Devuelve la cuenta a su estado limpio tras un acceso correcto. */
  private async limpiarFallosDeAcceso(user: User): Promise<void> {
    if (user.failedLoginAttempts === 0 && user.lockoutCount === 0) return;

    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockoutCount: 0,
      lockedUntil: null,
    });
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

  /** Deriva el rol, negocio principal y lista de negocios activos para el payload del token. */
  private getMembershipsData(user: User) {
    const memberships = (
      user as User & {
        memberships?: Array<{
          businessId: string;
          role: string;
          active: boolean;
        }>;
      }
    ).memberships;
    if (!memberships || memberships.length === 0) {
      return {
        role: Role.CLIENT,
        businessId: undefined,
        businessIds: [] as string[],
        memberships: [] as Membresia[],
      };
    }
    const active = memberships.filter((m) => m.active);
    const primary = active[0];
    return {
      role: primary?.role || Role.CLIENT,
      businessId: primary?.businessId || undefined,
      businessIds: active.map((m) => m.businessId),
      memberships: active.map((m) => ({
        businessId: m.businessId,
        role: m.role as Role,
      })),
    };
  }

  /** Firma el par access/refresh incluyendo rol, negocios y la versión de token vigente. */
  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { role, businessId, businessIds, memberships } =
      this.getMembershipsData(user);
    const tokenVersion = await this.tokenVersionStore.getVersion(user.id);
    const payload: Omit<IJwtPayload, "iat" | "exp"> = {
      sub: user.id,
      email: user.email,
      role: role as Role,
      businessId,
      businessIds,
      memberships,
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

    // Cada refresh lleva su propio identificador para poder retirarlo al
    // canjearlo y detectar que alguien reutiliza uno ya gastado.
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, email: user.email, tokenVersion, jti },
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

    await this.refreshTokens.registrar(user.id, jti);

    return { accessToken, refreshToken };
  }

  /** Escribe una entrada en el log de auditoría, opcionalmente dentro de una transacción. */
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
