import { Controller, Get, Post, Body, Query, Req } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  IncrementDailyMetricDto,
  IncrementProfessionalMetricDto,
} from "./dto/metric.dto";
import { DateRangeQueryDto } from "../reports/dto/report-query.dto";

interface AuthenticatedRequest {
  businessId: string;
}

@Controller("metrics")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Post("daily/increment")
  async incrementDaily(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IncrementDailyMetricDto
  ) {
    await this.service.incrementDailyMetric(req.businessId, dto.date, dto);
    return { message: "Métrica diaria actualizada" };
  }

  @Post("professional/increment")
  async incrementProfessional(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IncrementProfessionalMetricDto
  ) {
    await this.service.incrementProfessionalMetric(
      req.businessId,
      dto.professionalId,
      dto.date,
      dto
    );
    return { message: "Métrica profesional actualizada" };
  }

  @Get()
  async getMetrics(
    @Req() req: AuthenticatedRequest,
    @Query() query: DateRangeQueryDto
  ) {
    return this.service.getMetrics(req.businessId, query.from, query.to);
  }
}
