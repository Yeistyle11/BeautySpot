import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";
import { AppointmentStatus, Role } from "@beautyspot/shared-types";
import {
  Roles,
  Public,
  BusinessId,
  CurrentUser,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import {
  CreateAppointmentDto,
  CancelDto,
  RescheduleDto,
  AvailabilityQueryDto,
} from "./dto/appointment.dto";

/** Endpoints de gestión de citas del negocio (crear, listar y transiciones de estado). */
@Controller("appointments")
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly disponibilidad: AvailabilityQueryService
  ) {}

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

  /** Franjas de un profesional, o de todo el equipo si solo llega el negocio. */
  @Public()
  @Get("availability")
  async getAvailability(@Query() query: AvailabilityQueryDto) {
    if (query.professionalId) {
      return this.disponibilidad.franjasDeProfesionalPublico(
        query.professionalId,
        query.date,
        query.duration
      );
    }

    if (query.businessId) {
      return this.disponibilidad.franjasDelNegocio(
        query.businessId,
        query.date,
        query.duration
      );
    }

    throw new BadRequestException(
      "Indica un profesional o el negocio para consultar la disponibilidad"
    );
  }

  /**
   * Citas del cliente autenticado. El filtro sale del token, nunca de la
   * query.
   */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Get("mine")
  async findMine(
    @CurrentUser("userId") userId: string,
    @Query() query: Record<string, unknown>
  ) {
    const pagination = parsePaginationQuery(query, [
      "date",
      "startTime",
      "createdAt",
    ]);
    return this.service.findByClientUser(userId, pagination);
  }

  /** Detalle de una cita propia del cliente. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Get("mine/:id")
  async findMineById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string
  ) {
    return this.service.findByIdForClientUser(id, userId);
  }

  /** Cancelación de una cita propia por parte del cliente. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Post("mine/:id/cancel")
  async cancelMine(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CancelDto
  ) {
    return this.service.cancelForClientUser(id, userId, dto.reason);
  }

  /** Reagendado de una cita propia por parte del cliente. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Patch("mine/:id/reschedule")
  async rescheduleMine(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: RescheduleDto
  ) {
    return this.service.rescheduleForClientUser(
      id,
      userId,
      dto.date,
      dto.startTime
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
    @Query("clientId") clientId?: string,
    @Query("search") search?: string
  ) {
    const pagination = parsePaginationQuery(query, [
      "date",
      "startTime",
      "createdAt",
      "updatedAt",
    ]);
    return this.service.findByBusiness(
      businessId,
      { status, date, professionalId, clientId, search },
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

  /** Cancela una cita desde el panel, sin la antelación mínima del cliente. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post(":id/cancel")
  async cancel(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: CancelDto
  ) {
    return this.service.cancel(id, businessId, dto.reason);
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
    return this.service.reschedule(id, businessId, dto.date, dto.startTime);
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
    @Param("professionalId") professionalId: string,
    @Query("businessId") businessId: string
  ) {
    return this.service.professionalHasHistory(professionalId, businessId);
  }

  /** Datos de cobro de una cita del negocio: importe, estado y cliente. */
  @Get(":appointmentId/cobro")
  async datosDeCobro(
    @Param("appointmentId") appointmentId: string,
    @Query("businessId") businessId: string
  ) {
    return this.service.datosDeCobro(appointmentId, businessId);
  }

  /** Indica si un usuario puede reseñar una cita (usada por el marketplace). */
  @Get(":appointmentId/resenable")
  async citaResenable(
    @Param("appointmentId") appointmentId: string,
    @Query("userId") userId: string,
    @Query("businessId") businessId: string
  ) {
    return this.service.citaReseñablePor(appointmentId, userId, businessId);
  }
}
