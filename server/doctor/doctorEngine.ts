import {
  DoctorDiagnosticReport,
  HealthStatus,
  EnvironmentVariableStatus,
  SystemResourceMetrics,
  ServiceType,
} from './types';
import { globalServiceRegistry } from './serviceRegistry';
import { globalErrorAnalyzer } from './errorAnalyzer';
import { globalAutoRepairEngine } from './autoRepairEngine';
import { globalCircuitBreakerManager } from './circuitBreaker';
import { globalRecoveryManager } from './recoveryManager';
import { globalPerformanceTracker } from '../services/performanceTracker';
import { isGeminiApiKeyConfigured } from '../geminiConfig';
import { globalMemoryService } from '../orchestrator/memoryService';

export class RodexDoctorEngine {
  private static instance: RodexDoctorEngine;
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): RodexDoctorEngine {
    if (!RodexDoctorEngine.instance) {
      RodexDoctorEngine.instance = new RodexDoctorEngine();
    }
    return RodexDoctorEngine.instance;
  }

  /**
   * Safe Environment Variable Audit without revealing secret strings
   */
  public getEnvironmentChecks(): EnvironmentVariableStatus[] {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const spotifyId = process.env.SPOTIFY_CLIENT_ID;
    const spotifySecret = process.env.SPOTIFY_CLIENT_SECRET;
    const port = process.env.PORT;
    const nodeEnv = process.env.NODE_ENV;

    return [
      {
        name: 'GEMINI_API_KEY / GOOGLE_API_KEY',
        isRequired: false,
        status: geminiKey && geminiKey.length > 5 ? 'PRESENT' : 'MISSING',
        description: 'Google Gemini Neural Core API Key for web grounding and live intelligence.',
      },
      {
        name: 'PORT',
        isRequired: false,
        status: port ? 'PRESENT' : 'NOT_REQUIRED',
        description: 'HTTP server binding port (defaults to 3000 if omitted).',
      },
      {
        name: 'NODE_ENV',
        isRequired: false,
        status: nodeEnv ? 'PRESENT' : 'NOT_REQUIRED',
        description: 'Process environment state (development / production).',
      },
      {
        name: 'SPOTIFY_CLIENT_ID',
        isRequired: false,
        status: spotifyId ? 'PRESENT' : 'NOT_REQUIRED',
        description: 'Optional Spotify Developer Application Client ID for PC music control.',
      },
      {
        name: 'SPOTIFY_CLIENT_SECRET',
        isRequired: false,
        status: spotifySecret ? 'PRESENT' : 'NOT_REQUIRED',
        description: 'Optional Spotify Client Secret for OAuth token refreshes.',
      },
    ];
  }

  /**
   * System Runtime Resource & Performance Metrics
   */
  public getResourceMetrics(): SystemResourceMetrics {
    const memoryUsage = process.memoryUsage();
    const perfSummary = globalPerformanceTracker.getMetricsSummary();

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      externalMB: Math.round(memoryUsage.external / 1024 / 1024),
      activeRequests: perfSummary.activeRequests,
      totalRequestsRecorded: perfSummary.totalRequestsRecorded,
      avgLatencyMs: perfSummary.avgLatencyMs,
      errorRate: perfSummary.errorRate,
      cacheHitRate: perfSummary.cacheHitRate,
    };
  }

  /**
   * Executes active light-weight diagnostic checks across all core services
   */
  public async runActiveHealthCheck(): Promise<void> {
    const startMs = Date.now();

    // 1. Backend check
    globalServiceRegistry.updateServiceHealth('backend', 'HEALTHY', Date.now() - startMs);

    // 2. AI Provider check
    const aiStart = Date.now();
    const hasGeminiKey = isGeminiApiKeyConfigured();
    globalServiceRegistry.updateServiceHealth(
      'ai_provider',
      hasGeminiKey ? 'HEALTHY' : 'WARNING',
      Date.now() - aiStart,
      hasGeminiKey ? undefined : 'GEMINI_API_KEY missing (running in local fallback mode)'
    );

    // 3. Memory system check
    const memStart = Date.now();
    try {
      await globalMemoryService.search('system_health', { limit: 1 });
      globalServiceRegistry.updateServiceHealth('memory_system', 'HEALTHY', Date.now() - memStart);
    } catch (err: any) {
      globalServiceRegistry.updateServiceHealth('memory_system', 'WARNING', Date.now() - memStart, err?.message);
    }

    // 4. Spotify check
    const spotifyConfigured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    globalServiceRegistry.updateServiceHealth(
      'spotify_integration',
      spotifyConfigured ? 'HEALTHY' : 'DEGRADED',
      5,
      spotifyConfigured ? undefined : 'Spotify API credentials not configured in environment'
    );
  }

  /**
   * Generates a complete, structured diagnostic report for development/admin use
   */
  public async generateDiagnosticReport(): Promise<DoctorDiagnosticReport> {
    await this.runActiveHealthCheck();

    const services = globalServiceRegistry.getAllServices();
    const circuitBreakers = globalCircuitBreakerManager.getAllStatuses();
    const envChecks = this.getEnvironmentChecks();
    const resources = this.getResourceMetrics();
    const rootCauses = globalErrorAnalyzer.analyzeRootCauses();
    const incidentHistory = globalErrorAnalyzer.getIncidentHistory(15);

    // Determine Overall System Health State
    let overallHealth: HealthStatus = 'HEALTHY';
    const serviceList = Object.values(services);

    const hasCriticalFailure = serviceList.some((s) => s.isCritical && s.status === 'CRITICAL');
    const hasDegradedCritical = serviceList.some((s) => s.isCritical && (s.status === 'DEGRADED' || s.status === 'WARNING'));
    const hasAnyDegraded = serviceList.some((s) => s.status === 'DEGRADED' || s.status === 'WARNING');

    if (hasCriticalFailure) {
      overallHealth = 'CRITICAL';
    } else if (hasDegradedCritical) {
      overallHealth = 'WARNING';
    } else if (hasAnyDegraded) {
      overallHealth = 'DEGRADED';
    }

    const summaryMessage =
      overallHealth === 'HEALTHY'
        ? 'All required RODEX systems, AI engines, and memory services are fully operational.'
        : overallHealth === 'DEGRADED' || overallHealth === 'WARNING'
        ? `RODEX is operational with ${rootCauses.length} non-critical advisory conditions identified.`
        : 'Critical system component requires administrative attention.';

    return {
      overallHealth,
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      environment: process.env.NODE_ENV || 'development',
      summaryMessage,
      services,
      circuitBreakers,
      environmentChecks: envChecks,
      resources,
      incidentHistory,
      rootCauses,
    };
  }

  /**
   * Triggers non-destructive safe auto-repair
   */
  public async repair(targetService?: ServiceType) {
    return globalAutoRepairEngine.executeRepair(targetService);
  }

  /**
   * Triggers targeted self-recovery for failing/degraded services
   */
  public async recover(targetService?: ServiceType) {
    if (targetService) {
      return globalRecoveryManager.attemptRecovery(targetService);
    }
    return globalRecoveryManager.autoRecoverDegradedServices();
  }

  /**
   * Starts safe periodic background monitoring without event-loop blocking
   */
  public startWatch(intervalMs = 30000) {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    console.log(`[RODEX Doctor Watchdog] Background monitoring active (interval: ${intervalMs}ms).`);
    this.monitorInterval = setInterval(async () => {
      try {
        await this.runActiveHealthCheck();
      } catch (_) {}
    }, intervalMs);
  }

  /**
   * Stops background monitoring watchdog
   */
  public stopWatch() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
  }
}

export const globalRodexDoctor = RodexDoctorEngine.getInstance();
