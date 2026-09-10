import { Global, Module } from "@nestjs/common";
import { InternalHttpClient } from "./internal-http.client";

/**
 * Publica el cliente de llamadas entre microservicios. Es global porque lo
 * necesitan servicios de dominio de módulos distintos.
 */
@Global()
@Module({
  providers: [InternalHttpClient],
  exports: [InternalHttpClient],
})
export class InternalHttpModule {}
