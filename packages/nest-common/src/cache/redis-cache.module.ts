import { Global, Module } from "@nestjs/common";
import { RedisCacheService } from "./redis-cache.service";

/** Módulo global que expone {@link RedisCacheService} a toda la aplicación. */
@Global()
@Module({
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
