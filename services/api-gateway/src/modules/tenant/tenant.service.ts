import {
  Injectable,
  Inject,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module";
import { ServiceUrlsConfig } from "../../config/service-urls";

const TENANT_CACHE_TTL_SECONDS = 300;
const TENANT_FETCH_TIMEOUT_MS = 5000;

/**
 * Resuelve el tenant (businessId) a partir del subdominio o slug del negocio,
 * cacheando el resultado en Redis para no consultar al core en cada petición.
 */
@Injectable()
export class TenantService {
  constructor(
    private configService: ConfigService,
    private serviceUrls: ServiceUrlsConfig,
    @Inject(REDIS_CLIENT) private redis: Redis
  ) {}

  /** Extrae el slug del host ({slug}.beautyspot.co) y lo resuelve; null si no aplica. */
  async resolveFromSubdomain(host: string): Promise<string | null> {
    const domain = this.configService.get<string>(
      "APP_DOMAIN",
      "beautyspot.co"
    );
    if (!host || !host.includes(domain)) return null;

    const subdomain = host.split(".")[0];
    if (!subdomain || subdomain === "www" || subdomain === "api") return null;

    return this.resolveSlug(subdomain);
  }

  /**
   * Traduce un slug a su businessId consultando al core service (endpoint
   * interno) y guardando el resultado en caché. Lanza 404/502/503 según el fallo.
   */
  async resolveSlug(slug: string): Promise<string> {
    const cacheKey = `tenant:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const coreUrl = this.serviceUrls.getUrl("core");
    const url = `${coreUrl}/internal/businesses/resolve?slug=${encodeURIComponent(slug)}`;
    const internalSecret =
      this.configService.get<string>("INTERNAL_API_SECRET") || "";

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-internal-secret": internalSecret },
        signal: AbortSignal.timeout(TENANT_FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ServiceUnavailableException(
          `Core service no responde (timeout ${TENANT_FETCH_TIMEOUT_MS}ms)`
        );
      }
      throw new ServiceUnavailableException(
        `No se pudo conectar con core service: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Negocio "${slug}" no encontrado`);
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Core service respondió ${response.status} al resolver slug "${slug}"`
      );
    }

    const body = (await response.json()) as { data: { id: string } };
    const businessId = body.data.id;

    await this.redis.set(cacheKey, businessId, "EX", TENANT_CACHE_TTL_SECONDS);
    return businessId;
  }

  /** Invalida el tenant cacheado de un slug (p. ej. al cambiar de dueño o slug). */
  async clearCache(slug: string): Promise<void> {
    await this.redis.del(`tenant:${slug}`);
  }
}
