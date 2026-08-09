import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import {
  CreateReviewDto,
  ReviewQueryDto,
  RespondReviewDto,
} from "./dto/review.dto";
import {
  Roles,
  Public,
  CurrentUser,
  BusinessId,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints de reseñas del marketplace; la lectura es pública, el alta la firma un cliente y la respuesta la da el negocio. */
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  /**
   * Crea una reseña a nombre del usuario del token, no del cuerpo.
   *
   * `@SkipBusinessScope` se queda porque un cliente no lleva negocio en el
   * token; el negocio lo aporta la cita, que sí se verifica.
   */
  @Post()
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async create(
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateReviewDto
  ) {
    return this.service.create(dto, userId);
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

  /** Reseñas escritas por el usuario autenticado. */
  @Get("mine")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async findMine(@CurrentUser("userId") userId: string) {
    return this.service.findByClientUser(userId);
  }

  /** Reseñas de una cita concreta. */
  @Get("appointment/:appointmentId")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async findByAppointment(
    @Param("appointmentId", ParseUUIDPipe) appointmentId: string
  ) {
    return this.service.findByAppointment(appointmentId);
  }

  /** Obtiene una reseña por id. */
  @Get(":id")
  @Public()
  async findById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  /** Publica la respuesta del negocio a una reseña. */
  @Post(":id/respond")
  @Roles(Role.OWNER, Role.ADMIN)
  async respond(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string,
    @Body() dto: RespondReviewDto
  ) {
    return this.service.respond(id, businessId, dto.response);
  }

  /** Marca una reseña como útil; el voto es único por usuario y reseña. */
  @Post(":id/helpful")
  @SkipBusinessScope()
  async markHelpful(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string
  ) {
    await this.service.markHelpful(id, userId);
    return { marked: true };
  }

  /** Quita el voto de "útil" de una reseña. */
  @Delete(":id/helpful")
  @SkipBusinessScope()
  async unmarkHelpful(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string
  ) {
    await this.service.unmarkHelpful(id, userId);
    return { marked: false };
  }
}
