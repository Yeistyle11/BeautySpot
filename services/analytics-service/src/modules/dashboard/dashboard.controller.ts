import { Controller, Get, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  TopProfessionalsQueryDto,
  RevenueChartQueryDto,
} from "./dto/dashboard-query.dto";
import { RangoQueryDto, rangoPedido } from "../../common/rango.dto";

/** Endpoints del dashboard: KPIs, ranking de profesionales y gráfica de ingresos. */
@Controller("dashboard")
@Roles(Role.SUPER_ADMIN, Role.OWNER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /**
   * KPIs del negocio: las cifras de hoy y las del periodo pedido.
   *
   * Sin periodo son los últimos treinta días. Con `comparar` vienen además las
   * del periodo anterior de la misma duración, que es lo que permite responder
   * "¿cómo me fue este mes contra el pasado?".
   */
  @Get("kpis")
  async getKPIs(
    @BusinessId() businessId: string,
    @Query() query: RangoQueryDto
  ) {
    return this.service.getKPIs(
      businessId,
      rangoPedido(query) ?? undefined,
      query.comparar
    );
  }

  /** Devuelve el ranking de profesionales por ingresos. */
  @Get("top-professionals")
  async getTopProfessionals(
    @BusinessId() businessId: string,
    @Query() query: TopProfessionalsQueryDto
  ) {
    return this.service.getTopProfessionals(
      businessId,
      query.limit ?? 10,
      rangoPedido(query) ?? undefined
    );
  }

  /** Devuelve la serie diaria para la gráfica de ingresos. */
  @Get("revenue-chart")
  async getRevenueChart(
    @BusinessId() businessId: string,
    @Query() query: RevenueChartQueryDto
  ) {
    return this.service.getRevenueChart(businessId, query.days ?? 30);
  }

  /** Retorno y frecuencia de visita de los clientes del negocio. */
  @Get("retencion")
  async getRetencion(@BusinessId() businessId: string) {
    return this.service.getRetencion(businessId);
  }

  /** Servicios ordenados por lo que ingresaron, con su ingreso por hora. */
  @Get("servicios")
  async getRentabilidadPorServicio(
    @BusinessId() businessId: string,
    @Query() query: RangoQueryDto
  ) {
    return this.service.getRentabilidadPorServicio(
      businessId,
      rangoPedido(query) ?? undefined
    );
  }
}
