import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { User } from "../../entities/user.entity";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { toSafeUser, SafeUser } from "./dto/user-response.dto";
import { Role } from "@beautyspot/shared-types";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource
  ) {}

  // --- Consultas ---

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Lista todos los usuarios (staff) que pertenecen a un negocio
   * a traves de sus membresias activas.
   */
  async findByBusiness(businessId: string): Promise<
    (SafeUser & {
      membershipId: string;
      role: string;
      membershipActive: boolean;
      joinedAt: Date;
    })[]
  > {
    const memberships = await this.membershipRepository.find({
      where: { businessId, active: true },
      relations: ["user"],
    });

    return memberships.map((m) => ({
      ...toSafeUser(m.user),
      membershipId: m.id,
      role: m.role,
      membershipActive: m.active,
      joinedAt: m.acceptedAt || m.createdAt,
    }));
  }

  /**
   * Obtiene un usuario con su membresia en un negocio especifico.
   */
  async findByIdAndBusiness(
    userId: string,
    businessId: string
  ): Promise<SafeUser & { role: string; membershipId: string }> {
    const membership = await this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
      relations: ["user"],
    });

    if (!membership) {
      throw new NotFoundException("Usuario no encontrado en este negocio");
    }

    return {
      ...toSafeUser(membership.user),
      role: membership.role,
      membershipId: membership.id,
    };
  }

  // --- Perfil propio ---

  async updateProfile(
    id: string,
    data: { name?: string; phone?: string; avatar?: string }
  ): Promise<SafeUser> {
    await this.userRepository.update(id, data);
    const user = await this.findById(id);
    return toSafeUser(user);
  }

  async deactivate(id: string): Promise<void> {
    await this.userRepository.update(id, { active: false });
  }

  async getUserMemberships(userId: string): Promise<Membership[]> {
    return this.membershipRepository.find({
      where: { userId, active: true },
    });
  }

  // --- Admin: Crear cuenta de staff ---

  /**
   * Crea un usuario, hashea la contrasena, y le asigna una membresia
   * en el negocio con el rol especificado.
   */
  async createStaff(
    businessId: string,
    dto: CreateStaffDto
  ): Promise<SafeUser & { membershipId: string; role: string }> {
    // Verificar email unico
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("El email ya esta registrado");
    }

    // Hashear contrasena
    const saltRounds = Number(
      this.configService.get<string>("BCRYPT_SALT_ROUNDS", "12")
    );
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const membershipRepo = manager.getRepository(Membership);

      const user = userRepo.create({
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
      });
      await userRepo.save(user);

      const membership = membershipRepo.create({
        userId: user.id,
        businessId,
        role: dto.role,
        acceptedAt: new Date(),
      });
      await membershipRepo.save(membership);

      await this.logAction(
        user.id,
        "STAFF_ACCOUNT_CREATED",
        "users",
        user.id,
        businessId,
        manager
      );

      return {
        ...toSafeUser(user),
        membershipId: membership.id,
        role: membership.role,
      };
    });
  }

  // --- Admin: Actualizar cuenta de staff ---

  /**
   * Actualiza datos de un usuario (nombre, email, telefono, avatar).
   * Verifica que el usuario pertenezca al negocio.
   */
  async updateStaff(
    userId: string,
    businessId: string,
    dto: UpdateStaffDto
  ): Promise<SafeUser> {
    // Verificar membresia activa en el negocio
    const membership = await this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
    if (!membership) {
      throw new NotFoundException("Usuario no encontrado en este negocio");
    }

    // Si cambia email, verificar unicidad
    if (dto.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException("El email ya esta en uso por otro usuario");
      }
    }

    // Actualizar solo campos proporcionados
    const updateData: Partial<User> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    if (Object.keys(updateData).length === 0) {
      return this.findById(userId).then((u) => toSafeUser(u));
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      await userRepo.update(userId, updateData);

      await this.logAction(
        userId,
        "STAFF_ACCOUNT_UPDATED",
        "users",
        userId,
        businessId,
        manager
      );

      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException("Usuario no encontrado");
      }
      return toSafeUser(user);
    });
  }

  // --- Admin: Resetear contrasena ---

  /**
   * Permite al admin establecer una nueva contrasena para un miembro del staff.
   */
  async adminResetPassword(
    userId: string,
    businessId: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Verificar membresia activa
    const membership = await this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
    if (!membership) {
      throw new NotFoundException("Usuario no encontrado en este negocio");
    }

    // No permitir resetear la contrasena de un SUPER_ADMIN o OWNER si no es SUPER_ADMIN
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException(
        "No se puede resetear la contrasena del dueno del negocio"
      );
    }

    const saltRounds = Number(
      this.configService.get<string>("BCRYPT_SALT_ROUNDS", "12")
    );
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      await userRepo.update(userId, { password: hashedPassword });

      await this.logAction(
        userId,
        "STAFF_PASSWORD_RESET_BY_ADMIN",
        "users",
        userId,
        businessId,
        manager
      );
    });

    return { message: "Contrasena actualizada correctamente" };
  }

  // --- Admin: Activar/Desactivar cuenta ---

  /**
   * Activa o desactiva la CUENTA DE USUARIO y su membresia.
   * IMPORTANTE: Esto NO afecta al perfil profesional (core-service).
   * La cuenta de usuario y el profesional son entidades independientes:
   *   - Desactivar la cuenta = el usuario no puede iniciar sesion
   *   - El profesional sigue activo en el equipo del negocio
   */
  async toggleActive(
    userId: string,
    businessId: string,
    active: boolean
  ): Promise<{ message: string }> {
    // Verificar membresia
    const membership = await this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
    if (!membership) {
      throw new NotFoundException("Usuario no encontrado en este negocio");
    }

    // No desactivar al OWNER
    if (!active && membership.role === Role.OWNER) {
      throw new ForbiddenException(
        "No se puede desactivar al dueno del negocio"
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const membershipRepo = manager.getRepository(Membership);

      if (!active) {
        await membershipRepo.update(membership.id, { active: false });
        await userRepo.update(userId, { active: false });
        await this.logAction(
          userId,
          "STAFF_ACCOUNT_DEACTIVATED",
          "users",
          userId,
          businessId,
          manager
        );
      } else {
        await userRepo.update(userId, { active: true });
        await membershipRepo.update(membership.id, { active: true });
        await this.logAction(
          userId,
          "STAFF_ACCOUNT_ACTIVATED",
          "users",
          userId,
          businessId,
          manager
        );
      }
    });

    return {
      message: active
        ? "Cuenta activada correctamente"
        : "Cuenta desactivada correctamente",
    };
  }

  // --- Audit logging ---

  private async logAction(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    businessId: string | undefined,
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
      changes: businessId ? { businessId } : undefined,
    });
    await repo.save(log);
  }
}
