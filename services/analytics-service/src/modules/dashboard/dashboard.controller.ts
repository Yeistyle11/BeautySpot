import { Controller, Get, Query, Req } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { TopProfessionalsQueryDto, RevenueChartQueryDto } from "./dto/dashboard-query.dto";

@Controller("dashboard")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("kpis")
  async getKPIs(@Req() req: any) {
    return this.service.getKPIs(req.businessId);
  }

  @Get("top-professionals")
  async getTopProfessionals(@Req() req: any, @Query() query: TopProfessionalsQueryDto) {
    return this.service.getTopProfessionals(req.businessId, query.limit ?? 10);
  }

  @Get("revenue-chart")
  async getRevenueChart(@Req() req: any, @Query() query: RevenueChartQueryDto) {
    return this.service.getRevenueChart(req.businessId, query.days ?? 30);
  }
}
