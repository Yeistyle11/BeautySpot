import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class TenantService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get("REDIS_PASSWORD"),
    });
  }

  async resolveFromSubdomain(host: string): Promise<string | null> {
    const domain = this.configService.get("APP_DOMAIN", "beautyspot.co");
    if (!host || !host.includes(domain)) return null;

    const subdomain = host.split(".")[0];
    if (!subdomain || subdomain === "www" || subdomain === "api") return null;

    return this.resolveSlug(subdomain);
  }

  async resolveSlug(slug: string): Promise<string> {
    const cacheKey = `tenant:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const coreUrl = this.configService.get("CORE_SERVICE_URL", "http://localhost:3002");
    const response = await fetch(`${coreUrl}/internal/businesses/resolve?slug=${encodeURIComponent(slug)}`, {
      headers: { "x-internal-secret": this.configService.get("INTERNAL_API_SECRET") || "" },
    });

    if (!response.ok) {
      throw new NotFoundException(`Negocio "${slug}" no encontrado`);
    }

    const body = (await response.json()) as { data: { id: string } };
    const businessId = body.data.id;

    await this.redis.set(cacheKey, businessId, "EX", 300);
    return businessId;
  }

  async clearCache(slug: string): Promise<void> {
    await this.redis.del(`tenant:${slug}`);
  }
}
