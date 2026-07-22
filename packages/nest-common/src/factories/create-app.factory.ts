import { NestFactory, Reflector } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { BusinessScopeGuard } from "../guards/business-scope.guard";
import { RolesGuard } from "../guards/roles.guard";
import { HttpExceptionFilter } from "../filters/http-exception.filter";
import { TransformInterceptor } from "../interceptors/transform.interceptor";
import { InternalSecretGuard } from "../guards/internal-secret.guard";
import { RedisCacheService } from "../cache/redis-cache.service";
import { TokenVersionStore } from "../security/token-version.store";
import { buildCorsOptions } from "./cors.options";

const DEFAULT_PORT = 3000;

/**
 * Arranca un microservicio con la configuración transversal común: cabeceras de
 * seguridad, CORS, validación estricta de DTOs, la cadena de guards global y el
 * formato uniforme de respuestas y errores.
 *
 * El orden de los guards importa: InternalSecretGuard protege las rutas
 * /internal antes de que JwtAuthGuard las deje pasar sin token; BusinessScopeGuard
 * fija el tenant que RolesGuard asume ya resuelto.
 */
export async function createMicroserviceApp(AppModule: unknown): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule as any);

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors(buildCorsOptions(configService));

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

  // Permite que Nest cierre conexiones a BD, Redis y RabbitMQ al recibir
  // SIGTERM, en lugar de que el orquestador mate el proceso en caliente.
  app.enableShutdownHooks();

  await app.init();

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  logger.log(`Servicio corriendo en puerto ${port}`);
}

/**
 * Envoltorio de arranque para los main.ts: convierte un fallo de bootstrap en
 * una salida con código de error y traza legible, en vez de dejar una promesa
 * rechazada sin gestionar que el orquestador no sabe interpretar.
 */
export function bootstrapMicroservice(AppModule: unknown): void {
  createMicroserviceApp(AppModule).catch((error: unknown) => {
    new Logger("Bootstrap").error(
      `No se pudo iniciar el servicio: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error.stack : undefined
    );
    process.exit(1);
  });
}
