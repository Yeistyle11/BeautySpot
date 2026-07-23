import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { DateRangeQueryDto } from "./dto/report-query.dto";

@Controller("reports")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("revenue")
  async getRevenueReport(@BusinessId() businessId: string, @Query() query: DateRangeQueryDto) {
    return this.service.getRevenueReport(businessId, query.from, query.to);
  }

  @Get("professionals")
  async getProfessionalsReport(@BusinessId() businessId: string, @Query() query: DateRangeQueryDto) {
    return this.service.getProfessionalsReport(businessId, query.from, query.to);
  }

  @Get("appointments")
  async getAppointmentsReport(@BusinessId() businessId: string, @Query() query: DateRangeQueryDto) {
    return this.service.getAppointmentsReport(businessId, query.from, query.to);
  }
}
