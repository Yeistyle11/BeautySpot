import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Professional } from "../../entities/professional.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

/**
 * Gestiona el equipo de profesionales de un negocio: su ficha, los servicios
 * que presta cada uno y el vínculo con una cuenta de usuario.
 */
@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private readonly repo: Repository<Professional>,
    @InjectRepository(ProfessionalService)
    private readonly psRepo: Repository<ProfessionalService>,
    private readonly configService: ConfigService
  ) {}

  /** Da de alta un profesional en el negocio. */
  async create(
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    const professional = this.repo.create({ ...data, businessId });
    return this.repo.save(professional);
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

  /** Obtiene un profesional del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<Professional> {
    const professional = await this.repo.findOne({ where: { id, businessId } });
    if (!professional) throw new NotFoundException("Profesional no encontrado");
    return professional;
  }

  /** Actualiza la ficha de un profesional. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    await this.repo.update(
      { id, businessId },
      data as Parameters<typeof this.repo.update>[1]
    );
    return this.findById(id, businessId);
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

  /**
   * Inactiva un profesional (soft-delete).
   * Valida que no tenga citas pendientes o confirmadas antes de inactivar.
   * Si tiene historial de citas completadas, solo se puede inactivar (no eliminar).
   */
  async remove(id: string, businessId: string): Promise<void> {
    const professional = await this.findById(id, businessId);

    // Verificar historial de citas via booking-service
    const hasHistory = await this.checkProfessionalHistory(id);
    if (hasHistory.hasActiveAppointments) {
      throw new BadRequestException(
        "No se puede inactivar este profesional porque tiene citas pendientes o confirmadas. " +
          "Cancela o reasigna las citas antes de inactivarlo."
      );
    }

    await this.repo.update(
      { id: professional.id, businessId },
      { active: false }
    );
  }

  // --- Vinculacion con cuenta de usuario ---

  /**
   * Vincula un profesional con una cuenta de usuario (userId del auth-service).
   */
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

  /**
   * Desvincula la cuenta de usuario de un profesional.
   */
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
   * Consulta al booking-service si el profesional tiene historial de citas.
   * Usa el endpoint interno del booking-service via HTTP.
   *
   * Fail-closed: si el booking-service no esta disponible o responde con
   * error, la accion se BLOQUEA (no se permite inactivar al profesional).
   * Esto evita inactivar profesionales con citas activas cuando no se puede
   * verificar su historial de forma segura.
   */
  private async checkProfessionalHistory(professionalId: string): Promise<{
    hasHistory: boolean;
    hasActiveAppointments: boolean;
    totalAppointments: number;
  }> {
    const bookingUrl = this.configService.get<string>(
      "BOOKING_SERVICE_URL",
      "http://localhost:3003"
    );
    const internalSecret = this.configService.get<string>(
      "INTERNAL_API_SECRET",
      ""
    );

    let response: Response;
    try {
      response = await fetch(
        `${bookingUrl}/internal/appointments/professional/${professionalId}/has-history`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
        }
      );
    } catch (error) {
      // Fail-closed: error de red/DNS/timeout bloquea la accion
      throw new ServiceUnavailableException(
        `No se pudo verificar el historial del profesional (booking-service no disponible). ` +
          `Reintenta mas tarde. Error: ${
            error instanceof Error ? error.message : String(error)
          }`
      );
    }

    if (!response.ok) {
      // Fail-closed: respuesta no-2xx bloquea la accion
      throw new ServiceUnavailableException(
        `No se pudo verificar el historial del profesional (booking-service respondio ${response.status}). ` +
          `Reintenta mas tarde.`
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new InternalServerErrorException(
        `Respuesta invalida del booking-service al verificar historial: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const result = (
      typeof data === "object" && data !== null && "data" in data
        ? (data as Record<string, unknown>).data
        : data
    ) as
      | {
          totalAppointments?: unknown;
          completedAppointments?: unknown;
          hasHistory?: unknown;
        }
      | null
      | undefined;

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
