import { NestFactory, Reflector } from "@nestjs/core";
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  type Type,
} from "@nestjs/common";
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
import { requestContextMiddleware } from "../observability/request-context";
import { StructuredLogger } from "../observability/structured.logger";
import { LatenciaInterceptor } from "../observability/latencia.interceptor";
import {
  validarEntorno,
  type RequisitosDeEntorno,
} from "../config/validar-entorno";

const DEFAULT_PORT = 3000;

/**
 * Lo que todo microservicio necesita para arrancar. Los siete que pasan por esta
 * fábrica tienen base propia, consumen eventos y validan el token de cada
 * petición, así que el conjunto es el mismo para todos.
 *
 * `JWT_SECRET` está aquí aunque solo auth emita tokens: los demás los verifican,
 * y con un secreto distinto rechazarían sesiones legítimas.
 */
const REQUISITOS_COMUNES: RequisitosDeEntorno = {
  secretos: ["JWT_SECRET", "INTERNAL_API_SECRET"],
  urls: ["DATABASE_URL", "RABBITMQ_URL"],
};

/** Nombre del paquete, para que el error diga qué servicio no arranca. */
function nombreDelServicio(): string {
  return process.env.npm_package_name ?? "El servicio";
}

/**
 * Arranca un microservicio con la configuración transversal común: cabeceras de
 * seguridad, CORS, validación estricta de DTOs, la cadena de guards global y el
 * formato uniforme de respuestas y errores.
 *
 * El orden de los guards importa: InternalSecretGuard protege las rutas
 * /internal antes de que JwtAuthGuard las deje pasar sin token; BusinessScopeGuard
 * fija el tenant que RolesGuard asume ya resuelto.
 */
export async function createMicroserviceApp(
  AppModule: unknown,
  requisitos: RequisitosDeEntorno = {}
): Promise<void> {
  const logger = new Logger("Bootstrap");

  // Antes de levantar nada: un servicio mal configurado debe morir aquí y no
  // aceptar tráfico que va a fallar.
  validarEntorno(
    process.env,
    {
      obligatorias: requisitos.obligatorias,
      secretos: [
        ...(REQUISITOS_COMUNES.secretos ?? []),
        ...(requisitos.secretos ?? []),
      ],
      urls: [...(REQUISITOS_COMUNES.urls ?? []), ...(requisitos.urls ?? [])],
    },
    nombreDelServicio()
  );

  const app = await NestFactory.create(AppModule as Type<unknown>, {
    logger: new StructuredLogger(),
  });

  const configService = app.get(ConfigService);

  // Va primero: todo lo que se registre después cita el identificador de la
  // petición que deja aquí.
  app.use(requestContextMiddleware);
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
  // El serializador va después del que envuelve: así recibe la entidad cruda y
  // aplica sus @Exclude() antes de que se meta dentro del sobre ApiResponse.
  app.useGlobalInterceptors(
    new LatenciaInterceptor(),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(reflector)
  );

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
export function bootstrapMicroservice(
  AppModule: unknown,
  requisitos: RequisitosDeEntorno = {}
): void {
  createMicroserviceApp(AppModule, requisitos).catch((error: unknown) => {
    new Logger("Bootstrap").error(
      `No se pudo iniciar el servicio: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error.stack : undefined
    );
    process.exit(1);
  });
}
