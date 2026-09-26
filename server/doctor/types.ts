// RODEX Doctor & Resilience System — Type Definitions

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export type ServiceType =
  | 'backend'
  | 'frontend'
  | 'ai_provider'
  | 'memory_system'
  | 'database'
  | 'voice_system'
  | 'tool_suite'
  | 'youtube_integration'
  | 'web_navigation'
  | 'spotify_integration';

export type ServicePriority = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export type RecoveryLifecycleState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'FAILED'
  | 'RECOVERING'
  | 'VERIFYING'
  | 'MANUAL_ATTENTION_REQUIRED';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  service: ServiceType;
  state: CircuitBreakerState;
  failureCount: number;
  failureThreshold: number;
  cooldownMs: number;
  lastStateChange: string;
  nextAttemptAt: string | null;
}

export interface ServiceHealth {
  name: string;
  type: ServiceType;
  status: HealthStatus;
  priority: ServicePriority;
  recoveryState: RecoveryLifecycleState;
  isCritical: boolean;
  lastCheckMs: number;
  lastSuccessMs?: number;
  lastFailureMs?: number;
  responseTimeMs: number;
  errorCount: number;
  consecutiveFailures: number;
  recoveryAttemptCount: number;
  lastError?: string;
  dependencies: ServiceType[];
  details?: Record<string, any>;
}

export interface EnvironmentVariableStatus {
  name: string;
  isRequired: boolean;
  status: 'PRESENT' | 'MISSING' | 'INVALID' | 'NOT_REQUIRED';
  description: string;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  service: ServiceType;
  severity: HealthStatus;
  errorType: string;
  message: string;
  rootCause: string;
  recommendedAction: string;
  repairStatus?: 'NONE' | 'ATTEMPTED' | 'REPAIRED' | 'FAILED';
  repairedAt?: string;
}

export interface SystemResourceMetrics {
  uptimeSeconds: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  activeRequests: number;
  totalRequestsRecorded: number;
  avgLatencyMs: number;
  errorRate: string;
  cacheHitRate: string;
}

export interface DoctorDiagnosticReport {
  overallHealth: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  summaryMessage: string;
  services: Record<ServiceType, ServiceHealth>;
  circuitBreakers: Record<ServiceType, CircuitBreakerStatus>;
  environmentChecks: EnvironmentVariableStatus[];
  resources: SystemResourceMetrics;
  incidentHistory: IncidentRecord[];
  rootCauses: {
    title: string;
    description: string;
    affectedServices: ServiceType[];
    severity: HealthStatus;
    actionableFix: string;
  }[];
}

export interface AutoRepairResult {
  success: boolean;
  service: ServiceType;
  actionTaken: string;
  beforeStatus: HealthStatus;
  afterStatus: HealthStatus;
  verified: boolean;
  message: string;
  timestamp: string;
}
