import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  IncrementDailyMetricDto,
  IncrementProfessionalMetricDto,
} from "./dto/metric.dto";
import { DateRangeQueryDto } from "../reports/dto/report-query.dto";

@Controller("metrics")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Post("daily/increment")
  async incrementDaily(
    @BusinessId() businessId: string,
    @Body() dto: IncrementDailyMetricDto
  ) {
    await this.service.incrementDailyMetric(businessId, dto.date, dto);
    return { message: "Métrica diaria actualizada" };
  }

  @Post("professional/increment")
  async incrementProfessional(
    @BusinessId() businessId: string,
    @Body() dto: IncrementProfessionalMetricDto
  ) {
    await this.service.incrementProfessionalMetric(
      businessId,
      dto.professionalId,
      dto.date,
      dto
    );
    return { message: "Métrica profesional actualizada" };
  }

  @Get()
  async getMetrics(
    @BusinessId() businessId: string,
    @Query() query: DateRangeQueryDto
  ) {
    return this.service.getMetrics(businessId, query.from, query.to);
  }
}
