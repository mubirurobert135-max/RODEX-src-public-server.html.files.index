import {
  ServiceType,
  ServicePriority,
  RecoveryLifecycleState,
  AutoRepairResult,
  HealthStatus,
} from './types';
import { globalServiceRegistry } from './serviceRegistry';
import { globalCircuitBreakerManager } from './circuitBreaker';
import { globalErrorAnalyzer } from './errorAnalyzer';
import { globalAutoRepairEngine } from './autoRepairEngine';

export interface RecoveryAttemptDetails {
  service: ServiceType;
  priority: ServicePriority;
  attemptNumber: number;
  delayMs: number;
  strategy: string;
  result: AutoRepairResult;
}

export class RecoveryManager {
  private static instance: RecoveryManager;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private isRecoveringMap: Map<ServiceType, boolean> = new Map();

  private constructor() {}

  public static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  /**
   * Calculates Exponential Backoff with Jitter
   * delay = min(maxDelayMs, baseDelayMs * 2^(attempt) + randomJitter)
   */
  public calculateBackoff(attempt: number, baseMs = 500, maxMs = 10000): number {
    const exponential = baseMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 200;
    return Math.min(maxMs, Math.round(exponential + jitter));
  }

  /**
   * Triggers targeted self-recovery for a failing service.
   * Pipeline: DETECT -> CLASSIFY -> ISOLATE -> RECOVER SAFELY -> VERIFY -> ALERT -> OPERATE
   */
  public async attemptRecovery(serviceType: ServiceType): Promise<RecoveryAttemptDetails | null> {
    const service = globalServiceRegistry.getService(serviceType);
    if (!service) return null;

    // Prevent concurrent duplicate recovery loops for same service
    if (this.isRecoveringMap.get(serviceType)) {
      return null;
    }

    const breaker = globalCircuitBreakerManager.getBreaker(serviceType);

    // Check circuit breaker status
    if (!breaker.canExecute()) {
      console.log(
        `[RODEX RecoveryManager] Circuit breaker OPEN for ${serviceType}. Recovery request isolated.`
      );
      globalServiceRegistry.setRecoveryLifecycle(serviceType, 'DEGRADED');
      return null;
    }

    this.isRecoveringMap.set(serviceType, true);

    const attemptNumber = globalServiceRegistry.incrementRecoveryAttempt(serviceType);

    // Enforce Max Attempt Threshold
    if (attemptNumber > this.MAX_RECOVERY_ATTEMPTS) {
      console.warn(
        `[RODEX RecoveryManager] ${serviceType} reached max recovery attempts (${this.MAX_RECOVERY_ATTEMPTS}). Flagging MANUAL_ATTENTION_REQUIRED.`
      );
      globalServiceRegistry.setRecoveryLifecycle(serviceType, 'MANUAL_ATTENTION_REQUIRED');
      breaker.recordFailure();
      this.isRecoveringMap.set(serviceType, false);

      globalErrorAnalyzer.recordIncident({
        service: serviceType,
        severity: 'CRITICAL',
        errorType: 'MAX_RECOVERY_EXCEEDED',
        message: `${service.name} failed ${this.MAX_RECOVERY_ATTEMPTS} consecutive auto-recovery cycles.`,
        rootCause: service.lastError || 'Persistent service fault',
        recommendedAction: 'Check environment secrets, network access, or provider quota status.',
        repairStatus: 'FAILED',
      });

      return null;
    }

    // Step 1: Set state RECOVERING
    globalServiceRegistry.setRecoveryLifecycle(serviceType, 'RECOVERING');

    const backoffMs = this.calculateBackoff(attemptNumber);
    console.log(
      `[RODEX RecoveryManager] Executing recovery attempt ${attemptNumber}/${this.MAX_RECOVERY_ATTEMPTS} for ${serviceType} (Backoff: ${backoffMs}ms)...`
    );

    // Wait backoff interval
    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    // Step 2: Step into VERIFYING
    globalServiceRegistry.setRecoveryLifecycle(serviceType, 'VERIFYING');

    // Step 3: Execute safe auto-repair
    let strategyName = 'Safe Client & Pipeline Re-initialization';
    if (serviceType === 'ai_provider') strategyName = 'Gemini Client Re-evaluation & Quota Cooldown Reset';
    if (serviceType === 'memory_system') strategyName = 'Memory Service Storage Key Verification';
    if (serviceType === 'database') strategyName = 'Firestore Probe & Read Verification';

    const repairResults = await globalAutoRepairEngine.executeRepair(serviceType);
    const result = repairResults[0] || {
      success: false,
      service: serviceType,
      actionTaken: 'No repair executed',
      beforeStatus: service.status,
      afterStatus: 'CRITICAL',
      verified: false,
      message: 'Repair returned empty payload',
      timestamp: new Date().toISOString(),
    };

    if (result.verified && result.success) {
      // Step 4: RECOVERED -> HEALTHY
      globalServiceRegistry.resetServiceFailures(serviceType);
      breaker.recordSuccess();
      console.log(`[RODEX RecoveryManager] ✅ ${serviceType} successfully recovered and verified!`);
    } else {
      // Step 5: FAILED -> OPEN BREAKER
      globalServiceRegistry.setRecoveryLifecycle(serviceType, 'FAILED');
      breaker.recordFailure();
      console.warn(`[RODEX RecoveryManager] ❌ ${serviceType} recovery attempt ${attemptNumber} failed.`);
    }

    this.isRecoveringMap.set(serviceType, false);

    return {
      service: serviceType,
      priority: service.priority,
      attemptNumber,
      delayMs: backoffMs,
      strategy: strategyName,
      result,
    };
  }

  /**
   * Scans all monitored services and triggers targeted recovery for degraded or failing components.
   */
  public async autoRecoverDegradedServices(): Promise<RecoveryAttemptDetails[]> {
    const services = globalServiceRegistry.getAllServices();
    const attempts: RecoveryAttemptDetails[] = [];

    for (const [serviceTypeKey, srv] of Object.entries(services)) {
      const serviceType = serviceTypeKey as ServiceType;

      if (
        srv.status === 'CRITICAL' ||
        srv.status === 'DEGRADED' ||
        srv.recoveryState === 'FAILED'
      ) {
        // Isolate optional services so they don't crash core
        if (srv.priority === 'OPTIONAL') {
          console.log(
            `[RODEX Resilience] Optional service ${srv.name} is impaired. Isolate and provide fallback.`
          );
        }

        const details = await this.attemptRecovery(serviceType);
        if (details) {
          attempts.push(details);
        }
      }
    }

    return attempts;
  }
}

export const globalRecoveryManager = RecoveryManager.getInstance();
