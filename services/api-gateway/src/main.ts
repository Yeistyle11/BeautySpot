import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { HttpExceptionFilter, TransformInterceptor } from "@beautyspot/nest-common";
import { AuthGatewayGuard } from "./modules/auth-gateway/auth-gateway.guard";
import { RateLimitGuard } from "./modules/rate-limit/rate-limit.guard";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const configService = app.get(ConfigService);

  const allowedOrigins = configService.get("CORS_ORIGINS")?.split(",").filter(Boolean) || [];
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || origin?.startsWith("http://localhost")) {
        callback(null, true);
      } else if (configService.get("NODE_ENV") !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const authGatewayGuard = app.get(AuthGatewayGuard);
  const rateLimitGuard = app.get(RateLimitGuard);
  app.useGlobalGuards(authGatewayGuard, rateLimitGuard);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API Gateway running on port ${port}`);
}
bootstrap();
