import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Membership } from "../../entities/membership.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { Role } from "@beautyspot/shared-types";

export interface MembershipActor {
  userId: string;
  role: Role;
  businessId?: string;
}

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

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

    const membership = this.membershipRepository.create({
      ...data,
      acceptedAt: new Date(),
    });
    const saved = await this.membershipRepository.save(membership);

    if (actor) {
      await this.logAction(
        actor.userId,
        "MEMBERSHIP_CREATED",
        data.businessId,
        {
          targetUserId: data.userId,
          role: data.role,
        }
      );
    }
    return saved;
  }

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
    membership.role = newRole;
    const updated = await this.membershipRepository.save(membership);

    await this.logAction(
      actor.userId,
      "MEMBERSHIP_ROLE_CHANGED",
      membership.businessId,
      {
        membershipId,
        targetUserId: membership.userId,
        previousRole,
        newRole,
      }
    );
    return updated;
  }

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

    await this.membershipRepository.update(membershipId, { active: false });

    await this.logAction(
      actor.userId,
      "MEMBERSHIP_DEACTIVATED",
      membership.businessId,
      {
        membershipId,
        targetUserId: membership.userId,
        role: membership.role,
      }
    );
  }

  async findByUserAndBusiness(
    userId: string,
    businessId: string
  ): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
  }

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

  private async logAction(
    userId: string,
    action: string,
    businessId: string,
    changes: Record<string, unknown>
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      userId,
      action,
      entity: "memberships",
      changes: { businessId, ...changes },
    });
    await this.auditLogRepository.save(log);
  }
}
