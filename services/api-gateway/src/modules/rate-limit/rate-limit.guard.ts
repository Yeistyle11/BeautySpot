import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RATE_LIMIT_AUTH_REQUESTS, RATE_LIMIT_GENERAL_REQUESTS, RATE_LIMIT_WINDOW_SECONDS } from "@beautyspot/shared-constants";
import Redis from "ioredis";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
      password: configService.get("REDIS_PASSWORD"),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || "unknown";
    const path = request.path;

    const isAuthRoute = path.includes("/auth/login") || path.includes("/auth/register");
    const limit = isAuthRoute ? RATE_LIMIT_AUTH_REQUESTS : RATE_LIMIT_GENERAL_REQUESTS;
    const windowSeconds = RATE_LIMIT_WINDOW_SECONDS;

    const key = `rate-limit:${ip}:${isAuthRoute ? "auth" : "general"}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      throw new HttpException(
        {
          success: false,
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Demasiadas solicitudes" },
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
