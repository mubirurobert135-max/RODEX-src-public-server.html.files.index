export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'processing'
  | 'executing_tool'
  | 'speaking'
  | 'success'
  | 'warning'
  | 'error'
  | 'permission_required'
  | 'wake_detected';

export type VoiceEngineState =
  | 'INITIALIZING'
  | 'MIC_PERMISSION_REQUIRED'
  | 'MIC_READY'
  | 'IDLE_LISTENING'
  | 'WAKE_DETECTED'
  | 'LISTENING'
  | 'PROCESSING'
  | 'EXECUTING'
  | 'SPEAKING'
  | 'FOLLOW_UP_READY'
  | 'PAUSED'
  | 'MIC_UNAVAILABLE'
  | 'PERMISSION_REVOKED'
  | 'ERROR';

export interface VoiceDiagnostics {
  state: VoiceEngineState;
  hasInputDevice: boolean;
  permissionState: 'granted' | 'denied' | 'prompt' | 'unknown';
  isStreamActive: boolean;
  isRecognitionActive: boolean;
  isSynthActive: boolean;
  wakeWordEnabled: boolean;
  consecutiveErrors: number;
  reconnectAttempts: number;
  lastEvent: string;
  lastError: string | null;
  audioLevel: number;
  pitchHz: number;
  followUpWindowMs: number;
}

export function mapVoiceStateToAssistantState(vState: VoiceEngineState): AssistantState {
  switch (vState) {
    case 'INITIALIZING':
      return 'planning';
    case 'MIC_PERMISSION_REQUIRED':
    case 'PERMISSION_REVOKED':
      return 'permission_required';
    case 'MIC_READY':
    case 'IDLE_LISTENING':
    case 'PAUSED':
      return 'idle';
    case 'WAKE_DETECTED':
      return 'wake_detected';
    case 'LISTENING':
    case 'FOLLOW_UP_READY':
      return 'listening';
    case 'PROCESSING':
      return 'thinking';
    case 'EXECUTING':
      return 'executing';
    case 'SPEAKING':
      return 'speaking';
    case 'MIC_UNAVAILABLE':
      return 'warning';
    case 'ERROR':
      return 'error';
    default:
      return 'idle';
  }
}

export type TaskState =
  | 'CREATED'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'WAITING_FOR_PERMISSION'
  | 'EXECUTING'
  | 'WAITING_FOR_EXTERNAL_RESULT'
  | 'WAITING_FOR_USER'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface TaskStepItem {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'waiting';
  toolName?: string;
  result?: any;
  error?: string;
}

export interface AgentTask {
  id: string;
  title: string;
  category: 'streaming_setup' | 'restaurant_booking' | 'communication' | 'schedule' | 'device' | 'multi_step' | 'general';
  goal: string;
  state: TaskState;
  currentStepIndex: number;
  steps: TaskStepItem[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  confirmationAction?: {
    label: string;
    actionId: string;
    params?: any;
  };
  alternativeProposal?: string;
  resultSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  eventType: 'state_changed' | 'step_completed' | 'step_failed' | 'user_confirmation' | 'task_completed';
  payload?: any;
  timestamp: string;
}

export interface WebSource {
  title: string;
  url: string;
  domain?: string;
}

export interface PlanStep {
  stepNumber: number;
  description: string;
  toolName?: string;
  toolParams?: any;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'requires_permission';
  result?: any;
}

export interface ToolExecutionRecord {
  toolName: string;
  inputParams: any;
  result: any;
  latencyMs: number;
  timestamp: string;
  validated: boolean;
}

export interface OrchestrationTrace {
  intent: {
    primaryIntent: string;
    confidence: number;
    extractedEntities: Record<string, any>;
    suggestedTools: string[];
    requiresPlanning: boolean;
    riskLevel: string;
  };
  plan?: {
    goal: string;
    steps: PlanStep[];
    selectedModel: string;
    estimatedComplexity: string;
  };
  executedTools: ToolExecutionRecord[];
  selectedModel: string;
  validationPassed: boolean;
  totalLatencyMs: number;
  recoveredFromError?: boolean;
}

export interface PendingActionConfirmation {
  actionId: string;
  toolName: string;
  description: string;
  params: any;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  imageUrl?: string;
  error?: boolean;
  speaker?: string;
  speakerVerified?: boolean;
  sources?: WebSource[];
  searchQueries?: string[];
  webGrounded?: boolean;
  actionStatus?: 'prepared' | 'completed' | 'failed' | 'needs_permission' | 'needs_confirmation';
  orchestrationTrace?: OrchestrationTrace;
  pendingConfirmation?: PendingActionConfirmation;
  generatedImage?: {
    url: string;
    prompt: string;
    isEdit?: boolean;
    aspectRatio?: string;
    model?: string;
  };
}


export interface VoiceProfile {
  speakerName: string;
  isRecognized: boolean;
  confidence: number;
  pitchHz: number;
  voiceprintStatus: 'calibrated' | 'listening' | 'matched' | 'learning';
  wakeWord: string;
}

export interface CustomWakeWordSample {
  id: string;
  sampleNumber: number;
  durationMs: number;
  avgPitchHz: number;
  peakLevel: number;
  timestamp: string;
  audioBlobUrl?: string;
}

export interface CustomWakeWordConfig {
  phrase: string;
  enabled: boolean;
  isTrained: boolean;
  samplesCount: number;
  targetSamples: number;
  trainedAt?: string;
  acousticMatchScore?: number;
  calibratedPitchHz?: number;
  samples?: CustomWakeWordSample[];
}

export type AppMode = 'home' | 'chat' | 'image' | 'schedule' | 'plugins' | 'file' | 'code' | 'web' | 'spotify' | 'more';

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  volume_percent: number;
  supports_volume: boolean;
}

