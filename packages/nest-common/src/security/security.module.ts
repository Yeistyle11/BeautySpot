import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common/interfaces";
import { RedisCacheModule } from "../cache/redis-cache.module";
import { TokenVersionStore } from "./token-version.store";

/**
 * Expone los servicios de seguridad compartidos. Es global porque
 * TokenVersionStore lo consumen módulos de dominio dispersos (auth, users,
 * memberships).
 */
@Global()
@Module({
  imports: [RedisCacheModule],
  providers: [TokenVersionStore],
  exports: [TokenVersionStore],
})
export class SecurityModule {
  /**
   * Registra el módulo con un TokenVersionResolver que da persistencia a la
   * revocación. Va aquí y no en el AppModule porque Nest resuelve el provider
   * en su módulo, y TokenVersionStore vive dentro de SecurityModule.
   */
  static withResolver(options: {
    imports?: ModuleMetadata["imports"];
    resolver: Provider;
  }): DynamicModule {
    return {
      global: true,
      module: SecurityModule,
      imports: [RedisCacheModule, ...(options.imports ?? [])],
      providers: [options.resolver, TokenVersionStore],
      exports: [TokenVersionStore],
    };
  }
}
