import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { Role } from "@beautyspot/shared-types";
import { TokenVersionStore } from "@beautyspot/nest-common";

/** Usuario que ejecuta la acción; su rol y negocio determinan qué membresías puede tocar. */
export interface MembershipActor {
  userId: string;
  role: Role;
  businessId?: string;
}

/**
 * Gestiona las membresías usuario–negocio (alta, cambio de rol, baja) aplicando
 * las reglas de permisos y revocando las sesiones del afectado cuando cambia su rol.
 */
@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly tokenVersionStore: TokenVersionStore
  ) {}

  /** Añade a un usuario a un negocio; rechaza si ya es miembro activo. */
  async create(
    data: {
      userId: string;
      businessId: string;
      role: Role;
      invitedBy?: string;
    },
    actor?: MembershipActor
  ): Promise<Membership> {
    const existing = await this.membershipRepository.findOne({
      where: { userId: data.userId, businessId: data.businessId, active: true },
    });
    if (existing) {
      throw new ForbiddenException("El usuario ya es miembro de este negocio");
    }

    return this.dataSource.transaction(async (manager) => {
      const membershipRepo = manager.getRepository(Membership);
      const membership = membershipRepo.create({
        ...data,
        acceptedAt: new Date(),
      });
      const saved = await membershipRepo.save(membership);

      if (actor) {
        await this.logAction(
          actor.userId,
          "MEMBERSHIP_CREATED",
          data.businessId,
          {
            targetUserId: data.userId,
            role: data.role,
          },
          manager
        );
      }
      return saved;
    });
  }

  /** Cambia el rol de una membresía; solo un Super Admin puede tocar al dueño. */
  async updateRole(
    membershipId: string,
    newRole: Role,
    actor: MembershipActor
  ): Promise<Membership> {
    const membership = await this.findForActor(membershipId, actor);

    if (membership.role === Role.OWNER && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Solo un Super Admin puede cambiar el rol del dueño"
      );
    }

    const previousRole = membership.role;

    return this.dataSource.transaction(async (manager) => {
      const membershipRepo = manager.getRepository(Membership);
      membership.role = newRole;
      const updated = await membershipRepo.save(membership);

      await this.logAction(
        actor.userId,
        "MEMBERSHIP_ROLE_CHANGED",
        membership.businessId,
        {
          membershipId,
          targetUserId: membership.userId,
          previousRole,
          newRole,
        },
        manager
      );
      await this.tokenVersionStore.bumpVersion(membership.userId);
      return updated;
    });
  }

  /** Desactiva una membresía (baja lógica); no se permite dar de baja al dueño. */
  async deactivate(
    membershipId: string,
    actor: MembershipActor
  ): Promise<void> {
    const membership = await this.findForActor(membershipId, actor);

    if (membership.role === Role.OWNER) {
      throw new ForbiddenException(
        "No se puede desactivar al dueño del negocio"
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const membershipRepo = manager.getRepository(Membership);
      await membershipRepo.update(membershipId, { active: false });

      await this.logAction(
        actor.userId,
        "MEMBERSHIP_DEACTIVATED",
        membership.businessId,
        {
          membershipId,
          targetUserId: membership.userId,
          role: membership.role,
        },
        manager
      );
      await this.tokenVersionStore.bumpVersion(membership.userId);
    });
  }

  /** Busca la membresía activa de un usuario en un negocio concreto. */
  async findByUserAndBusiness(
    userId: string,
    businessId: string
  ): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
  }

  /** Lista los miembros activos de un negocio; exige que el actor pertenezca a él (salvo Super Admin). */
  async findByBusiness(
    businessId: string,
    actor?: MembershipActor
  ): Promise<Membership[]> {
    if (actor && actor.role !== Role.SUPER_ADMIN) {
      const belongs = await this.findByUserAndBusiness(
        actor.userId,
        businessId
      );
      if (!belongs) {
        throw new ForbiddenException(
          "No tienes acceso a las membresías de este negocio"
        );
      }
    }
    return this.membershipRepository.find({
      where: { businessId, active: true },
      relations: ["user"],
    });
  }

  /** Carga una membresía restringiéndola al negocio del actor (salvo Super Admin). */
  private async findForActor(
    membershipId: string,
    actor: MembershipActor
  ): Promise<Membership> {
    const where =
      actor.role === Role.SUPER_ADMIN
        ? { id: membershipId }
        : { id: membershipId, businessId: actor.businessId };

    const membership = await this.membershipRepository.findOne({ where });
    if (!membership) {
      throw new NotFoundException("Membresía no encontrada");
    }
    return membership;
  }

  /** Escribe una entrada de auditoría de membresías, opcionalmente dentro de una transacción. */
  private async logAction(
    userId: string,
    action: string,
    businessId: string,
    changes: Record<string, unknown>,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(AuditLog)
      : this.auditLogRepository;
    const log = repo.create({
      userId,
      action,
      entity: "memberships",
      changes: { businessId, ...changes },
    });
    await repo.save(log);
  }
}
