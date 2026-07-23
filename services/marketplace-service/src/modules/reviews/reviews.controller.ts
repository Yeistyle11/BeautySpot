import { Controller, Get, Post, Delete, Param, Body, Query } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto, ReviewQueryDto, RespondReviewDto } from "./dto/review.dto";
import { Roles, Public, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post()
  @Public()
  async create(@Body() dto: CreateReviewDto) {
    return this.service.create(dto);
  }

  @Get("business/:businessId/summary")
  @Public()
  async getSummary(@Param("businessId") businessId: string) {
    return this.service.getSummary(businessId);
  }

  @Get("business/:businessId")
  @Public()
  async findByBusiness(
    @Param("businessId") businessId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.service.findByBusiness(businessId, query);
  }

  @Get(":id")
  @Public()
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post(":id/respond")
  @Roles(Role.OWNER, Role.ADMIN)
  async respond(@Param("id") id: string, @Body() dto: RespondReviewDto) {
    return this.service.respond(id, dto.response);
  }

  @Post(":id/helpful")
  @Public()
  async markHelpful(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string | undefined,
  ) {
    await this.service.markHelpful(id, userId || "anonymous");
    return { marked: true };
  }

  @Delete(":id/helpful")
  @Public()
  async unmarkHelpful(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string | undefined,
  ) {
    await this.service.unmarkHelpful(id, userId || "anonymous");
    return { marked: false };
  }
}
