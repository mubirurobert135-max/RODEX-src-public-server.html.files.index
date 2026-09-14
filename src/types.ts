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

export type AppMode = 'home' | 'chat' | 'image' | 'file' | 'code' | 'web' | 'spotify' | 'more';

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
