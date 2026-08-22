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
import {
  TOKEN_VERSION_RESOLVER,
  type TokenVersionResolver,
} from "../security/token-version.resolver";
import { HttpTokenVersionResolver } from "../security/http-token-version.resolver";
import { InternalHttpClient } from "../http/internal-http.client";
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
 * Lo que todo microservicio necesita para arrancar. `JWT_SECRET` esta aqui
 * aunque solo auth emita tokens: los demas los verifican.
 */
const REQUISITOS_COMUNES: RequisitosDeEntorno = {
  secretos: ["JWT_SECRET", "INTERNAL_API_SECRET"],
  urls: ["DATABASE_URL", "RABBITMQ_URL"],
};

/**
 * Resolver autoritativo de versiones de token para el guard global.
 *
 * El guard se construye fuera del contenedor, así que el resolver hay que
 * dárselo a mano: el que el servicio haya registrado —auth resuelve contra su
 * propia tabla de usuarios— y, si no registró ninguno, uno que se lo pregunte a
 * auth por HTTP interno. Sin esto el store nace ciego y una clave ausente en
 * Redis se lee como "nunca revocado".
 */
function resolverDeVersiones(
  app: { get: (token: symbol, opciones: { strict: boolean }) => unknown },
  configService: ConfigService
): TokenVersionResolver {
  try {
    return app.get(TOKEN_VERSION_RESOLVER, {
      strict: false,
    }) as TokenVersionResolver;
  } catch {
    // Esta versión de Nest lanza cuando el token no está registrado, que es el
    // caso de los siete servicios que no poseen la tabla de usuarios.
    return new HttpTokenVersionResolver(new InternalHttpClient(configService));
  }
}

/** Nombre del paquete, para que el error diga qué servicio no arranca. */
function nombreDelServicio(): string {
  return process.env.npm_package_name ?? "El servicio";
}

/**
 * Arranca un microservicio con la configuracion transversal comun: seguridad,
 * CORS, validacion de DTOs, guards globales y el sobre de respuestas.
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
      distintos: [
        ...(REQUISITOS_COMUNES.distintos ?? []),
        ...(requisitos.distintos ?? []),
      ],
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
  const tokenVersionStore = new TokenVersionStore(
    redisCache,
    resolverDeVersiones(app, configService)
  );

  app.useGlobalGuards(
    new InternalSecretGuard(configService, reflector),
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
 * una salida con codigo de error y traza legible.
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
