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
export { RedisCacheService } from "./cache/redis-cache.service";
export { RedisCacheModule } from "./cache/redis-cache.module";
export {
  TokenVersionStore,
  TOKEN_VERSION_KEY_PREFIX,
  TOKEN_VERSION_DEFAULT,
} from "./security/token-version.store";
export { SecurityModule } from "./security/security.module";
export { TOKEN_VERSION_RESOLVER } from "./security/token-version.resolver";
export type { TokenVersionResolver } from "./security/token-version.resolver";
export {
  createMicroserviceApp,
  bootstrapMicroservice,
} from "./factories/create-app.factory";
export { buildCorsOptions } from "./factories/cors.options";
export { assertJwtSecret } from "./security/assert-jwt-secret";
export { withSerializableRetry } from "./database/serializable-retry";
