import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AppointmentStatus, Role } from "@beautyspot/shared-types";
import {
  Roles,
  Public,
  BusinessId,
  CurrentUser,
} from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import {
  CreateAppointmentDto,
  CancelDto,
  RescheduleDto,
} from "./dto/appointment.dto";

/** Endpoints de gestión de citas del negocio (crear, listar y transiciones de estado). */
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  /** Crea una cita a nombre del personal del negocio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  async create(
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateAppointmentDto
  ) {
    return this.service.create(businessId, {
      ...dto,
      createdBy: userId,
    });
  }

  /** Devuelve los slots disponibles de un profesional en una fecha para una duración. */
  @Get("availability")
  async getAvailability(
    @BusinessId() businessId: string,
    @Query("professionalId") professionalId: string,
    @Query("date") date: string,
    @Query("duration") duration: string
  ) {
    return this.service.findAvailableSlots(
      businessId,
      professionalId,
      date,
      Number(duration)
    );
  }

  /** Lista las citas del negocio con filtros y paginación. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>,
    @Query("status") status?: AppointmentStatus,
    @Query("date") date?: string,
    @Query("professionalId") professionalId?: string,
    @Query("clientId") clientId?: string
  ) {
    const pagination = parsePaginationQuery(query, [
      "date",
      "startTime",
      "createdAt",
      "updatedAt",
    ]);
    return this.service.findByBusiness(
      businessId,
      { status, date, professionalId, clientId },
      pagination
    );
  }

  /** Obtiene una cita por id. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Confirma una cita pendiente. */
  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/confirm")
  async confirm(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.confirm(id, businessId);
  }

  /** Marca el inicio del servicio de una cita confirmada. */
  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/start")
  async start(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.startService(id, businessId);
  }

  /** Completa la cita y otorga los puntos de fidelidad. */
  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/complete")
  async complete(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.complete(id, businessId);
  }

  /** Cancela una cita aplicando la política de anticipación. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post(":id/cancel")
  async cancel(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CancelDto
  ) {
    return this.service.cancel(id, businessId, dto.reason, userId);
  }

  /** Marca la cita como "no asistió". */
  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/no-show")
  async noShow(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.markNoShow(id, businessId);
  }

  /** Reagenda la cita a una nueva fecha/hora. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id/reschedule")
  async reschedule(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: RescheduleDto
  ) {
    return this.service.reschedule(id, businessId, dto.date, dto.startTime, 30);
  }
}

/** Endpoint interno para que otros servicios consulten el historial de citas de un profesional. */
@Controller("internal/appointments")
@Public()
export class InternalAppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  /** Indica si un profesional tiene historial de citas (usado antes de eliminarlo). */
  @Get("professional/:professionalId/has-history")
  async professionalHasHistory(
    @Param("professionalId") professionalId: string
  ) {
    return this.service.professionalHasHistory(professionalId);
  }
}
