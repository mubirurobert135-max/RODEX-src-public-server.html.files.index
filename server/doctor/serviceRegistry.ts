import {
  ServiceHealth,
  ServiceType,
  HealthStatus,
  ServicePriority,
  RecoveryLifecycleState,
} from './types';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<ServiceType, ServiceHealth> = new Map();

  private constructor() {
    this.initializeRegistry();
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  private initializeRegistry() {
    const defaultServices: ServiceHealth[] = [
      {
        name: 'Express Backend API Server',
        type: 'backend',
        status: 'HEALTHY',
        priority: 'CRITICAL',
        recoveryState: 'HEALTHY',
        isCritical: true,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 2,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: [],
      },
      {
        name: 'React Frontend SPA',
        type: 'frontend',
        status: 'HEALTHY',
        priority: 'CRITICAL',
        recoveryState: 'HEALTHY',
        isCritical: true,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 5,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend'],
      },
      {
        name: 'Google Gemini Neural Core (@google/genai)',
        type: 'ai_provider',
        status: 'HEALTHY',
        priority: 'CRITICAL',
        recoveryState: 'HEALTHY',
        isCritical: true,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 350,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend'],
      },
      {
        name: 'RODEX Memory & Personalization System',
        type: 'memory_system',
        status: 'HEALTHY',
        priority: 'CRITICAL',
        recoveryState: 'HEALTHY',
        isCritical: true,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 4,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend'],
      },
      {
        name: 'Persistence & Firestore DB Layer',
        type: 'database',
        status: 'HEALTHY',
        priority: 'IMPORTANT',
        recoveryState: 'HEALTHY',
        isCritical: false,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 8,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend'],
      },
      {
        name: 'Voice Subsystem & Web Speech Synthesis',
        type: 'voice_system',
        status: 'HEALTHY',
        priority: 'IMPORTANT',
        recoveryState: 'HEALTHY',
        isCritical: false,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 10,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['frontend'],
      },
      {
        name: 'Orchestrated Tool Suite & Capability Modules',
        type: 'tool_suite',
        status: 'HEALTHY',
        priority: 'IMPORTANT',
        recoveryState: 'HEALTHY',
        isCritical: true,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 12,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend', 'ai_provider'],
      },
      {
        name: 'YouTube Grounding & Media Playback',
        type: 'youtube_integration',
        status: 'HEALTHY',
        priority: 'OPTIONAL',
        recoveryState: 'HEALTHY',
        isCritical: false,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 120,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend', 'tool_suite'],
      },
      {
        name: 'Web Navigation & Browser Opening System',
        type: 'web_navigation',
        status: 'HEALTHY',
        priority: 'OPTIONAL',
        recoveryState: 'HEALTHY',
        isCritical: false,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 15,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['frontend', 'backend'],
      },
      {
        name: 'Spotify PC Control & OAuth Subsystem',
        type: 'spotify_integration',
        status: 'HEALTHY',
        priority: 'OPTIONAL',
        recoveryState: 'HEALTHY',
        isCritical: false,
        lastCheckMs: Date.now(),
        lastSuccessMs: Date.now(),
        responseTimeMs: 45,
        errorCount: 0,
        consecutiveFailures: 0,
        recoveryAttemptCount: 0,
        dependencies: ['backend'],
      },
    ];

    for (const service of defaultServices) {
      this.services.set(service.type, service);
    }
  }

  public getService(type: ServiceType): ServiceHealth | undefined {
    return this.services.get(type);
  }

  public getAllServices(): Record<ServiceType, ServiceHealth> {
    const result: Partial<Record<ServiceType, ServiceHealth>> = {};
    this.services.forEach((service, type) => {
      result[type] = service;
    });
    return result as Record<ServiceType, ServiceHealth>;
  }

  public updateServiceHealth(
    type: ServiceType,
    status: HealthStatus,
    responseTimeMs: number,
    error?: string,
    details?: Record<string, any>
  ): void {
    const existing = this.services.get(type);
    if (!existing) return;

    const now = Date.now();
    const isFailure = status === 'CRITICAL' || status === 'WARNING' || status === 'DEGRADED';

    let recoveryState: RecoveryLifecycleState = existing.recoveryState;
    if (status === 'HEALTHY') {
      recoveryState = 'HEALTHY';
    } else if (status === 'DEGRADED' || status === 'WARNING') {
      recoveryState = 'DEGRADED';
    } else if (status === 'CRITICAL') {
      recoveryState = 'FAILED';
    }

    const updated: ServiceHealth = {
      ...existing,
      status,
      recoveryState,
      lastCheckMs: now,
      responseTimeMs,
      errorCount: isFailure ? existing.errorCount + 1 : existing.errorCount,
      consecutiveFailures: isFailure ? existing.consecutiveFailures + 1 : 0,
      lastSuccessMs: isFailure ? existing.lastSuccessMs : now,
      lastFailureMs: isFailure ? now : existing.lastFailureMs,
      lastError: error || (isFailure ? existing.lastError : undefined),
      details: details || existing.details,
    };

    this.services.set(type, updated);
  }

  public setRecoveryLifecycle(type: ServiceType, state: RecoveryLifecycleState): void {
    const existing = this.services.get(type);
    if (!existing) return;
    this.services.set(type, {
      ...existing,
      recoveryState: state,
    });
  }

  public incrementRecoveryAttempt(type: ServiceType): number {
    const existing = this.services.get(type);
    if (!existing) return 0;
    const newCount = existing.recoveryAttemptCount + 1;
    this.services.set(type, {
      ...existing,
      recoveryAttemptCount: newCount,
    });
    return newCount;
  }

  public resetServiceFailures(type: ServiceType): void {
    const existing = this.services.get(type);
    if (!existing) return;
    this.services.set(type, {
      ...existing,
      status: 'HEALTHY',
      recoveryState: 'HEALTHY',
      consecutiveFailures: 0,
      recoveryAttemptCount: 0,
      lastError: undefined,
      lastSuccessMs: Date.now(),
    });
  }
}

export const globalServiceRegistry = ServiceRegistry.getInstance();
