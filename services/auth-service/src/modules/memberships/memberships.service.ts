import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Membership } from "../../entities/membership.entity";
import { Role } from "@beautyspot/shared-types";

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async create(data: { userId: string; businessId: string; role: Role; invitedBy?: string }): Promise<Membership> {
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
    return this.membershipRepository.save(membership);
  }

  async updateRole(membershipId: string, newRole: Role, requesterRole: Role): Promise<Membership> {
    const membership = await this.membershipRepository.findOne({ where: { id: membershipId } });
    if (!membership) {
      throw new NotFoundException("Membresía no encontrada");
    }

    if (membership.role === Role.OWNER && requesterRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Solo un Super Admin puede cambiar el rol del dueño");
    }

    membership.role = newRole;
    return this.membershipRepository.save(membership);
  }

  async deactivate(membershipId: string): Promise<void> {
    const membership = await this.membershipRepository.findOne({ where: { id: membershipId } });
    if (!membership) {
      throw new NotFoundException("Membresía no encontrada");
    }

    if (membership.role === Role.OWNER) {
      throw new ForbiddenException("No se puede desactivar al dueño del negocio");
    }

    await this.membershipRepository.update(membershipId, { active: false });
  }

  async findByUserAndBusiness(userId: string, businessId: string): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId, businessId, active: true },
    });
  }

  async findByBusiness(businessId: string): Promise<Membership[]> {
    return this.membershipRepository.find({
      where: { businessId, active: true },
      relations: ["user"],
    });
  }
}