export interface SpotifyTrackInfo {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  uri: string;
  externalUrl?: string;
  device?: SpotifyDevice | null;
}

export interface SpotifyStatus {
  connected: boolean;
  isDemo: boolean;
  configured: boolean;
  redirectUri: string;
  appUrl: string;
  playback: SpotifyTrackInfo | null;
  device: SpotifyDevice | null;
  devices: SpotifyDevice[];
  user?: {
    displayName: string;
    email?: string;
    product?: string;
  };
}

export interface VoiceSettings {
  voiceURI: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0.0 to 1.0
  autoSpeak: boolean;
  wakeWordEnabled: boolean;
  audioSens: number; // 1 to 5
  webSearchEnabled?: boolean;
  hapticFeedbackEnabled?: boolean; // Navigator Vibration API physical feedback
  performanceMode?: 'ultra' | 'balanced' | 'deep_reasoning'; // Ultra-low latency engine vs balanced vs deep
  customWakeWord?: CustomWakeWordConfig;
}

export type ThemeAccent = 'auto' | 'cyan' | 'gold' | 'ruby' | 'emerald' | 'purple' | 'azure';

export interface QuickPrompt {
  id: string;
  title: string;
  prompt: string;
  iconName: string;
}

export interface WebVerificationResult {
  status: 'VERIFIED_ONLINE' | 'STANDBY' | 'ERROR';
  latencyMs: number;
  searchGrounding: string;
  carrier: string;
  timestamp: string;
  nodes: string[];
  sampleVerifiedSources?: WebSource[];
  sampleHeadline?: string;
  neuralOps?: string;
  verifiedUser?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  startedAt: string;
  lastActiveAt: string;
  isLive: boolean;
  messages: ChatMessage[];
  speaker: string;
}

export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityCategory = 'system' | 'network' | 'application' | 'account' | 'malware' | 'phishing';
export type SecuritySystemStatus = 'protected' | 'monitoring' | 'attention_required';

export interface SecurityIncident {
  id: string;
  title: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  status: 'detected' | 'investigating' | 'mitigated' | 'resolved';
  timestamp: string;
  affectedResource: string;
  evidence: string;
  confidence: number; // 0 to 100
  possibleImpact: string;
  recommendedActions: string[];
  isConfirmed: 'confirmed' | 'suspected' | 'anomaly';
  source: string;
}

export interface SecurityState {
  status: SecuritySystemStatus;
  monitoringActive: boolean;
  lastScannedAt: string;
  totalChecks: number;
  threatsCount: number;
  incidents: SecurityIncident[];
}


export type UpdateCategory = 'ai_model' | 'dependency' | 'security' | 'architecture' | 'configuration';
export type UpdateRecommendationLevel = 'ignore' | 'monitor' | 'recommend' | 'prepare';
export type UpdatePolicyLevel = 1 | 2 | 3 | 4;

export interface TechnologyUpdateItem {
  id: string;
  name: string;
  category: UpdateCategory;
  currentVersion: string;
  availableVersion: string;
  releaseDate: string;
  description: string;
  securityRelevant: boolean;
  compatibilityScore: number; // 0 to 100
  potentialBenefits: string[];
  potentialRisks: string[];
  breakingChangesWarning?: string;
  complexity: 'low' | 'medium' | 'high';
  recommendation: UpdateRecommendationLevel;
  status: 'discovered' | 'approved' | 'testing' | 'applied' | 'rolled_back';
  timestamp: string;
}

export interface SystemUpdateState {
  version: string;
  lastCheckedAt: string;
  policyLevel: UpdatePolicyLevel;
  autoApplyLowRisk: boolean;
  updates: TechnologyUpdateItem[];
  history: Array<{
    id: string;
    updateName: string;
    action: string;
    timestamp: string;
    success: boolean;
    details: string;
  }>;
}

export interface MediaSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  type: 'song' | 'music_video' | 'artist' | 'playlist';
  videoUrl?: string;
  audioUrl?: string;
  albumArtUrl?: string;
  releaseDate?: string;
  genre?: string;
  lyricsSnippet?: string;
  sources: WebSource[];
  recommendedQuality: 'HD' | 'SD' | 'Audio-Only';
}

export interface NetworkQualityStats {
  effectiveType: string;
  latencyMs: number;
  downlinkMbps: number;
  connectionStable: boolean;
  bufferingRisk: 'low' | 'medium' | 'high';
  strategy: 'high-quality' | 'balanced' | 'low-bandwidth' | 'offline';
  deviceCores: number;
  deviceMemoryGb?: number;
}
