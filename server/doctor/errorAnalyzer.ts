import { ServiceType, HealthStatus, IncidentRecord } from './types';
import { globalServiceRegistry } from './serviceRegistry';

export interface RootCauseAnalysis {
  title: string;
  description: string;
  affectedServices: ServiceType[];
  severity: HealthStatus;
  actionableFix: string;
}

export class ErrorAnalyzer {
  private static instance: ErrorAnalyzer;
  private incidentLog: IncidentRecord[] = [];
  private readonly MAX_INCIDENTS = 100;

  private constructor() {}

  public static getInstance(): ErrorAnalyzer {
    if (!ErrorAnalyzer.instance) {
      ErrorAnalyzer.instance = new ErrorAnalyzer();
    }
    return ErrorAnalyzer.instance;
  }

  public recordIncident(incident: Omit<IncidentRecord, 'id' | 'timestamp'>): IncidentRecord {
    const fullIncident: IncidentRecord = {
      ...incident,
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    // Deduplicate identical incidents within 5 seconds window
    const recentDuplicate = this.incidentLog.find(
      (inc) =>
        inc.service === fullIncident.service &&
        inc.message === fullIncident.message &&
        Date.now() - new Date(inc.timestamp).getTime() < 5000
    );

    if (!recentDuplicate) {
      this.incidentLog.unshift(fullIncident);
      if (this.incidentLog.length > this.MAX_INCIDENTS) {
        this.incidentLog.pop();
      }
    }

    return fullIncident;
  }

  public getIncidentHistory(limit = 20): IncidentRecord[] {
    return this.incidentLog.slice(0, limit);
  }

  public analyzeRootCauses(): RootCauseAnalysis[] {
    const services = globalServiceRegistry.getAllServices();
    const rootCauses: RootCauseAnalysis[] = [];

    // Check 1: AI Provider Failure vs GEMINI_API_KEY Missing
    const aiService = services.ai_provider;
    if (aiService && (aiService.status === 'DEGRADED' || aiService.status === 'CRITICAL')) {
      const apiKeyPresent = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      if (!apiKeyPresent) {
        rootCauses.push({
          title: 'Gemini API Key Missing in Environment',
          description:
            'The GEMINI_API_KEY variable is not defined. RODEX is operating in local fallback mode. AI responses may use synthesized fallback templates.',
          affectedServices: ['ai_provider', 'tool_suite', 'youtube_integration'],
          severity: 'WARNING',
          actionableFix:
            'Configure GEMINI_API_KEY in system environment or .env file and restart server.',
        });
      } else if (aiService.lastError?.includes('429') || aiService.lastError?.includes('RESOURCE_EXHAUSTED')) {
        rootCauses.push({
          title: 'Gemini API Rate Limit / Quota Exhaustion',
          description:
            'Google Gemini API gateway returned HTTP 429 quota limit. Grounding requests are throttled temporarily for 30 seconds to preserve stability.',
          affectedServices: ['ai_provider'],
          severity: 'DEGRADED',
          actionableFix:
            'Wait for request cooldown (30s) or check Google AI Studio API billing allocation.',
        });
      } else {
        rootCauses.push({
          title: 'AI Subsystem Processing Exception',
          description: `Gemini API encountered an error: ${aiService.lastError || 'Unknown exception'}`,
          affectedServices: ['ai_provider', 'tool_suite'],
          severity: aiService.status,
          actionableFix:
            'Trigger RODEX Doctor Safe Auto-Repair to re-verify AI client connectivity.',
        });
      }
    }

    // Check 2: Spotify Integration Unconfigured
    const spotifyService = services.spotify_integration;
    if (spotifyService && spotifyService.status === 'DEGRADED') {
      rootCauses.push({
        title: 'Spotify PC Integration Not Authenticated',
        description:
          'Spotify Client ID/Secret or active OAuth refresh token is not connected. Music remote commands will provide spoken status guidance.',
        affectedServices: ['spotify_integration'],
        severity: 'DEGRADED',
        actionableFix:
          'Connect Spotify in RODEX Settings or click Spotify OAuth link to enable PC remote control.',
      });
    }

    // Check 3: High Latency Detection Across Services
    const slowServices = Object.values(services).filter(
      (s) => s.responseTimeMs > (s.type === 'ai_provider' ? 3500 : 800)
    );
    if (slowServices.length > 0) {
      rootCauses.push({
        title: 'Response Latency Spike Detected',
        description: `Elevated latency detected in: ${slowServices.map((s) => s.name).join(', ')}.`,
        affectedServices: slowServices.map((s) => s.type),
        severity: 'WARNING',
        actionableFix:
          'Check network interface latency or run Doctor Safe Auto-Repair to flush transient caches.',
      });
    }

    return rootCauses;
  }
}

export const globalErrorAnalyzer = ErrorAnalyzer.getInstance();
