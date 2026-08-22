import { IsBoolean } from "class-validator";
import { Controller, Get, Post, Patch, Body, Param } from "@nestjs/common";
import { UsersService } from "./users.service";
import {
  CurrentUser,
  Roles,
  BusinessId,
  SesionVerificable,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { toSafeUser } from "./dto/user-response.dto";

/** Alta o baja de una cuenta de staff. */
class CambiarEstadoDto {
  @IsBoolean()
  active!: boolean;
}

/** Endpoints de perfil propio y de administración del staff de un negocio. */
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Devuelve el perfil del usuario autenticado. */
  @Get("me")
  async getMe(@CurrentUser("userId") userId: string) {
    const user = await this.usersService.findById(userId);
    return toSafeUser(user);
  }

  /** Actualiza el perfil del usuario autenticado. */
  @Patch("me")
  async updateProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  /** Lista las membresías (negocios y roles) del usuario autenticado. */
  @Get("memberships")
  async getMemberships(@CurrentUser("userId") userId: string) {
    return this.usersService.getUserMemberships(userId);
  }

  /**
   * Lista todos los miembros del staff del negocio actual.
   * Requiere rol OWNER, ADMIN o SUPER_ADMIN.
   */
  @Get("business")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async listStaff(@BusinessId() businessId: string) {
    return this.usersService.findByBusiness(businessId);
  }

  /**
   * Obtiene un miembro del staff por ID, verificado que pertenezca al negocio.
   */
  @Get(":id/staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async getStaffMember(
    @Param("id") userId: string,
    @BusinessId() businessId: string
  ) {
    return this.usersService.findByIdAndBusiness(userId, businessId);
  }

  /**
   * Crea una cuenta de staff (email, contraseña, nombre y rol) y la asocia al
   * negocio actual mediante una nueva membresía.
   */
  @SesionVerificable()
  @Post("staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async createStaff(
    @Body() dto: CreateStaffDto,
    @BusinessId() businessId: string
  ) {
    return this.usersService.createStaff(businessId, dto);
  }

  /**
   * Actualiza datos de un miembro del staff (nombre, email, telefono, avatar).
   * Verifica que el usuario pertenezca al negocio.
   */
  @SesionVerificable()
  @Patch(":id/staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async updateStaff(
    @Param("id") userId: string,
    @Body() dto: UpdateStaffDto,
    @BusinessId() businessId: string
  ) {
    return this.usersService.updateStaff(userId, businessId, dto);
  }

  /**
   * Resetea la contrasena de un miembro del staff.
   * El admin establece la nueva contrasena directamente.
   */
  @SesionVerificable()
  @Post(":id/reset-password")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async adminResetPassword(
    @Param("id") userId: string,
    @Body() dto: AdminResetPasswordDto,
    @BusinessId() businessId: string
  ) {
    return this.usersService.adminResetPassword(
      userId,
      businessId,
      dto.newPassword
    );
  }

  /**
   * Activa o desactiva una cuenta de staff.
   * Body: { active: true/false }
   */
  @SesionVerificable()
  @Patch(":id/status")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async toggleActive(
    @Param("id") userId: string,
    @Body() body: CambiarEstadoDto,
    @BusinessId() businessId: string
  ) {
    return this.usersService.toggleActive(userId, businessId, body.active);
  }
}

/**
 * Endpoint interno (servicio-a-servicio) que da la versión de token vigente.
 *
 * Los otros microservicios validan la revocación contra Redis, que es volátil;
 * cuando la clave no está, preguntan aquí, que es donde vive el dato duradero.
 */
@Controller("internal/users")
export class InternalUsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Versión de token del usuario; 0 si la cuenta ya no existe. */
  @Get(":id/token-version")
  async tokenVersion(@Param("id") userId: string) {
    return { version: await this.usersService.versionDeToken(userId) };
  }
}
