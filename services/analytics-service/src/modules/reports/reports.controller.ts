import { Controller, Get, Query, Req } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { DateRangeQueryDto } from "./dto/report-query.dto";

@Controller("reports")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("revenue")
  async getRevenueReport(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.service.getRevenueReport(req.businessId, query.from, query.to);
  }

  @Get("professionals")
  async getProfessionalsReport(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.service.getProfessionalsReport(req.businessId, query.from, query.to);
  }

  @Get("appointments")
  async getAppointmentsReport(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.service.getAppointmentsReport(req.businessId, query.from, query.to);
  }
}
