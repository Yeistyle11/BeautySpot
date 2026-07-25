import { Module } from "@nestjs/common";
import { RedisCacheModule } from "../../cache/redis-cache.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

/**
 * Endpoint de salud reutilizable por cualquier microservicio: basta con
 * importarlo en el app.module.
 *
 * No declara proveedores para DataSource ni EventBus: los toma del contenedor
 * del servicio que lo importa y comprueba solo los que existan allí (ver
 * {@link HealthService}), porque no todos los servicios tienen las mismas
 * dependencias.
 *
 * Redis es la excepción y sí se importa: todos los servicios lo usan, pero a
 * través del cliente que `createMicroserviceApp` construye a mano fuera del
 * contenedor, así que no habría nada que inyectar y la dependencia se quedaría
 * sin comprobar en casi todos. RedisCacheModule es @Global, de modo que si el
 * servicio ya lo tenía (vía SecurityModule) Nest reutiliza la misma instancia.
 */
@Module({
  imports: [RedisCacheModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
