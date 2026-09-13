export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface WebSource {
  title: string;
  url: string;
  domain?: string;
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

export type AppMode = 'home' | 'chat' | 'image' | 'file' | 'code' | 'web' | 'more';

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
  customWakeWord?: CustomWakeWordConfig;
}

export type ThemeAccent = 'cyan' | 'emerald' | 'purple' | 'azure';

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
