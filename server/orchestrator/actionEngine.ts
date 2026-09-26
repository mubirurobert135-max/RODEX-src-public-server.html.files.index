import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolPermissionLevel,
} from './types';
import { globalToolRegistry } from './registry';
import { globalServiceRegistry } from '../doctor/serviceRegistry';
import { globalCircuitBreakerManager } from '../doctor/circuitBreaker';
import { globalPerformanceTracker } from '../services/performanceTracker';

export type ErrorClassification =
  | 'INVALID_INPUT'
  | 'PERMISSION_DENIED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED'
  | 'EXECUTION_ERROR'
  | 'VERIFICATION_FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface ActionTraceRecord {
  actionId: string;
  toolName: string;
  params: any;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'PENDING' | 'CANCELLED';
  verificationMethod: 'DIRECT' | 'STATE' | 'LAUNCH_CONFIRMATION' | 'BEST_EFFORT';
  errorType?: ErrorClassification;
  errorMessage?: string;
  durationMs: number;
  timestamp: string;
}

export class ActionEngine {
  private static instance: ActionEngine;
  private actionJournal: ActionTraceRecord[] = [];
  private activeExecutions: Map<string, AbortController> = new Map();

  private constructor() {}

  public static getInstance(): ActionEngine {
    if (!ActionEngine.instance) {
      ActionEngine.instance = new ActionEngine();
    }
    return ActionEngine.instance;
  }

