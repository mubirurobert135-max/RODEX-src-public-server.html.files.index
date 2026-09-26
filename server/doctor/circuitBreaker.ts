import { ServiceType, CircuitBreakerState, CircuitBreakerStatus } from './types';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before opening circuit
  cooldownMs?: number; // Time in OPEN state before testing HALF_OPEN
  maxCooldownMs?: number; // Cap for backoff cooldown
}

export class CircuitBreaker {
  private service: ServiceType;
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private failureThreshold: number;
  private cooldownMs: number;
  private maxCooldownMs: number;
  private currentCooldownMs: number;
  private lastStateChange: number = Date.now();
  private nextAttemptAt: number | null = null;

  constructor(service: ServiceType, options?: CircuitBreakerOptions) {
    this.service = service;
    this.failureThreshold = options?.failureThreshold || 3;
    this.cooldownMs = options?.cooldownMs || 15000;
    this.maxCooldownMs = options?.maxCooldownMs || 120000;
    this.currentCooldownMs = this.cooldownMs;
  }

  public canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (this.nextAttemptAt && now >= this.nextAttemptAt) {
        this.transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      // In HALF_OPEN, allow a single probe execution
      return true;
    }

    return false;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.currentCooldownMs = this.cooldownMs;
    if (this.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
    }
  }

  public recordFailure(): void {
    this.failureCount++;
    const now = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Probe failed in HALF_OPEN, double cooldown and reopen
      this.currentCooldownMs = Math.min(this.currentCooldownMs * 2, this.maxCooldownMs);
      this.nextAttemptAt = now + this.currentCooldownMs;
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.nextAttemptAt = now + this.currentCooldownMs;
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      console.log(
        `[RODEX CircuitBreaker] ${this.service} state change: ${this.state} -> ${newState}`
      );
      this.state = newState;
      this.lastStateChange = Date.now();
      if (newState === 'CLOSED') {
        this.nextAttemptAt = null;
      }
    }
  }

  public getStatus(): CircuitBreakerStatus {
    return {
      service: this.service,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.currentCooldownMs,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
      nextAttemptAt: this.nextAttemptAt ? new Date(this.nextAttemptAt).toISOString() : null,
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.currentCooldownMs = this.cooldownMs;
    this.lastStateChange = Date.now();
    this.nextAttemptAt = null;
  }
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers: Map<ServiceType, CircuitBreaker> = new Map();

  private constructor() {
    this.initializeBreakers();
  }

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  private initializeBreakers(): void {
    const services: ServiceType[] = [
      'backend',
      'frontend',
      'ai_provider',
      'memory_system',
      'database',
      'voice_system',
      'tool_suite',
      'youtube_integration',
      'web_navigation',
      'spotify_integration',
    ];

    for (const service of services) {
      const threshold = service === 'ai_provider' ? 3 : service === 'database' ? 4 : 3;
      const cooldown = service === 'ai_provider' ? 20000 : 10000;
      this.breakers.set(service, new CircuitBreaker(service, { failureThreshold: threshold, cooldownMs: cooldown }));
    }
  }

  public getBreaker(service: ServiceType): CircuitBreaker {
    let cb = this.breakers.get(service);
    if (!cb) {
      cb = new CircuitBreaker(service);
      this.breakers.set(service, cb);
    }
    return cb;
  }

  public getAllStatuses(): Record<ServiceType, CircuitBreakerStatus> {
    const result: Partial<Record<ServiceType, CircuitBreakerStatus>> = {};
    this.breakers.forEach((breaker, service) => {
      result[service] = breaker.getStatus();
    });
    return result as Record<ServiceType, CircuitBreakerStatus>;
  }
}

export const globalCircuitBreakerManager = CircuitBreakerManager.getInstance();
