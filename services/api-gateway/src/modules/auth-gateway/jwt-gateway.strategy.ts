import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { assertJwtSecret } from "@beautyspot/nest-common";

@Injectable()
export class JwtGatewayStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // passport-jwt v11 exige un secreto definido (string|Buffer, no undefined)
      secretOrKey: assertJwtSecret(
        configService.get<string>("JWT_SECRET"),
        "JWT_SECRET"
      ),
    });
  }

  validate(payload: { sub: string; email: string; role: string; businessId?: string; businessIds?: string[] }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      businessId: payload.businessId,
      businessIds: payload.businessIds,
    };
  }
}
