import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";

export const INTERNAL_API_SECRET_HEADER = "x-internal-secret";
const INTERNAL_PATH_PREFIX = "/internal";

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.url.startsWith(INTERNAL_PATH_PREFIX)) return true;

    const secret = request.headers[INTERNAL_API_SECRET_HEADER];
    const expected = this.configService.get<string>("INTERNAL_API_SECRET");

    if (!this.isValidSecret(secret, expected)) {
      throw new ForbiddenException("Acceso denegado al endpoint interno");
    }

    return true;
  }

  private isValidSecret(
    secret: unknown,
    expected: string | undefined
  ): boolean {
    if (!expected || typeof secret !== "string" || secret.length === 0) {
      return false;
    }
    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expected);
    if (secretBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(secretBuffer, expectedBuffer);
  }
}
