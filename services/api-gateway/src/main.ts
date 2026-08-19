import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import {
  HttpExceptionFilter,
  TransformInterceptor,
  buildCorsOptions,
  requestContextMiddleware,
  StructuredLogger,
  validarEntorno,
  type RequisitosDeEntorno,
} from "@beautyspot/nest-common";
import { AuthGatewayGuard } from "./modules/auth-gateway/auth-gateway.guard";
import { RateLimitGuard } from "./modules/rate-limit/rate-limit.guard";
import { CsrfOriginGuard } from "./modules/session/csrf-origin.guard";
import helmet from "helmet";

/**
 * Lo que el gateway necesita para arrancar: las URLs de los servicios y los
 * dos secretos que comparte con el resto.
 */
const REQUISITOS: RequisitosDeEntorno = {
  secretos: ["JWT_SECRET", "INTERNAL_API_SECRET"],
  urls: [
    "AUTH_SERVICE_URL",
    "CORE_SERVICE_URL",
    "BOOKING_SERVICE_URL",
    "PAYMENT_SERVICE_URL",
    "NOTIFICATION_SERVICE_URL",
    "MARKETPLACE_SERVICE_URL",
    "ANALYTICS_SERVICE_URL",
  ],
};

/** Arranca el API Gateway: seguridad, CORS, validación, guards globales y escucha. */
async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // Antes de levantar nada: la puerta de entrada mal configurada es la que
  // rompe el sistema entero, no solo un servicio.
  validarEntorno(process.env, REQUISITOS, "El API Gateway");
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });

  // El gateway es la puerta de entrada: aquí nace el identificador que después
  // acompaña a la petición por todos los servicios.
  app.use(requestContextMiddleware);
  app.use(helmet());

  const configService = app.get(ConfigService);

  // TRUST_PROXY dice en cuantos saltos confiar; sin el, req.ip es la del
  // balanceador y el rate limit por IP agrupa a todo el mundo.
  const trustProxy = configService.get<string>("TRUST_PROXY");
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set("trust proxy", Number(trustProxy));
  }

  app.enableCors(buildCorsOptions(configService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Orden de la cadena: primero el rate limit, despues la comprobacion de
  // origen y solo entonces la validacion del token.
  app.useGlobalGuards(
    app.get(RateLimitGuard),
    app.get(CsrfOriginGuard),
    app.get(AuthGatewayGuard)
  );

  app.enableShutdownHooks();

  const port = configService.get<number>("PORT", 3000);
  await app.listen(port);
  logger.log(`API Gateway corriendo en puerto ${port}`);
}

bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error(
    `No se pudo iniciar el API Gateway: ${
      error instanceof Error ? error.message : String(error)
    }`,
    error instanceof Error ? error.stack : undefined
  );
  process.exit(1);
});
