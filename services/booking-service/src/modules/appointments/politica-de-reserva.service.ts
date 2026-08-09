import { Injectable } from "@nestjs/common";
import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { HORAS_MINIMAS_CANCELACION } from "@beautyspot/shared-constants";

/** Ajustes de reserva que el negocio configura. */
interface PoliticaDeReserva {
  horasMinimasCancelacion?: number;
}

/** Lo que devuelve `/internal/profiles/resolve`, acotado a lo que se usa aquí. */
interface PerfilDelNegocio {
  business: { reservas?: PoliticaDeReserva } | null;
}

const TTL_SEGUNDOS = 600;

/** Reglas de reserva propias de cada negocio, cacheadas. */
@Injectable()
export class PoliticaDeReservaService {
  constructor(
    private readonly http: InternalHttpClient,
    private readonly cache: RedisCacheService
  ) {}

  /**
   * Antelación mínima con la que el cliente puede cancelar o reagendar. El
   * negocio no está sujeto a ella.
   */
  async horasMinimasDeCancelacion(businessId: string): Promise<number> {
    const politica = await this.cache.remember(
      `politica:reserva:${businessId}`,
      TTL_SEGUNDOS,
      () => this.consultar(businessId)
    );

    const horas = Number(politica.horasMinimasCancelacion);
    return Number.isFinite(horas) && horas >= 0
      ? horas
      : HORAS_MINIMAS_CANCELACION;
  }

  /** Pide la configuración a core. Falla en abierto: sin respuesta, la de serie. */
  private async consultar(businessId: string): Promise<PoliticaDeReserva> {
    const perfil = await this.http.pedirONulo<PerfilDelNegocio>(
      "core",
      `/internal/profiles/resolve?businessId=${businessId}`
    );

    return perfil?.business?.reservas ?? {};
  }
}
