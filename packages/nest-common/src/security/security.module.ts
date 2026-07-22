import { DynamicModule, Global, Module, Provider } from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common/interfaces";
import { RedisCacheModule } from "../cache/redis-cache.module";
import { TokenVersionStore } from "./token-version.store";

/**
 * Expone los servicios de seguridad compartidos al contenedor de inyección.
 *
 * Es global porque TokenVersionStore lo consumen módulos de dominio dispersos
 * (auth, users, memberships) que no deberían tener que importarlo cada uno.
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
   * revocación de sesiones.
   *
   * El resolver debe declararse aquí y no en el AppModule: Nest resuelve las
   * dependencias de un provider en el contexto del módulo que lo declara, y
   * TokenVersionStore vive dentro de SecurityModule.
   *
   * Solo lo usa el servicio dueño de la tabla de usuarios (auth-service); el
   * resto opera con Redis como único respaldo.
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
