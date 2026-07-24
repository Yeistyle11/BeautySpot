import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { DateRangeQueryDto } from "./dto/report-query.dto";

/** Endpoints de reportes del negocio por rango de fechas (ingresos, profesionales y citas). */
@Controller("reports")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  /** Reporte de ingresos del periodo. */
  @Get("revenue")
  async getRevenueReport(
    @BusinessId() businessId: string,
    @Query() query: DateRangeQueryDto
  ) {
    return this.service.getRevenueReport(businessId, query.from, query.to);
  }

  /** Reporte de desempeño por profesional del periodo. */
  @Get("professionals")
  async getProfessionalsReport(
    @BusinessId() businessId: string,
    @Query() query: DateRangeQueryDto
  ) {
    return this.service.getProfessionalsReport(
      businessId,
      query.from,
      query.to
    );
  }

  /** Reporte de citas del periodo (totales y tasas). */
  @Get("appointments")
  async getAppointmentsReport(
    @BusinessId() businessId: string,
    @Query() query: DateRangeQueryDto
  ) {
    return this.service.getAppointmentsReport(businessId, query.from, query.to);
  }
}
