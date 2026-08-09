import {
  Injectable,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  InternalHttpClient,
  OutboxService,
  TenantCrudService,
} from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Repository, DataSource } from "typeorm";
import { Professional } from "../../entities/professional.entity";
import { CategoriesService } from "../categories/categories.service";
import { ProfessionalService } from "../../entities/professional-service.entity";

/**
 * Gestiona el equipo de profesionales de un negocio: su ficha, los servicios
 * que presta cada uno y el vínculo con una cuenta de usuario.
 */
@Injectable()
export class ProfessionalsService extends TenantCrudService<Professional> {
  constructor(
    @InjectRepository(Professional)
    repo: Repository<Professional>,
    @InjectRepository(ProfessionalService)
    private readonly psRepo: Repository<ProfessionalService>,
    private readonly http: InternalHttpClient,
    private readonly categories: CategoriesService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService
  ) {
    super(repo, "Profesional no encontrado");
  }

  /** Comprueba que la categoría pertenece al negocio antes de asociarla. */
  private async validarCategoria(
    categoryId: string | undefined,
    businessId: string
  ): Promise<void> {
    if (!categoryId) return;
    await this.categories.findById(categoryId, businessId);
  }

  /** Da de alta un profesional en el negocio. */
  async create(
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    await this.validarCategoria(data.categoryId, businessId);
    const professional = this.repo.create({ ...data, businessId });

    return this.dataSource.transaction(async (manager) => {
      const creado = await manager
        .getRepository(Professional)
        .save(professional);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_PROFESSIONAL_CREATED,
        aggregateType: "professional",
        aggregateId: creado.id,
        payload: {
          professionalId: creado.id,
          businessId,
          name: creado.name,
          specialties: creado.specialties ?? [],
        },
      });

      return creado;
    });
  }

  /** Lista los profesionales del negocio (por defecto solo los activos). */
  async findByBusiness(
    businessId: string,
    activeOnly = true
  ): Promise<Professional[]> {
    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({ where, order: { createdAt: "ASC" as const } });
  }

  /** Actualiza la ficha de un profesional, validando antes su categoría. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    await this.validarCategoria(data.categoryId, businessId);
    return super.update(id, businessId, data);
  }

  /** Asigna un servicio a un profesional, con precio/duración propios opcionales. */
  async assignService(
    professionalId: string,
    serviceId: string,
    businessId: string,
    customPrice?: number,
    customDuration?: number
  ): Promise<ProfessionalService> {
    // Verifica que el profesional pertenezca al negocio del llamante.
    await this.findById(professionalId, businessId);

    const ps = this.psRepo.create({
      professionalId,
      serviceId,
      customPrice,
      customDuration,
    });
    return this.psRepo.save(ps);
  }

  /** Quita la asignación de un servicio a un profesional. */
  async removeServiceAssignment(
    professionalId: string,
    serviceId: string,
    businessId: string
  ): Promise<void> {
    // Verifica que el profesional pertenezca al negocio del llamante.
    await this.findById(professionalId, businessId);
    await this.psRepo.delete({ professionalId, serviceId });
  }

  /** Lista los servicios que presta un profesional. */
  async getServices(
    professionalId: string,
    businessId: string
  ): Promise<ProfessionalService[]> {
    // Verifica que el profesional pertenezca al negocio del llamante.
    await this.findById(professionalId, businessId);
    return this.psRepo.find({ where: { professionalId } });
  }

  /** Da de baja un profesional, siempre que no tenga citas por atender. */
  async remove(id: string, businessId: string): Promise<void> {
    const professional = await this.findById(id, businessId);

    // Verificar historial de citas via booking-service
    const hasHistory = await this.checkProfessionalHistory(id, businessId);
    if (hasHistory.hasActiveAppointments) {
      throw new BadRequestException(
        "No se puede inactivar este profesional porque tiene citas pendientes o confirmadas. " +
          "Cancela o reasigna las citas antes de inactivarlo."
      );
    }

    await this.deactivate(professional.id, businessId);
  }

  // --- Vinculacion con cuenta de usuario ---

  /** Vincula un profesional con una cuenta de usuario del auth-service. */
  async linkUser(
    id: string,
    businessId: string,
    userId: string
  ): Promise<Professional> {
    const professional = await this.findById(id, businessId);

    if (professional.userId) {
      throw new ConflictException(
        "Este profesional ya tiene una cuenta de usuario vinculada"
      );
    }

    // Verificar que no haya otro profesional con el mismo userId en este negocio
    const existing = await this.repo.findOne({
      where: { userId, businessId, active: true },
    });
    if (existing) {
      throw new ConflictException(
        "Ya existe otro profesional vinculado a este usuario en el negocio"
      );
    }

    await this.repo.update({ id, businessId }, { userId });
    return this.findById(id, businessId);
  }

  /** Desvincula la cuenta de usuario de un profesional. */
  async unlinkUser(id: string, businessId: string): Promise<Professional> {
    const professional = await this.findById(id, businessId);

    if (!professional.userId) {
      throw new ConflictException(
        "Este profesional no tiene una cuenta de usuario vinculada"
      );
    }

    await this.repo.update({ id, businessId }, {
      userId: null,
    } as unknown as Parameters<typeof this.repo.update>[1]);
    return this.findById(id, businessId);
  }

  // --- Helpers ---

  /**
   * Consulta a booking el historial de citas del profesional; si booking no
   * responde, el error se propaga y la baja queda bloqueada.
   */
  private async checkProfessionalHistory(
    professionalId: string,
    businessId: string
  ): Promise<{
    hasHistory: boolean;
    hasActiveAppointments: boolean;
    totalAppointments: number;
  }> {
    const result = await this.http.pedir<{
      totalAppointments?: unknown;
      completedAppointments?: unknown;
      hasHistory?: unknown;
    }>(
      "booking",
      `/internal/appointments/professional/${professionalId}/has-history?businessId=${businessId}`
    );

    // Coercion segura: valores faltantes/no-numericos se tratan como 0
    const totalAppointments = Number(result?.totalAppointments) || 0;
    const completedAppointments = Number(result?.completedAppointments) || 0;

    return {
      hasHistory: Boolean(result?.hasHistory) || totalAppointments > 0,
      hasActiveAppointments: totalAppointments - completedAppointments > 0,
      totalAppointments,
    };
  }
}
