import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import {
  HttpExceptionFilter,
  TransformInterceptor,
  buildCorsOptions,
} from "@beautyspot/nest-common";
import { AuthGatewayGuard } from "./modules/auth-gateway/auth-gateway.guard";
import { RateLimitGuard } from "./modules/rate-limit/rate-limit.guard";
import helmet from "helmet";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const configService = app.get(ConfigService);

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
  app.useGlobalGuards(app.get(RateLimitGuard), app.get(AuthGatewayGuard));

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
