import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.url.startsWith("/internal")) return true;

    const secret = request.headers["x-internal-secret"];
    const expected = this.configService.get<string>("INTERNAL_API_SECRET");

    if (!expected || !secret || secret !== expected) {
      throw new ForbiddenException("Acceso denegado al endpoint interno");
    }

    return true;
  }
}
