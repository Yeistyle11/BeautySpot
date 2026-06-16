import { Controller, Get, Post, Body, Query, Req } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { UpsertDailyMetricDto, UpsertProfessionalMetricDto } from "./dto/metric.dto";
import { DateRangeQueryDto } from "../reports/dto/report-query.dto";

@Controller("metrics")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Post("daily")
  async upsertDaily(@Req() req: any, @Body() dto: UpsertDailyMetricDto) {
    return this.service.upsertDailyMetric({ ...dto, businessId: req.businessId });
  }

  @Post("professional")
  async upsertProfessional(@Req() req: any, @Body() dto: UpsertProfessionalMetricDto) {
    return this.service.upsertProfessionalMetric({ ...dto, businessId: req.businessId });
  }

  @Get()
  async getMetrics(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.service.getMetrics(req.businessId, query.from, query.to);
  }
}
