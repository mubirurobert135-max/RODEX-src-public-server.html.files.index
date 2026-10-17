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
  userEmail?: string;
  clientFormattedTime?: string;
  timeZone?: string;
  sessionContext?: Record<string, any>;
  hasElevatedPermission?: boolean;
  gmailAccessToken?: string;
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
  | 'weather'
  | 'memory_operation'
  | 'platform_bridge'
  | 'app_action'
  | 'email_operation'
  | 'contacts_operation'
  | 'device_security'
  | 'image_intelligence'
  | 'exact_command'
  | 'schedule_operation'
  | 'doctor_diagnostics'
  | 'system_updates'
  | 'creator_inquiry'
  | 'user_identity_inquiry'
  | 'cultural_knowledge'
  | 'general_knowledge'
  | 'conversational'
  | 'clarification_needed';

export type InteractionType =
  | 'info_request'
  | 'action_command'
  | 'content_generation'
  | 'conversation'
  | 'confirmation_required'
  | 'ambiguous';

export type ResponseFormat =
  | 'exact'
  | 'yes_no'
  | 'numeric_only'
  | 'concise'
  | 'detailed'
  | 'read_only'
  | 'normal';

export type ActionStatus =
  | 'prepared'
  | 'completed'
  | 'failed'
  | 'needs_permission'
  | 'needs_confirmation';

export interface IntentClassification {
  primaryIntent: TaskIntentCategory;
  confidence: number;
  extractedEntities: Record<string, any>;
  suggestedTools: string[];
  requiresPlanning: boolean;
  riskLevel: ToolPermissionLevel;
  interactionType?: InteractionType;
  responseFormat?: ResponseFormat;
  exactOutputRequested?: boolean;
  exactText?: string;
  isIncomplete?: boolean;
  clarificationPrompt?: string;
  isFollowUp?: boolean;
  resolvedQuery?: string;
  detailLevel?: 'concise' | 'normal' | 'detailed';
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
  actionStatus?: ActionStatus;
}

export interface OrchestratorResponse {
  reply: string;
  trace: OrchestratorTrace;
  openUrl?: string;
  executedTools?: ToolExecutionRecord[];
  sources?: Array<{ title: string; url: string; domain?: string }>;
  searchQueries?: string[];
  webGrounded?: boolean;
  actionStatus?: ActionStatus;
  generatedImage?: {
    url: string;
    prompt: string;
    isEdit?: boolean;
    aspectRatio?: string;
    model?: string;
  };
  pendingConfirmation?: {
    actionId: string;
    toolName: string;
    description: string;
    params: any;
  };
}


export type CapabilityDomainId =
  | 'image_intelligence'
  | 'intelligence_reasoning'
  | 'long_term_memory'
  | 'device_interaction'
  | 'communication_messaging'
  | 'email_hub'
  | 'web_global_knowledge'
  | 'automation_multistep'
  | 'security_permission_gate';


export interface CapabilityDomain {
  id: CapabilityDomainId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  status: 'active' | 'standby' | 'restricted';
  version: string;
  tools: string[];
  features: string[];
  subsystems: Array<{ name: string; status: 'active' | 'standby' | 'healthy'; description: string }>;
}

export type ProactiveState = 'observing' | 'suggesting' | 'preparing' | 'executing';

export interface ProactiveSuggestion {
  id: string;
  title: string;
  category: 'workflow' | 'follow_up' | 'memory' | 'security' | 'knowledge' | 'device';
  suggestedAction: string;
  reason: string;
  state: ProactiveState;
  requiresAuth: boolean;
  confidence: number;
  timestamp: string;
}