  /**
   * Safe input validation for tool arguments
   */
  public validateInput(tool: ToolDefinition, params: any): { valid: boolean; error?: string } {
    const registryValidation = globalToolRegistry.validateParameters(tool, params);
    if (!registryValidation.valid) {
      return { valid: false, error: registryValidation.error };
    }

    // Additional security checks
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string') {
        // Prevent path traversal attempts
        if (val.includes('../') || val.includes('..\\')) {
          return { valid: false, error: `Security block: Potential path traversal in argument '${key}'.` };
        }
        // Block prompt injection patterns targeting tool parameter coercion
        if (val.toLowerCase().includes('ignore previous instructions') || val.toLowerCase().includes('system directive override')) {
          return { valid: false, error: `Security block: Malicious directive detected in parameter '${key}'.` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Determine verification strategy based on tool category and action type
   */
  public getVerificationMethod(toolName: string, params: any): 'DIRECT' | 'STATE' | 'LAUNCH_CONFIRMATION' | 'BEST_EFFORT' {
    if (toolName === 'open_approved_url') {
      return 'LAUNCH_CONFIRMATION';
    }
    if (toolName === 'media_control' || toolName === 'spotify_control') {
      return 'STATE';
    }
    if (toolName === 'email_service' || toolName === 'contacts_service') {
      return 'DIRECT';
    }
    return 'BEST_EFFORT';
  }

  /**
   * Standardized tool execution pipeline:
   * UNDERSTAND -> SELECT -> PERMISSION GATE -> TIMEOUT/ABORT -> RETRY -> VERIFY -> DOCTOR UPDATE
   */
  public async executeAction(
    toolName: string,
    params: any,
    context: ToolExecutionContext = {},
    actionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  ): Promise<ToolExecutionResult & { verificationMethod: string; durationMs: number }> {
    const startTime = Date.now();
    const tool = globalToolRegistry.get(toolName);

    if (!tool) {
      const durationMs = Date.now() - startTime;
      this.logJournalRecord({
        actionId,
        toolName,
        params,
        status: 'FAILED',
        verificationMethod: 'BEST_EFFORT',
        errorType: 'UNSUPPORTED',
        errorMessage: `Tool '${toolName}' is not registered in the RODEX Action Registry.`,
        durationMs,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        output: null,
        error: `Tool '${toolName}' not found.`,
        verificationMethod: 'BEST_EFFORT',
        durationMs,
      };
    }

    // 1. INPUT VALIDATION
    const validation = this.validateInput(tool, params);
    if (!validation.valid) {
      const durationMs = Date.now() - startTime;
      this.logJournalRecord({
        actionId,
        toolName,
        params,
        status: 'FAILED',
        verificationMethod: this.getVerificationMethod(toolName, params),
        errorType: 'INVALID_INPUT',
        errorMessage: validation.error,
        durationMs,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        output: null,
        error: validation.error,
        verificationMethod: this.getVerificationMethod(toolName, params),
        durationMs,
      };
    }

    // 2. PERMISSION CHECKS & USER IDENTITY SANITY GATES
    if (tool.permissionLevel === 'high_risk' && !context.hasElevatedPermission) {
      const durationMs = Date.now() - startTime;
      this.logJournalRecord({
        actionId,
        toolName,
        params,
        status: 'FAILED',
        verificationMethod: this.getVerificationMethod(toolName, params),
        errorType: 'PERMISSION_DENIED',
        errorMessage: `Permission level '${tool.permissionLevel}' required but not granted for current context.`,
        durationMs,
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        output: null,
        error: `Permission Denied: Execution of high-risk actions requires elevated privileges or administrative verification.`,
        verificationMethod: this.getVerificationMethod(toolName, params),
        durationMs,
      };
    }

    // Check circuit breaker status for tool dependencies
    const breaker = globalCircuitBreakerManager.getBreaker('tool_suite');
    if (!breaker.canExecute()) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        output: null,
        error: `Action Engine warning: dependencies for Tool '${toolName}' are isolated due to repeated fault trips.`,
        verificationMethod: this.getVerificationMethod(toolName, params),
        durationMs,
      };
    }

    // 3. RETRY POLICY & TIMEOUT ENGINE
    const maxRetries = tool.permissionLevel === 'safe' ? 2 : 0; // Don't auto-retry state-mutating actions (high-risk/non-idempotent)
    let attempt = 0;
    let lastError = '';
    let success = false;
    let result: ToolExecutionResult = { success: false, output: null };

    const abortController = new AbortController();
    this.activeExecutions.set(actionId, abortController);

    while (attempt <= maxRetries && !success) {
      // Yield to event loop to allow concurrent/immediate abortAction calls to register
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (abortController.signal.aborted) {
        const durationMs = Date.now() - startTime;
        this.logJournalRecord({
          actionId,
          toolName,
          params,
          status: 'CANCELLED',
          verificationMethod: this.getVerificationMethod(toolName, params),
          errorType: 'CANCELLED',
          errorMessage: 'Action execution aborted by client/user.',
          durationMs,
          timestamp: new Date().toISOString(),
        });
        this.activeExecutions.delete(actionId);
        return {
          success: false,
          output: null,
          error: 'Action cancelled successfully.',
          verificationMethod: this.getVerificationMethod(toolName, params),
          durationMs,
        };
      }

      attempt++;
      try {
        // Enforce a strict 10-second execution timeout using a race
        const executionPromise = globalToolRegistry.executeTool(toolName, params, context);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('EXECUTION_TIMEOUT')), 10000)
        );

        result = await Promise.race([executionPromise, timeoutPromise]);
        if (result.success) {
          success = true;
          breaker.recordSuccess();
        } else {
          lastError = result.error || 'Execution returned success=false';
          breaker.recordFailure();
        }
      } catch (err: any) {
        lastError = err?.message || 'Unknown handler error';
        breaker.recordFailure();
        if (err?.message === 'EXECUTION_TIMEOUT') {
          break; // Don't retry on timeout
        }
      }

      if (!success && attempt <= maxRetries) {
        console.warn(`[RODEX ActionEngine] Retrying tool execution for '${toolName}' (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 500)); // Short cooldown backoff
      }
    }

    this.activeExecutions.delete(actionId);
    const durationMs = Date.now() - startTime;

    // 4. VERIFICATION PIPELINE
    const verificationMethod = this.getVerificationMethod(toolName, params);
    let finalStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' = success ? 'SUCCESS' : 'FAILED';

    if (success && verificationMethod === 'LAUNCH_CONFIRMATION') {
      // Launcher tools cannot guarantee state verification, treat as partial until verified on the client side
      finalStatus = 'PARTIAL';
    }

    // Redact sensitive keys safely in action traces
    const redactedParams = { ...params };
    const secrets = ['password', 'passcode', 'token', 'secret', 'apikey', 'key'];
    for (const key of Object.keys(redactedParams)) {
      if (secrets.some((s) => key.toLowerCase().includes(s))) {
        redactedParams[key] = '[REDACTED_SECURE]';
      }
    }

    this.logJournalRecord({
      actionId,
      toolName,
      params: redactedParams,
      status: finalStatus,
      verificationMethod,
      errorMessage: success ? undefined : lastError,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    // Report performance metadata back to RODEX Doctor & Metrics
    globalPerformanceTracker.logMetric({
      type: 'tool',
      totalLatencyMs: durationMs,
      aiLatencyMs: 0,
      cacheHit: false,
      success,
    });

    globalServiceRegistry.updateServiceHealth('tool_suite', success ? 'HEALTHY' : 'WARNING', durationMs);

    return {
      ...result,
      verificationMethod,
      durationMs,
    };
  }

  /**
   * Graceful Abort support for pending commands
   */
  public abortAction(actionId: string): boolean {
    const controller = this.activeExecutions.get(actionId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(actionId);
      return true;
    }
    return false;
  }

  /**
   * Record transaction action journal details
   */
  private logJournalRecord(record: ActionTraceRecord): void {
    this.actionJournal.unshift(record);
    if (this.actionJournal.length > 50) {
      this.actionJournal.pop();
    }
  }

  public getJournal(): ActionTraceRecord[] {
    return this.actionJournal;
  }
}

export const globalActionEngine = ActionEngine.getInstance();
