import { Global, Module } from "@nestjs/common";
import { CsrfOriginGuard } from "./csrf-origin.guard";
import { SessionService } from "./session.service";

/** Traduce entre los tokens de auth-service y las cookies del navegador. */
@Global()
@Module({
  providers: [SessionService, CsrfOriginGuard],
  exports: [SessionService, CsrfOriginGuard],
})
export class SessionModule {}
