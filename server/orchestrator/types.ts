// Central Type Definitions for RODEX Intelligence Core and Tool Orchestration

export type ToolPermissionLevel = 'safe' | 'elevated' | 'high_risk';

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  parameters: Record<string, ToolParameterSchema>;
  handler: (params: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  examples?: Array<{ query: string; params: any }>;
}

export interface ToolExecutionContext {
  userId?: string;
  userName?: string;
  clientFormattedTime?: string;
  timeZone?: string;
  sessionContext?: Record<string, any>;
  hasElevatedPermission?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  message?: string;
  sources?: Array<{ title: string; url: string; domain?: string }>;
  searchQueries?: string[];
  requiresConfirmation?: boolean;
  confirmationPayload?: {
    actionName: string;
    description: string;
    params: any;
  };
  metadata?: Record<string, any>;
}

export type TaskIntentCategory =
  | 'open_url'
  | 'web_search'
  | 'media_control'
  | 'system_info'
  | 'file_inspection'
  | 'calculate_compute'
  | 'datetime_timezone'
  | 'app_action'
  | 'creator_inquiry'
  | 'cultural_knowledge'
  | 'general_knowledge'
  | 'conversational';

export interface IntentClassification {
  primaryIntent: TaskIntentCategory;
  confidence: number;
  extractedEntities: Record<string, any>;
  suggestedTools: string[];
  requiresPlanning: boolean;
  riskLevel: ToolPermissionLevel;
}

export interface PlanStep {
  stepNumber: number;
  description: string;
  toolName?: string;
  toolParams?: any;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'requires_permission';
  result?: ToolExecutionResult;
}

export interface OrchestrationPlan {
  goal: string;
  steps: PlanStep[];
  selectedModel: string;
  estimatedComplexity: 'instant' | 'simple' | 'multi_step';
}

export interface ToolExecutionRecord {
  toolName: string;
  inputParams: any;
  result: ToolExecutionResult;
  latencyMs: number;
  timestamp: string;
  validated: boolean;
}

export interface OrchestratorTrace {
  intent: IntentClassification;
  plan?: OrchestrationPlan;
  executedTools: ToolExecutionRecord[];
  selectedModel: string;
  validationPassed: boolean;
  totalLatencyMs: number;
  recoveredFromError?: boolean;
}

export interface OrchestratorResponse {
  reply: string;
  trace: OrchestratorTrace;
  sources?: Array<{ title: string; url: string; domain?: string }>;
  searchQueries?: string[];
  webGrounded?: boolean;
  pendingConfirmation?: {
    actionId: string;
    toolName: string;
    description: string;
    params: any;
  };
}
