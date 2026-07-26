import { Global, Module } from "@nestjs/common";
import { CsrfOriginGuard } from "./csrf-origin.guard";
import { SessionService } from "./session.service";

/**
 * Traduce entre los tokens de auth-service y las cookies del navegador.
 *
 * Es global porque tanto el proxy (que intercepta las respuestas de login) como
 * el arranque (que registra el guard CSRF) necesitan estas piezas.
 */
@Global()
@Module({
  providers: [SessionService, CsrfOriginGuard],
  exports: [SessionService, CsrfOriginGuard],
})
export class SessionModule {}
