import { Injectable, Logger } from "@nestjs/common";
import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { finExtendido } from "@beautyspot/shared-utils";

/** Rango de horas de pared, con el mismo contrato que un tramo de agenda. */
export interface Tramo {
  startTime: string;
  endTime: string;
}

/** Tramo de apertura tal y como lo devuelve core. */
interface TramoDeApertura {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

const TTL_SEGUNDOS = 600;

/** Horario de apertura del negocio, cacheado, que acota la agenda del equipo. */
@Injectable()
export class HorarioDelNegocioService {
  private readonly logger = new Logger(HorarioDelNegocioService.name);

  constructor(
    private readonly http: InternalHttpClient,
    private readonly cache: RedisCacheService
  ) {}

  /**
   * Tramos de apertura de ese día. Lista vacía es "cerrado ese día"; `null`,
   * "sin horario configurado", que no restringe nada.
   *
   * El cierre llega en hora de reloj y aquí pasa a la escala del cálculo: un
   * `20:00`–`02:00` sale como `20:00`–`26:00`, que es lo que entienden el
   * arrastre de jornada y el reparto de franjas.
   */
  async tramosDelDia(
    businessId: string,
    dayOfWeek: number
  ): Promise<Tramo[] | null> {
    const semana = await this.semana(businessId);
    if (semana === null) return null;

    return semana
      .filter((t) => t.dayOfWeek === dayOfWeek)
      .map((t) => ({
        startTime: t.openTime,
        endTime: finExtendido(t.openTime, t.closeTime),
      }));
  }

  /** Horario completo del negocio, o `null` si no se pudo resolver. */
  private async semana(businessId: string): Promise<TramoDeApertura[] | null> {
    return this.cache.remember(
      `horario:negocio:${businessId}`,
      TTL_SEGUNDOS,
      () => this.consultar(businessId)
    );
  }

  /** Pide el horario a core. Falla en abierto: sin respuesta, `null`. */
  private async consultar(
    businessId: string
  ): Promise<TramoDeApertura[] | null> {
    const tramos = await this.http.pedirONulo<TramoDeApertura[]>(
      "core",
      `/internal/business-hours?businessId=${businessId}`
    );

    if (!Array.isArray(tramos)) {
      this.logger.warn(
        `No se pudo resolver el horario de ${businessId}: no se aplica el limite de apertura`
      );
      return null;
    }

    // Sin ningún tramo, el negocio no tiene horario configurado.
    return tramos.length > 0 ? tramos : null;
  }
}
