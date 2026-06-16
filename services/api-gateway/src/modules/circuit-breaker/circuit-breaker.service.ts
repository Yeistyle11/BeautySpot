import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly states: Map<string, CircuitBreakerState> = new Map();

  private readonly THRESHOLD = 5;
  private readonly TIMEOUT = 60000;
  private readonly HALF_OPEN_MAX_CALLS = 3;

  async execute<T>(
    service: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const state = this.getState(service);

    if (state.state === CircuitState.OPEN) {
      if (Date.now() - state.lastFailureTime > this.TIMEOUT) {
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

  private onSuccess(service: string): void {
    const state = this.getState(service);

    if (state.state === CircuitState.HALF_OPEN) {
      state.successCount++;
      if (state.successCount >= this.HALF_OPEN_MAX_CALLS) {
        this.transitionTo(service, CircuitState.CLOSED);
        this.logger.log(`Circuit breaker CLOSED para ${service}`);
      }
    } else {
      state.failures = 0;
    }
  }

  private onFailure(service: string, _error: any): void {
    const state = this.getState(service);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.THRESHOLD) {
      this.transitionTo(service, CircuitState.OPEN);
      this.logger.warn(`Circuit breaker OPENED para ${service}`);
    }
  }

  private transitionTo(service: string, newState: CircuitState): void {
    const state = this.getState(service);
    state.state = newState;
    
    if (newState === CircuitState.CLOSED) {
      state.failures = 0;
      state.successCount = 0;
    }
  }

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

  getStateInfo(service: string): CircuitBreakerState | undefined {
    return this.states.get(service);
  }

  reset(service: string): void {
    this.states.delete(service);
    this.logger.log(`Circuit breaker reset para ${service}`);
  }

  getAllStates(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.states);
  }
}