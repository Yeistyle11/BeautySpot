import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, Between } from "typeorm";
import { DailyMetricEntity } from "../../entities/daily-metric.entity";
import { ProfessionalMetricEntity } from "../../entities/professional-metric.entity";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { fechaDeHoy, fechaHaceDias } from "../../common/fecha";
import { diasEntre, periodoAnterior, type Rango } from "../../common/rango.dto";

/** Fila cruda del ranking, tal como la devuelve el agregado SQL. */
interface TopProfessionalRow {
  professionalId: string;
  appointments: string;
  revenue: string;
  avgRating: string;
}

/** Fila del ranking de profesionales: citas, ingresos y valoración media agregados. */
export interface TopProfessionalResult {
  professionalId: string;
  appointments: number;
  revenue: number;
  avgRating: number;
}

/** Cifras del negocio agregadas sobre un periodo, con el periodo que describen. */
export interface CifrasDelPeriodo {
  from: string;
  to: string;
  /** Días que abarca, extremos incluidos; es el divisor del promedio diario. */
  dias: number;
  totalRevenue: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  newClients: number;
  returningClients: number;
  avgDailyRevenue: number;
  /** Ingresos entre los cobros que los produjeron; nulo si no hubo ninguno. */
  avgTicket: number | null;
  /** Minutos vendidos sobre minutos disponibles, en porcentaje. */
  ocupacion: number;
}

/** Punto de la serie de ingresos que consume la gráfica del dashboard. */
export interface RevenuePoint {
  date: string;
  revenue: number;
}

