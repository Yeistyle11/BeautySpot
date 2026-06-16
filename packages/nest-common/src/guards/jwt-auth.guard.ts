import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    if (request.url === "/health" || request.url.startsWith("/internal")) return true;

    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      throw new UnauthorizedException("Token no proporcionado");
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET no está configurado");
    }

    try {
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
      request.user = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        businessId: decoded.businessId,
        businessIds: decoded.businessIds,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }
}
