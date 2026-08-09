import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ZONA_POR_DEFECTO } from "@beautyspot/shared-utils";
import { InternalHttpClient } from "../http/internal-http.client";
import { RedisCacheService } from "../cache/redis-cache.service";

/** Lo que interesa de `/internal/profiles/resolve` para resolver el huso. */
interface PerfilDelNegocio {
  business: { timezone?: string } | null;
}

const TTL_SEGUNDOS = 3600;

/** Resuelve en qué huso horario opera cada negocio. */
@Injectable()
export class ZonaDelNegocioService {
  private readonly logger = new Logger(ZonaDelNegocioService.name);
  private readonly zonaPorDefecto: string;

  constructor(
    private readonly http: InternalHttpClient,
    private readonly cache: RedisCacheService,
    configService: ConfigService
  ) {
    this.zonaPorDefecto =
      configService.get<string>("BUSINESS_TIMEZONE") ?? ZONA_POR_DEFECTO;
  }

  /** Huso del negocio, cacheado; el de por defecto si no se puede resolver. */
  async de(businessId: string): Promise<string> {
    if (!businessId) return this.zonaPorDefecto;

    return this.cache.remember(`zona:negocio:${businessId}`, TTL_SEGUNDOS, () =>
      this.consultar(businessId)
    );
  }

  /** Pide el huso a core. Falla en abierto: sin respuesta, el de por defecto. */
  private async consultar(businessId: string): Promise<string> {
    const perfil = await this.http.pedirONulo<PerfilDelNegocio>(
      "core",
      `/internal/profiles/resolve?businessId=${businessId}`
    );

    const zona = perfil?.business?.timezone;
    if (!zona) {
      this.logger.warn(
        `No se pudo resolver el huso de ${businessId}: se usa ${this.zonaPorDefecto}`
      );
      return this.zonaPorDefecto;
    }

    return zona;
  }
}
