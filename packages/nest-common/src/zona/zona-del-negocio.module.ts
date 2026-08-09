import { Module } from "@nestjs/common";
import { InternalHttpModule } from "../http/internal-http.module";
import { ZonaDelNegocioService } from "./zona-del-negocio.service";

@Module({
  // RedisCacheModule es @Global, así que aquí solo hace falta el cliente HTTP.
  imports: [InternalHttpModule],
  providers: [ZonaDelNegocioService],
  exports: [ZonaDelNegocioService],
})
/** Cablea el resolutor del huso horario de cada negocio. */
export class ZonaDelNegocioModule {}
