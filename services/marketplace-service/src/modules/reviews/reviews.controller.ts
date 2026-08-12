import {
  Controller,
  Get,
  Post,
  Patch,
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
  MisResenasQueryDto,
  RespondReviewDto,
  UpdateReviewDto,
  ReportReviewDto,
  ModerarReviewDto,
} from "./dto/review.dto";
import {
  Roles,
  Public,
  CurrentUser,
  BusinessId,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { parsePaginationQuery } from "@beautyspot/shared-utils";

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

  /**
   * Reseñas escritas por el usuario autenticado, paginadas.
   *
   * Con `appointmentIds` responde solo por esas citas, que es lo que necesita el
   * listado del cliente para marcar cuáles ya valoró sin arrastrar un historial
   * que crece con cada visita.
   */
  @Get("mine")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async findMine(
    @CurrentUser("userId") userId: string,
    @Query() query: MisResenasQueryDto
  ) {
    const pagination = parsePaginationQuery(query as Record<string, unknown>, [
      "createdAt",
    ]);
    return this.service.findByClientUser(
      userId,
      pagination,
      query.appointmentIds
    );
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

  /** Corrige la reseña propia; ni la cita ni el negocio se pueden cambiar. */
  @Patch(":id")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateReviewDto
  ) {
    return this.service.update(id, userId, dto);
  }

  /** Borra la reseña propia; la cita queda libre para reseñarla de nuevo. */
  @Delete(":id")
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string
  ) {
    await this.service.remove(id, userId);
    return { deleted: true };
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

  /** Reescribe la respuesta del negocio. */
  @Patch(":id/respond")
  @Roles(Role.OWNER, Role.ADMIN)
  async editarRespuesta(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string,
    @Body() dto: RespondReviewDto
  ) {
    return this.service.editarRespuesta(id, businessId, dto.response);
  }

  /** Retira la respuesta del negocio, dejando la reseña sin contestar. */
  @Delete(":id/respond")
  @Roles(Role.OWNER, Role.ADMIN)
  async borrarRespuesta(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string
  ) {
    return this.service.borrarRespuesta(id, businessId);
  }

  /** Denuncia una reseña; una por usuario y reseña. */
  @Post(":id/report")
  @SkipBusinessScope()
  async denunciar(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: ReportReviewDto
  ) {
    return this.service.denunciar(id, userId, dto);
  }

  /** Oculta o vuelve a publicar una reseña del negocio. */
  @Patch(":id/moderar")
  @Roles(Role.OWNER, Role.ADMIN)
  async moderar(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string,
    @Body() dto: ModerarReviewDto
  ) {
    return this.service.moderar(id, businessId, dto.status);
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
