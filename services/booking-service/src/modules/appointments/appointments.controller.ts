import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { AppointmentStatus, Role } from "@beautyspot/shared-types";
import { Roles, Public } from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import {
  CreateAppointmentDto,
  CancelDto,
  RescheduleDto,
} from "./dto/appointment.dto";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateAppointmentDto) {
    return this.service.create(req.businessId, {
      ...dto,
      createdBy: req.user?.userId,
    });
  }

  @Get("availability")
  async getAvailability(
    @Req() req: any,
    @Query("professionalId") professionalId: string,
    @Query("date") date: string,
    @Query("duration") duration: string
  ) {
    return this.service.findAvailableSlots(
      req.businessId,
      professionalId,
      date,
      Number(duration)
    );
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(
    @Req() req: any,
    @Query("status") status?: AppointmentStatus,
    @Query("date") date?: string,
    @Query("professionalId") professionalId?: string,
    @Query("clientId") clientId?: string
  ) {
    const pagination = parsePaginationQuery(req.query, [
      "date",
      "startTime",
      "createdAt",
      "updatedAt",
    ]);
    return this.service.findByBusiness(
      req.businessId,
      { status, date, professionalId, clientId },
      pagination
    );
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/confirm")
  async confirm(@Param("id") id: string, @Req() req: any) {
    return this.service.confirm(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/start")
  async start(@Param("id") id: string, @Req() req: any) {
    return this.service.startService(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/complete")
  async complete(@Param("id") id: string, @Req() req: any) {
    return this.service.complete(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post(":id/cancel")
  async cancel(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: CancelDto
  ) {
    return this.service.cancel(
      id,
      req.businessId,
      dto.reason,
      req.user?.userId
    );
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
  @Post(":id/no-show")
  async noShow(@Param("id") id: string, @Req() req: any) {
    return this.service.markNoShow(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id/reschedule")
  async reschedule(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: RescheduleDto
  ) {
    return this.service.reschedule(
      id,
      req.businessId,
      dto.date,
      dto.startTime,
      30
    );
  }
}

@Controller("internal/appointments")
@Public()
export class InternalAppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get("professional/:professionalId/has-history")
  async professionalHasHistory(
    @Param("professionalId") professionalId: string
  ) {
    return this.service.professionalHasHistory(professionalId);
  }
}
