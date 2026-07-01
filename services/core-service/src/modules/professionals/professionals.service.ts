import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Professional } from "../../entities/professional.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private readonly repo: Repository<Professional>,
    @InjectRepository(ProfessionalService)
    private readonly psRepo: Repository<ProfessionalService>,
    private readonly configService: ConfigService
  ) {}

  async create(
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    const professional = this.repo.create({ ...data, businessId });
    return this.repo.save(professional);
  }

  async findByBusiness(
    businessId: string,
    activeOnly = true
  ): Promise<Professional[]> {
    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({ where, order: { createdAt: "ASC" as const } });
  }

  async findById(id: string, businessId: string): Promise<Professional> {
    const professional = await this.repo.findOne({ where: { id, businessId } });
    if (!professional) throw new NotFoundException("Profesional no encontrado");
    return professional;
  }

  async update(
    id: string,
    businessId: string,
    data: Partial<Professional>
  ): Promise<Professional> {
    await this.repo.update({ id, businessId }, data as any);
    return this.findById(id, businessId);
  }

  async assignService(
    professionalId: string,
    serviceId: string,
    customPrice?: number,
    customDuration?: number
  ): Promise<ProfessionalService> {
    const ps = this.psRepo.create({
      professionalId,
      serviceId,
      customPrice,
      customDuration,
    });
    return this.psRepo.save(ps);
  }

  async removeServiceAssignment(
    professionalId: string,
    serviceId: string
  ): Promise<void> {
    await this.psRepo.delete({ professionalId, serviceId });
  }

  async getServices(professionalId: string): Promise<ProfessionalService[]> {
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

    await this.repo.update({ id, businessId }, { userId: null as any });
    return this.findById(id, businessId);
  }

  // --- Helpers ---

  /**
   * Consulta al booking-service si el profesional tiene historial de citas.
   * Usa el endpoint interno del booking-service via HTTP.
   */
  private async checkProfessionalHistory(professionalId: string): Promise<{
    hasHistory: boolean;
    hasActiveAppointments: boolean;
    totalAppointments: number;
  }> {
    try {
      const bookingUrl = this.configService.get<string>(
        "BOOKING_SERVICE_URL",
        "http://localhost:3003"
      );
      const internalSecret = this.configService.get<string>(
        "INTERNAL_API_SECRET",
        ""
      );

      const response = await fetch(
        `${bookingUrl}/internal/appointments/professional/${professionalId}/has-history`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
        }
      );

      if (!response.ok) {
        // Si no se puede verificar, permitir la accion pero loguear
        console.warn(
          `No se pudo verificar historial del profesional ${professionalId}`
        );
        return {
          hasHistory: false,
          hasActiveAppointments: false,
          totalAppointments: 0,
        };
      }

      const data = (await response.json()) as {
        hasHistory: boolean;
        totalAppointments: number;
        completedAppointments: number;
      };
      const result =
        typeof data === "object" && "data" in data ? (data as any).data : data;

      return {
        hasHistory: result.hasHistory || false,
        hasActiveAppointments:
          result.totalAppointments - result.completedAppointments > 0,
        totalAppointments: result.totalAppointments || 0,
      };
    } catch (error) {
      // Si el booking-service no esta disponible, permitir la accion
      console.warn(
        `Error verificando historial del profesional ${professionalId}:`,
        error
      );
      return {
        hasHistory: false,
        hasActiveAppointments: false,
        totalAppointments: 0,
      };
    }
  }
}
