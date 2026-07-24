import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** CLOSED: tráfico normal. OPEN: se rechaza sin llamar. HALF_OPEN: pruebas de recuperación. */
export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/** Estado que se lleva por servicio para decidir cuándo abrir o cerrar el circuito. */
interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

/**
 * Circuit breaker por servicio: tras varios fallos seguidos deja de reenviar
 * peticiones a un backend caído y las reintenta pasado un tiempo de espera.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly states: Map<string, CircuitBreakerState> = new Map();

  private readonly threshold: number;
  private readonly timeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(configService: ConfigService) {
    this.threshold = configService.get<number>("CIRCUIT_BREAKER_THRESHOLD", 5);
    this.timeoutMs = configService.get<number>(
      "CIRCUIT_BREAKER_TIMEOUT_MS",
      60000
    );
    this.halfOpenMaxCalls = configService.get<number>(
      "CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS",
      3
    );
  }

  /**
   * Ejecuta `fn` bajo el breaker del servicio: la rechaza de inmediato si el
   * circuito está OPEN y, pasado el timeout, pasa a HALF_OPEN para tantear.
   */
  async execute<T>(service: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getState(service);

    if (state.state === CircuitState.OPEN) {
      if (Date.now() - state.lastFailureTime > this.timeoutMs) {
        this.transitionTo(service, CircuitState.HALF_OPEN);
        this.logger.log(`Circuit breaker HALF_OPEN para ${service}`);
      } else {
        this.logger.warn(`Circuit breaker OPEN para ${service}`);
        throw new Error(`Circuit breaker OPEN for ${service}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(service);
      return result;
    } catch (error) {
      this.onFailure(service, error);
      throw error;
    }
  }

  /** Registra un éxito: cierra el circuito tras suficientes pruebas en HALF_OPEN. */
  private onSuccess(service: string): void {
    const state = this.getState(service);

    if (state.state === CircuitState.HALF_OPEN) {
      state.successCount++;
      if (state.successCount >= this.halfOpenMaxCalls) {
        this.transitionTo(service, CircuitState.CLOSED);
        this.logger.log(`Circuit breaker CLOSED para ${service}`);
      }
    } else {
      state.failures = 0;
    }
  }

  /** Registra un fallo y abre el circuito al alcanzar el umbral configurado. */
  private onFailure(service: string, error: unknown): void {
    const state = this.getState(service);
    state.failures++;
    state.lastFailureTime = Date.now();

    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    this.logger.warn(
      `Fallo registrado para ${service}: ${errorMessage} (total: ${state.failures})`
    );

    if (state.failures >= this.threshold) {
      this.transitionTo(service, CircuitState.OPEN);
      this.logger.warn(`Circuit breaker OPENED para ${service}`);
    }
  }

  /** Cambia el estado del circuito y limpia los contadores al volver a CLOSED. */
  private transitionTo(service: string, newState: CircuitState): void {
    const state = this.getState(service);
    state.state = newState;

    if (newState === CircuitState.CLOSED) {
      state.failures = 0;
      state.successCount = 0;
    }
  }

  /** Devuelve el estado del servicio, inicializándolo en CLOSED la primera vez. */
  private getState(service: string): CircuitBreakerState {
    if (!this.states.has(service)) {
      this.states.set(service, {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        successCount: 0,
      });
    }
    return this.states.get(service)!;
  }

  /** Estado actual de un servicio, o undefined si aún no ha tenido tráfico. */
  getStateInfo(service: string): CircuitBreakerState | undefined {
    return this.states.get(service);
  }

  /** Borra el estado de un servicio para forzar el cierre del circuito. */
  reset(service: string): void {
    this.states.delete(service);
    this.logger.log(`Circuit breaker reset para ${service}`);
  }

  /** Estado de todos los servicios rastreados; usado para observabilidad. */
  getAllStates(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.states);
  }
}
