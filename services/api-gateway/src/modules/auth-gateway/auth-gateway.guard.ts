import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";

/** Rutas accesibles sin token: login, registro y recuperación de contraseña. */
const PUBLIC_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/refresh",
  "/api/v1/auth-service/login",
  "/api/v1/auth-service/register",
  "/api/v1/auth-service/forgot-password",
  "/api/v1/auth-service/reset-password",
  "/api/v1/auth-service/refresh",
  "/health",
];

/** Prefijos del marketplace público accesibles sin token, solo por GET. */
const PUBLIC_MARKETPLACE_PREFIXES = [
  "/api/v1/marketplace/profiles/",
  "/api/v1/marketplace/search",
  "/api/v1/marketplace/feed",
  "/api/v1/marketplace/reviews/business/",
  "/api/v1/marketplace/reviews/",
  "/api/v1/marketplace-service/profiles/",
  "/api/v1/marketplace-service/search",
  "/api/v1/marketplace-service/feed",
  "/api/v1/marketplace-service/reviews/business/",
  "/api/v1/marketplace-service/reviews/",
];

/**
 * Guard JWT global del gateway: deja pasar las rutas públicas y el marketplace
 * de solo lectura, y exige token válido para todo lo demás.
 */
@Injectable()
export class AuthGatewayGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

    const isPublicMarketplace =
      PUBLIC_MARKETPLACE_PREFIXES.some((p) => path.startsWith(p)) &&
      request.method === "GET";

    if (isPublic || isPublicMarketplace) {
      return true;
    }

    return super.canActivate(context);
  }
}