/** Calcula los KPIs del dashboard a partir de las métricas agregadas del negocio. */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DailyMetricEntity)
    private readonly dailyRepo: Repository<DailyMetricEntity>,
    @InjectRepository(ProfessionalMetricEntity)
    private readonly profRepo: Repository<ProfessionalMetricEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly zonas: ZonaDelNegocioService
  ) {}

  /**
   * KPIs del negocio: cifras de hoy y agregados del periodo pedido.
   *
   * Sin periodo devuelve los últimos treinta días, que es lo que espera el
   * panel de inicio. La pantalla de reportes sí lo manda, porque un dueño
   * factura y declara por meses naturales y una ventana móvil no cuadra con
   * ningún papel que tenga sobre la mesa.
   */
  async getKPIs(
    businessId: string,
    rango?: Rango,
    comparar = false
  ): Promise<{
    today: Pick<
      DailyMetricEntity,
      "totalAppointments" | "totalRevenue" | "completedAppointments"
    > | null;
    periodo: CifrasDelPeriodo;
    comparado: CifrasDelPeriodo | null;
  }> {
    // Una sola lectura del huso para las dos cosas: el día en curso y, si no
    // llega periodo, la ventana por defecto que acaba en él.
    const { today, from } = await this.dateRange(businessId, 29);
    const periodo = rango ?? { from, to: today };

    const [cifras, todayMetrics, comparado] = await Promise.all([
      this.cifrasDe(businessId, periodo),
      this.dailyRepo.findOne({ where: { businessId, date: today } }),
      comparar
        ? this.cifrasDe(businessId, periodoAnterior(periodo))
        : Promise.resolve(null),
    ]);

    return {
      today: todayMetrics
        ? {
            totalAppointments: todayMetrics.totalAppointments,
            totalRevenue: todayMetrics.totalRevenue,
            completedAppointments: todayMetrics.completedAppointments,
          }
        : { totalAppointments: 0, totalRevenue: 0, completedAppointments: 0 },
      periodo: cifras,
      comparado,
    };
  }

  /**
   * Últimos treinta días en el huso del negocio, hoy incluido.
   *
   * Se retroceden veintinueve y no treinta porque el rango incluye los dos
   * extremos: treinta hacia atrás dan treinta y un días, y el promedio diario
   * repartía entre treinta lo que había sumado de treinta y uno.
   */
  private async ultimosTreintaDias(businessId: string): Promise<Rango> {
    const { today, from } = await this.dateRange(businessId, 29);
    return { from, to: today };
  }

  /** Agregados y tasas del negocio en un periodo cualquiera. */
  private async cifrasDe(
    businessId: string,
    rango: Rango
  ): Promise<CifrasDelPeriodo> {
    const { from, to } = rango;
    const dias = diasEntre(from, to);

    const aggregates = await this.dailyRepo
      .createQueryBuilder("m")
      .select("COALESCE(SUM(m.total_revenue), 0)", "totalRevenue")
      .addSelect("COALESCE(SUM(m.total_appointments), 0)", "totalAppointments")
      .addSelect(
        "COALESCE(SUM(m.completed_appointments), 0)",
        "completedAppointments"
      )
      .addSelect(
        "COALESCE(SUM(m.cancelled_appointments), 0)",
        "cancelledAppointments"
      )
      .addSelect(
        "COALESCE(SUM(m.no_show_appointments), 0)",
        "noShowAppointments"
      )
      .addSelect("COALESCE(SUM(m.new_clients), 0)", "newClients")
      .addSelect("COALESCE(SUM(m.returning_clients), 0)", "returningClients")
      .addSelect("COALESCE(SUM(m.ventas), 0)", "ventas")
      // Solo los ingresos de los días cuyas ventas están contadas: promediar
      // sobre los otros daría un ticket inflado, con el importe de días que
      // no aportan divisor.
      .addSelect(
        "COALESCE(SUM(m.total_revenue) FILTER (WHERE m.ventas > 0), 0)",
        "revenueDeVentas"
      )
      .where("m.business_id = :businessId", { businessId })
      .andWhere("m.date BETWEEN :from AND :to", { from, to })
      .getRawOne<{
        totalRevenue: string;
        totalAppointments: string;
        completedAppointments: string;
        cancelledAppointments: string;
        noShowAppointments: string;
        newClients: string;
        returningClients: string;
        ventas: string;
        revenueDeVentas: string;
      }>();

    const agg = aggregates ?? {
      totalRevenue: "0",
      totalAppointments: "0",
      completedAppointments: "0",
      cancelledAppointments: "0",
      noShowAppointments: "0",
      newClients: "0",
      returningClients: "0",
      ventas: "0",
      revenueDeVentas: "0",
    };
    const totalRevenue = Number(agg.totalRevenue);
    const totalAppointments = Number(agg.totalAppointments);
    const completedAppointments = Number(agg.completedAppointments);
    const cancelledAppointments = Number(agg.cancelledAppointments);
    const noShowAppointments = Number(agg.noShowAppointments);
    const newClients = Number(agg.newClients);
    const returningClients = Number(agg.returningClients);
    const ventas = Number(agg.ventas);
    const revenueDeVentas = Number(agg.revenueDeVentas);

    return {
      from,
      to,
      dias,
      totalRevenue,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      completionRate: this.percentage(completedAppointments, totalAppointments),
      cancellationRate: this.percentage(
        cancelledAppointments,
        totalAppointments
      ),
      noShowRate: this.percentage(noShowAppointments, totalAppointments),
      newClients,
      returningClients,
      // Entre los días del periodo, no entre los que tuvieron movimiento:
      // es el promedio diario del negocio, no el de sus días activos.
      avgDailyRevenue: dias > 0 ? Math.round(totalRevenue / dias) : 0,
      // Entre los cobros, no entre las citas atendidas: hay ventas sin cita, y
      // una cita atendida puede cobrarse otro día o no cobrarse aún. Sin
      // cobros no es que el ticket valga cero, es que no hay ticket: un cero
      // ahí se lee como "este negocio no vende".
      avgTicket: ventas > 0 ? Math.round(revenueDeVentas / ventas) : null,
      ocupacion: await this.ocupacion(businessId, from, to),
    };
  }

  /** Porcentaje de la agenda vendido en el periodo. */
  private async ocupacion(
    businessId: string,
    from: string,
    to: string
  ): Promise<number> {
    const [fila] = (await this.dataSource.query(
      `SELECT COALESCE(SUM(minutos_vendidos), 0) AS vendidos,
              COALESCE(SUM(minutos_disponibles), 0) AS disponibles
       FROM capacity_daily
       WHERE business_id = $1 AND date BETWEEN $2 AND $3`,
      [businessId, from, to]
    )) as { vendidos: string; disponibles: string }[];

    return this.percentage(Number(fila?.vendidos), Number(fila?.disponibles));
  }

  /**
   * Cuántos clientes del periodo habían venido antes, y cada cuánto vuelven los
   * que repiten.
   */
  async getRetencion(businessId: string): Promise<{
    clientes: number;
    recurrentes: number;
    tasaDeRetorno: number;
    diasEntreVisitas: number;
  }> {
    const [fila] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS clientes,
              COUNT(*) FILTER (WHERE visitas > 1)::int AS recurrentes,
              COALESCE(AVG(
                CASE WHEN visitas > 1
                  THEN (ultima_visita - primera_visita)::numeric / (visitas - 1)
                END
              ), 0) AS dias_entre_visitas
       FROM client_metrics
       WHERE business_id = $1`,
      [businessId]
    )) as {
      clientes: number;
      recurrentes: number;
      dias_entre_visitas: string;
    }[];

    return {
      clientes: fila?.clientes ?? 0,
      recurrentes: fila?.recurrentes ?? 0,
      tasaDeRetorno: this.percentage(
        fila?.recurrentes ?? 0,
        fila?.clientes ?? 0
      ),
      diasEntreVisitas: Math.round(Number(fila?.dias_entre_visitas ?? 0)),
    };
  }

  /** Servicios del periodo ordenados por lo que ingresaron. */
  async getRentabilidadPorServicio(
    businessId: string,
    rango?: Rango
  ): Promise<
    {
      serviceId: string;
      serviceName: string;
      veces: number;
      ingresos: number;
      minutos: number;
      ingresoPorHora: number;
    }[]
  > {
    const { from, to } = rango ?? (await this.ultimosTreintaDias(businessId));

    const filas = (await this.dataSource.query(
      `SELECT service_id, service_name,
              SUM(veces)::int AS veces,
              SUM(ingresos) AS ingresos,
              SUM(minutos)::int AS minutos
       FROM service_metrics
       WHERE business_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY service_id, service_name
       ORDER BY SUM(ingresos) DESC`,
      [businessId, from, to]
    )) as {
      service_id: string;
      service_name: string;
      veces: number;
      ingresos: string;
      minutos: number;
    }[];

    return filas.map((f) => ({
      serviceId: f.service_id,
      serviceName: f.service_name,
      veces: f.veces,
      ingresos: Number(f.ingresos),
      minutos: f.minutos,
      // Ingreso por cada hora de agenda que ocupó el servicio.
      ingresoPorHora:
        f.minutos > 0 ? Math.round((Number(f.ingresos) / f.minutos) * 60) : 0,
    }));
  }

  /** Ranking de profesionales por ingresos en el periodo. */
  async getTopProfessionals(
    businessId: string,
    limit = 10,
    rango?: Rango
  ): Promise<TopProfessionalResult[]> {
    const { from, to } = rango ?? (await this.ultimosTreintaDias(businessId));

    const rows = await this.profRepo
      .createQueryBuilder("pm")
      .select("pm.professional_id", "professionalId")
      .addSelect("SUM(pm.appointments)", "appointments")
      .addSelect("SUM(pm.revenue)", "revenue")
      .addSelect("AVG(pm.rating)", "avgRating")
      .where("pm.business_id = :businessId", { businessId })
      .andWhere("pm.date BETWEEN :from AND :to", { from, to })
      .groupBy("pm.professional_id")
      // Se ordena por la expresión y no por el alias: Postgres pasa a
      // minúsculas cualquier identificador sin comillas.
      .orderBy("SUM(pm.revenue)", "DESC")
      .limit(limit)
      .getRawMany<TopProfessionalRow>();

    // Los agregados de Postgres llegan como cadena; el contrato de la API son
    // números, y quien lo consume los ordena y los formatea como tales.
    return rows.map((row) => ({
      professionalId: row.professionalId,
      appointments: Number(row.appointments),
      revenue: Number(row.revenue),
      avgRating: Math.round(Number(row.avgRating) * 100) / 100,
    }));
  }

  /** Serie diaria de ingresos de los últimos N días. */
  async getRevenueChart(
    businessId: string,
    days = 30
  ): Promise<RevenuePoint[]> {
    const { today, from } = await this.dateRange(businessId, days);

    const filas = await this.dailyRepo.find({
      where: { businessId, date: Between(from, today) },
      order: { date: "ASC" },
    });

    return filas.map((fila) => ({
      date: fila.date,
      revenue: fila.totalRevenue,
    }));
  }

  /**
   * Devuelve la fecha de hoy y la de hace N días en formato YYYY-MM-DD, leídas
   * en el huso del negocio.
   */
  private async dateRange(
    businessId: string,
    days: number
  ): Promise<{
    today: string;
    from: string;
    thirtyDaysAgo: string;
    dias: number;
  }> {
    const zona = await this.zonas.de(businessId);
    const today = fechaDeHoy(zona);
    const from = fechaHaceDias(zona, days);
    return { today, from, thirtyDaysAgo: from, dias: days };
  }

  /** Porcentaje entero de `part` sobre `total`; 0 si el total es cero. */
  private percentage(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }
}
