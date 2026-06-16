import { Controller, Get, Post, Patch, Body, Param, Req } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CurrentUser, Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Perfil propio ---

  @Get("me")
  async getMe(@CurrentUser("userId") userId: string) {
    const user = await this.usersService.findById(userId);
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get("memberships")
  async getMemberships(@CurrentUser("userId") userId: string) {
    return this.usersService.getUserMemberships(userId);
  }

  // --- Admin: Gestion de staff del negocio ---

  /**
   * Lista todos los miembros del staff del negocio actual.
   * Requiere rol OWNER, ADMIN o SUPER_ADMIN.
   */
  @Get("business")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async listStaff(@Req() req: any) {
    return this.usersService.findByBusiness(req.businessId);
  }

  /**
   * Obtiene un miembro del staff por ID, verificado que pertenezca al negocio.
   */
  @Get(":id/staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async getStaffMember(
    @Param("id") userId: string,
    @Req() req: any,
  ) {
    return this.usersService.findByIdAndBusiness(userId, req.businessId);
  }

  /**
   * Crea una nueva cuenta de usuario y la asocia al negocio con un rol.
   * El admin proporciona email, contrasena, nombre y rol.
   * Opcionalmente puede indicar un professionalId para vincular.
   */
  @Post("staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Req() req: any,
  ) {
    return this.usersService.createStaff(req.businessId, dto);
  }

  /**
   * Actualiza datos de un miembro del staff (nombre, email, telefono, avatar).
   * Verifica que el usuario pertenezca al negocio.
   */
  @Patch(":id/staff")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async updateStaff(
    @Param("id") userId: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: any,
  ) {
    return this.usersService.updateStaff(userId, req.businessId, dto);
  }

  /**
   * Resetea la contrasena de un miembro del staff.
   * El admin establece la nueva contrasena directamente.
   */
  @Post(":id/reset-password")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async adminResetPassword(
    @Param("id") userId: string,
    @Body() dto: AdminResetPasswordDto,
    @Req() req: any,
  ) {
    return this.usersService.adminResetPassword(userId, req.businessId, dto.newPassword);
  }

  /**
   * Activa o desactiva una cuenta de staff.
   * Body: { active: true/false }
   */
  @Patch(":id/status")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async toggleActive(
    @Param("id") userId: string,
    @Body() body: { active: boolean },
    @Req() req: any,
  ) {
    return this.usersService.toggleActive(userId, req.businessId, body.active);
  }
}
