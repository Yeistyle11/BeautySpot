import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { BusinessScopeGuard } from "../guards/business-scope.guard";
import { RolesGuard } from "../guards/roles.guard";
import { HttpExceptionFilter } from "../filters/http-exception.filter";
import { TransformInterceptor } from "../interceptors/transform.interceptor";
import { InternalSecretGuard } from "../guards/internal-secret.guard";
import { RedisCacheService } from "../cache/redis-cache.service";
import { TokenVersionStore } from "../security/token-version.store";

export async function createMicroserviceApp(AppModule: unknown): Promise<void> {
  const app = await NestFactory.create(AppModule as any);

  const configService = app.get(ConfigService);

  const allowedOrigins =
    configService.get("CORS_ORIGINS")?.split(",").filter(Boolean) || [];
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin?.startsWith("http://localhost")
      ) {
        callback(null, true);
      } else if (configService.get("NODE_ENV") !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const reflector = app.get(Reflector);

  const redisCache = new RedisCacheService(configService);
  const tokenVersionStore = new TokenVersionStore(redisCache);

  app.useGlobalGuards(
    new InternalSecretGuard(configService),
    new JwtAuthGuard(configService, reflector, tokenVersionStore),
    new BusinessScopeGuard(reflector),
    new RolesGuard(reflector)
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();

  const port = process.env.PORT || 3000;
  await app.listen(Number(port));
  console.log(`Servicio corriendo en puerto ${port}`);
}
