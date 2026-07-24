import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import {
  CreateReviewDto,
  ReviewQueryDto,
  RespondReviewDto,
} from "./dto/review.dto";
import { Roles, Public, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints de reseñas del marketplace; la lectura y el alta son públicas, la respuesta la da el negocio. */
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  /** Crea una reseña. */
  @Post()
  @Public()
  async create(@Body() dto: CreateReviewDto) {
    return this.service.create(dto);
  }

  /** Devuelve el resumen de reseñas (promedio y distribución) de un negocio. */
  @Get("business/:businessId/summary")
  @Public()
  async getSummary(@Param("businessId") businessId: string) {
    return this.service.getSummary(businessId);
  }

  /** Lista las reseñas de un negocio con filtros. */
  @Get("business/:businessId")
  @Public()
  async findByBusiness(
    @Param("businessId") businessId: string,
    @Query() query: ReviewQueryDto
  ) {
    return this.service.findByBusiness(businessId, query);
  }

  /** Obtiene una reseña por id. */
  @Get(":id")
  @Public()
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  /** Publica la respuesta del negocio a una reseña. */
  @Post(":id/respond")
  @Roles(Role.OWNER, Role.ADMIN)
  async respond(@Param("id") id: string, @Body() dto: RespondReviewDto) {
    return this.service.respond(id, dto.response);
  }

  /** Marca una reseña como útil. */
  @Post(":id/helpful")
  @Public()
  async markHelpful(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string | undefined
  ) {
    await this.service.markHelpful(id, userId || "anonymous");
    return { marked: true };
  }

  /** Quita el voto de "útil" de una reseña. */
  @Delete(":id/helpful")
  @Public()
  async unmarkHelpful(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string | undefined
  ) {
    await this.service.unmarkHelpful(id, userId || "anonymous");
    return { marked: false };
  }
}
