import { Global, Module } from "@nestjs/common";
import { InternalHttpClient } from "./internal-http.client";

/**
 * Publica el cliente de llamadas entre microservicios.
 *
 * Es global porque lo necesitan servicios de dominio de módulos distintos y no
 * aporta nada obligar a cada uno a importarlo.
 */
@Global()
@Module({
  providers: [InternalHttpClient],
  exports: [InternalHttpClient],
})
export class InternalHttpModule {}
