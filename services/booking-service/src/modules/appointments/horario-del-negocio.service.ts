import { Injectable, Logger } from "@nestjs/common";
import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { finExtendido } from "@beautyspot/shared-utils";

/** Rango de horas de pared, con el mismo contrato que un tramo de agenda. */
export interface Tramo {
  startTime: string;
  endTime: string;
}

/** Apertura de una fecha, ya resuelta por core contra sus días especiales. */
interface AperturaDelDia {
  tramos: { openTime: string; closeTime: string }[];
  origen: "semanal" | "especial";
  configurado: boolean;
  motivo?: string;
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
   * Tramos de apertura de esa fecha, en la escala del calculo. Lista vacia es
   * "cerrado"; `null`, "sin horario configurado", que no restringe nada.
   */
  async tramosDelDia(
    businessId: string,
    fecha: string
  ): Promise<Tramo[] | null> {
    const dia = await this.delDia(businessId, fecha);
    if (dia === null) return null;
    if (dia.origen === "semanal" && !dia.configurado) return null;

    return dia.tramos.map((t) => ({
      startTime: t.openTime,
      endTime: finExtendido(t.openTime, t.closeTime),
    }));
  }

  /** Apertura de esa fecha, cacheada por dia. */
  private async delDia(
    businessId: string,
    fecha: string
  ): Promise<AperturaDelDia | null> {
    return this.cache.remember(
      `horario:negocio:${businessId}:${fecha}`,
      TTL_SEGUNDOS,
      () => this.consultar(businessId, fecha)
    );
  }

  /** Pide la apertura a core. Falla en abierto: sin respuesta, `null`. */
  private async consultar(
    businessId: string,
    fecha: string
  ): Promise<AperturaDelDia | null> {
    const dia = await this.http.pedirONulo<AperturaDelDia>(
      "core",
      `/internal/business-hours/dia?businessId=${businessId}&date=${fecha}`
    );

    if (!dia || !Array.isArray(dia.tramos)) {
      this.logger.warn(
        `No se pudo resolver el horario de ${businessId} el ${fecha}: no se aplica el limite de apertura`
      );
      return null;
    }

    return dia;
  }
}
