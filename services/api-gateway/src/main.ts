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
 * Lo que el gateway necesita para arrancar. No tiene base de datos propia, pero
 * sin las URLs de los servicios no puede enrutar nada, y los dos secretos han de
 * coincidir con los del resto: con otros distintos rechazaría sesiones legítimas
 * y no podría hablar con nadie.
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

  // Detrás de un balanceador, req.ip es la IP del proxy salvo que se declare en
  // cuántos saltos confiar. Sin esto el rate limit por IP agrupa a todos los
  // clientes en una sola cuota. TRUST_PROXY = número de proxies intermedios.
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

  // El rate limit va primero para que el abuso se corte antes de gastar
  // verificaciones de firma JWT en cada petición.
  // El orden importa: primero se limita el ritmo, después se comprueba el
  // origen —barato y sin tocar la sesión— y sólo entonces se valida el token.
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
