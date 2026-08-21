// API pública del módulo compartido de NestJS: guards, decoradores, interceptores,
// filtros, bus de eventos, outbox, caché y utilidades de seguridad reutilizables.
export { JwtAuthGuard } from "./guards/jwt-auth.guard";
export { BusinessScopeGuard } from "./guards/business-scope.guard";
export { RolesGuard } from "./guards/roles.guard";
export { Public, IS_PUBLIC_KEY } from "./decorators/public.decorator";
export {
  SkipBusinessScope,
  SKIP_BUSINESS_SCOPE_KEY,
} from "./decorators/skip-business-scope.decorator";
export { Roles, ROLES_KEY } from "./decorators/roles.decorator";
export { CurrentUser } from "./decorators/current-user.decorator";
export { BusinessId } from "./decorators/business-id.decorator";
export { BranchId, BRANCH_ID_HEADER } from "./decorators/branch-id.decorator";
export { TransformInterceptor } from "./interceptors/transform.interceptor";
export type { ApiResponse } from "./interceptors/transform.interceptor";
export { HttpExceptionFilter } from "./filters/http-exception.filter";
export { InternalSecretGuard } from "./guards/internal-secret.guard";
export { EventBusService } from "./modules/event-bus/event-bus.service";
export { EventBusModule } from "./modules/event-bus/event-bus.module";
export { OutboxService } from "./modules/outbox/outbox.service";
export type { OutboxMessageInput } from "./modules/outbox/outbox.service";
export { OutboxRelayWorker } from "./modules/outbox/outbox-relay.worker";
export { OutboxModule } from "./modules/outbox/outbox.module";
export {
  OutboxMessageEntity,
  OutboxStatus,
} from "./modules/outbox/outbox-message.entity";
export { HealthModule } from "./modules/health/health.module";
export { HealthController } from "./modules/health/health.controller";
export { HealthService } from "./modules/health/health.service";
export type {
  ResultadoSalud,
  EstadoDependencia,
} from "./modules/health/health.service";
export { IdempotencyModule } from "./modules/idempotency/idempotency.module";
export { ProcessedEventsStore } from "./modules/idempotency/processed-events.store";
export type { EventoEntrante } from "./modules/idempotency/processed-events.store";
export { ProcessedEventEntity } from "./modules/idempotency/processed-event.entity";
export {
  requestContextMiddleware,
  requestIdActual,
  conContextoPeticion,
  REQUEST_ID_HEADER,
} from "./observability/request-context";
export type { ContextoPeticion } from "./observability/request-context";
export { StructuredLogger } from "./observability/structured.logger";
export {
  LatenciaInterceptor,
  UMBRAL_LENTO_MS,
} from "./observability/latencia.interceptor";
export {
  SesionVerificable,
  SESION_VERIFICABLE_KEY,
} from "./decorators/sesion-verificable.decorator";
export { RedisCacheService } from "./cache/redis-cache.service";
export { RedisCacheModule } from "./cache/redis-cache.module";
export { InternalHttpClient } from "./http/internal-http.client";
export type {
  ServicioInterno,
  OpcionesLlamada,
} from "./http/internal-http.client";
export { InternalHttpModule } from "./http/internal-http.module";
export {
  EsFechaSola,
  EsDiaDelCalendario,
} from "./decorators/es-fecha-sola.decorator";
export { CatalogoTenantService } from "./database/catalogo-tenant.service";
export type { EntidadDeCatalogo } from "./database/catalogo-tenant.service";
export { TenantCrudService } from "./database/tenant-crud.service";
export type { EntidadDeNegocio } from "./database/tenant-crud.service";
export { ProcessedEventsPurgeWorker } from "./modules/idempotency/processed-events-purge.worker";
export {
  TokenVersionStore,
  TOKEN_VERSION_KEY_PREFIX,
  TOKEN_VERSION_DEFAULT,
} from "./security/token-version.store";
export type { VersionDeToken } from "./security/token-version.store";
export { SecurityModule } from "./security/security.module";
export { TOKEN_VERSION_RESOLVER } from "./security/token-version.resolver";
export type { TokenVersionResolver } from "./security/token-version.resolver";
export {
  createMicroserviceApp,
  bootstrapMicroservice,
} from "./factories/create-app.factory";
export { buildCorsOptions } from "./factories/cors.options";
export { assertJwtSecret } from "./security/assert-jwt-secret";
export { validarEntorno, problemasDelEntorno } from "./config/validar-entorno";
export type { RequisitosDeEntorno, Entorno } from "./config/validar-entorno";
export { withSerializableRetry } from "./database/serializable-retry";
export { esViolacionDeUnicidad } from "./database/violacion-de-unicidad";
export { ZonaDelNegocioService } from "./zona/zona-del-negocio.service";
export { ZonaDelNegocioModule } from "./zona/zona-del-negocio.module";
