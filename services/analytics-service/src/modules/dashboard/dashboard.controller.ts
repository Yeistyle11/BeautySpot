import { Controller, Get, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { TopProfessionalsQueryDto, RevenueChartQueryDto } from "./dto/dashboard-query.dto";

@Controller("dashboard")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("kpis")
  async getKPIs(@BusinessId() businessId: string) {
    return this.service.getKPIs(businessId);
  }

  @Get("top-professionals")
  async getTopProfessionals(@BusinessId() businessId: string, @Query() query: TopProfessionalsQueryDto) {
    return this.service.getTopProfessionals(businessId, query.limit ?? 10);
  }

  @Get("revenue-chart")
  async getRevenueChart(@BusinessId() businessId: string, @Query() query: RevenueChartQueryDto) {
    return this.service.getRevenueChart(businessId, query.days ?? 30);
  }
}
