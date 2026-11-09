/**
 * RODEX Gemini 3.8 Live API Client Service — MASTER COMMUNICATION ENGINE
 *
 * Full Voice, Communication & System Reliability Pipeline:
 * - Dedicated Output Audio Engine (24kHz Linear PCM -> Gain 1.0 -> Analyser -> Destination)
 * - Exclusive Microphone Lifecycle (16kHz Linear PCM -> /api/live WebSocket)
 * - 6 Supported Wake Words: "hey", "hello", "hi", "rodex", "hey rodex", "hello rodex"
 * - Instant Catch-Phrase Greeting: "Boss, watsap today?"
 * - Continuous Human-Like Conversational Session with 9s follow-up window
 * - Real-Time User Barge-In / Interruption Handling
 * - Strict Stage-by-Stage Observable Traces
 */

import { rodexSynth, normalizeForWakeWord, STANDARD_WAKE_PHRASES } from '../utils/speech';

export type LiveSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'idle'
  | 'wake_listening'
  | 'input_detected'
  | 'wake_detected'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface LiveMetrics {
  status: LiveSessionStatus;
  isMicLive: boolean;
  inputActivityDetected: boolean;
  outputPlaying: boolean;
  audioChunksSent: number;
  bytesSent: number;
  modelMessagesReceived: number;
  audioChunksReceived: number;
  inputLevel: number;
  outputLevel: number;
  lastError: string | null;
}

export interface DetailedAudioDiagnostics {
  // Core Live response states
  liveConnection: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  textRequest: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  serverResponse: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  audioDataReceived: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  audioDataValid: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  audioGraphActive: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  outputSignalDetected: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  playbackStarted: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  playbackEnded: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  audibleOutputVerified: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  speakerTest: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';
  generatedAudioTest: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL';

  // Normal Orb Live Voice Diagnostics
  orbVoiceState: string;
  voiceEngine: string;
  lastWakeTranscript: string;
  lastRecognizedTranscript: string;
  wakeRecognizerState: string;
  upstreamConnected: boolean;
  inputAudioContextState: string;
  micInputLevel: number;
  audioChunksSent: number;
  micTrackState: string;
  lastCommand: string;
  wakeMatch: boolean;
  voiceSessionId: string;
  micStreamId: string;
  isConversationActive: boolean;

  // Last Action & Status
  lastAction: string;
  lastErrorMessage: string | null;

  // PCM & Buffer Measurements
  sampleCount: number;
  sampleRate: number;
  bufferDuration: number;
  peakLevel: number;
  rmsLevel: number;
  audioBytes: number;
  audioMime: string;
  outputSignalLevel: number;

  // Browser Audio Environment
  visibilityState: string;
  documentHasFocus: boolean;
  audioContextState: string;
  audioContextSampleRate: number;
  audioGainValue: number;
}

export interface LiveServiceCallbacks {
  onStatusChange?: (status: LiveSessionStatus) => void;
  onAudioLevel?: (inputLevel: number, outputLevel: number) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onWakeDetected?: (wakeText: string) => void;
  onGreetingStarted?: () => void;
  onGreetingEnded?: () => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError?: (errorMessage: string) => void;
  onGrounding?: (metadata: any) => void;
  onBrowserAction?: (action: { url: string; label?: string; destinationType?: 'youtube' | 'google' | 'website' }) => void;
}

export function normalizeTranscript(text: string): string {
  return normalizeForWakeWord(text);
}

export function matchWakePhrase(text: string): { matched: boolean; phrase: string | null; command: string } {
  const norm = normalizeForWakeWord(text);

  for (const phrase of STANDARD_WAKE_PHRASES) {
    if (norm === phrase) {
      return { matched: true, phrase, command: '' };
    }
    if (norm.startsWith(phrase + ' ')) {
      return { matched: true, phrase, command: norm.substring(phrase.length).trim() };
    }
    // Also check as whole word inside string
    const idx = norm.indexOf(phrase);
    if (idx !== -1) {
      const before = idx === 0 || norm[idx - 1] === ' ';
      const after = idx + phrase.length === norm.length || norm[idx + phrase.length] === ' ';
      if (before && after) {
        const cmd = (norm.substring(0, idx) + ' ' + norm.substring(idx + phrase.length)).replace(/\s+/g, ' ').trim();
        return { matched: true, phrase, command: cmd };
      }
    }
  }

  return { matched: false, phrase: null, command: '' };
}

export class LiveConversationService {
  private ws: WebSocket | null = null;
  private connectionAttempt: Promise<void> | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private pendingStartupAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Singleton initialization guards & Session Resumption
  private initializationInProgress = false;
  private engineStarted = false;
  // Invalidates pending startup work when React StrictMode or a real unmount calls stop().
  private startupGeneration = 0;
  private wakeRecognizer: any = null;
  private diagnosticTextTestActive = false;
  private diagnosticTextTestTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionResumptionHandle: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private explicitShutdown = false;
  private eventTimeline: Array<{ timestamp: string; category: string; message: string; sessionId?: string }> = [];

  // Single Dedicated Output AudioContext & Graph
  private outputAudioCtx: AudioContext | null = null;
  private outputGainNode: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private nextPlaybackTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private isGreetingPlaying = false;
  private isConversationActive = false;
  // For deterministic utility replies (like the clock), the server's exact answer
  // is spoken locally and any model-generated restatement is suppressed for that turn.
  private deterministicResponseForTurn = false;
  private deterministicResponseSpeechActive = false;
  private deterministicResponseTurnFinished = false;
  private deterministicResponseSource: string | null = null;
  private deterministicResponseRunId = 0;
  private followUpSilenceTimer: NodeJS.Timeout | null = null;
  private status: LiveSessionStatus = 'disconnected';
  private callbacks: LiveServiceCallbacks = {};

  // Audio level monitoring & Barge-in detection
  private levelAnimFrame: number | null = null;
  private currentInputLevel = 0;
  private currentOutputLevel = 0;
  private currentOutputSignalLevel = 0;
  private consecutiveBargeInFrames = 0;

  // Real-time Live Voice Diagnostic Metrics
  private audioChunksSent = 0;
  private bytesSent = 0;
  // Send a fresh wall-clock anchor about once per second without bloating every audio frame.
  private lastClockContextSentAt = 0;
  private modelMessagesReceived = 0;
  private audioChunksReceived = 0;
  private isMicLive = false;
  private inputActivityDetected = false;
  private lastError: string | null = null;
  private diagnosticLogs: Array<{ id: string; time: string; text: string }> = [];

  // Accumulated Response Chunks for complete single-buffer playback
  private turnPcmChunks: Uint8Array[] = [];
  private lastCompleteResponseBuffer: AudioBuffer | null = null;
  private pendingSpokenTranscript = '';
  private pendingTurnCompletionAfterPlayback = false;

  // Diagnostics State
  private diag: DetailedAudioDiagnostics = {
    liveConnection: 'WAITING',
    textRequest: 'WAITING',
    serverResponse: 'WAITING',
    audioDataReceived: 'WAITING',
    audioDataValid: 'WAITING',
    audioGraphActive: 'WAITING',
    outputSignalDetected: 'WAITING',
    playbackStarted: 'WAITING',
    playbackEnded: 'WAITING',
    audibleOutputVerified: 'WAITING',
    speakerTest: 'WAITING',
    generatedAudioTest: 'WAITING',
    orbVoiceState: 'IDLE',
    voiceEngine: 'UNINITIALIZED',
    lastWakeTranscript: 'NONE',
    lastRecognizedTranscript: 'NONE',
    wakeRecognizerState: 'UNINITIALIZED',
    upstreamConnected: false,
    inputAudioContextState: 'uninitialized',
    micInputLevel: 0,
    audioChunksSent: 0,
    micTrackState: 'uninitialized',
    lastCommand: 'NONE',
    wakeMatch: false,
    voiceSessionId: 'NONE',
    micStreamId: 'NONE',
    isConversationActive: false,
    lastAction: 'INITIALIZED',
    lastErrorMessage: null,
    sampleCount: 0,
    sampleRate: 24000,
    bufferDuration: 0,
    peakLevel: 0,
    rmsLevel: 0,
    audioBytes: 0,
    audioMime: 'audio/pcm;rate=24000',
    outputSignalLevel: 0,
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    documentHasFocus: typeof document !== 'undefined' ? document.hasFocus() : false,
    audioContextState: 'uninitialized',
    audioContextSampleRate: 24000,
    audioGainValue: 1.0,
  };

  constructor(callbacks?: LiveServiceCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.setupVisibilityListener();
  }

  private setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.addTrace('TAB VISIBLE: VERIFYING AUDIO & MIC STATES');
          if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
            this.outputAudioCtx.resume().catch(() => {});
          }
          if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
            this.inputAudioCtx.resume().catch(() => {});
          }
          if (!this.isConnected() && this.isMicLive) {
            this.connectWebSocketOnly().catch(() => {});
          }
        }
      });
    }
  }

  /**
   * Initializes or returns the dedicated output audio graph:
   * Source -> GainNode (1.0) -> AnalyserNode -> outputAudioContext.destination
   */
  public getOrCreateOutputAudioGraph(): {
    ctx: AudioContext;
    gain: GainNode;
    analyser: AnalyserNode;
  } {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      this.diag.audioContextSampleRate = this.outputAudioCtx.sampleRate;
    }

    if (!this.outputGainNode) {
      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputGainNode.gain.value = 1.0;
      this.diag.audioGainValue = 1.0;
    }

    if (!this.outputAnalyser) {
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.15;
    }

    try {
      this.outputGainNode.disconnect();
      this.outputAnalyser.disconnect();
      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
    } catch (_) {}

    this.diag.audioContextState = this.outputAudioCtx.state;
    this.diag.audioGraphActive = 'PASS';

    return {
      ctx: this.outputAudioCtx,
      gain: this.outputGainNode,
      analyser: this.outputAnalyser,
    };
  }

  /**
   * Unlock AudioContext immediately inside user gesture
   */
  public async unlockOutputAudio(): Promise<void> {
    const { ctx } = this.getOrCreateOutputAudioGraph();
    this.addTrace(`OUTPUT CONTEXT STATE BEFORE = ${ctx.state}`);

    if (ctx.state !== 'running') {
      await ctx.resume().catch(() => {});
    }

    this.addTrace(`OUTPUT CONTEXT STATE AFTER = ${ctx.state}`);
    this.addTrace('AUDIO OUTPUT UNLOCKED');
    this.addTrace('OUTPUT GAIN = 1.0');
    this.diag.audioContextState = ctx.state;
  }

  /** Call synchronously from a real user gesture to unlock both audio contexts. */
  public async unlockVoiceAudio(): Promise<void> {
    try {
      const { ctx: outputCtx } = this.getOrCreateOutputAudioGraph();
      const inputCtx = this.inputAudioCtx || this.pendingStartupAudioCtx;
      this.addTrace(`USER GESTURE AUDIO UNLOCK: input=${inputCtx?.state || 'not-created'}, output=${outputCtx.state}`);

      const resumeTasks: Promise<void>[] = [];
      if (outputCtx.state !== 'running') {
        resumeTasks.push(outputCtx.resume().catch(() => {}));
      }
      if (inputCtx && inputCtx.state !== 'running') {
        resumeTasks.push(inputCtx.resume().catch(() => {}));
      }
      await Promise.all(resumeTasks);

      this.diag.audioContextState = outputCtx.state;
      this.addTrace(`USER GESTURE AUDIO UNLOCK RESULT: input=${this.inputAudioCtx?.state || 'not-created'}, output=${outputCtx.state}`);
      if (this.inputAudioCtx?.state === 'running') {
        this.addTrace('INPUT AUDIO PROCESSING READY');
      } else if (this.inputAudioCtx) {
        this.addTrace('INPUT AUDIO CONTEXT STILL SUSPENDED; LIVE PCM MAY WAIT FOR ANOTHER USER GESTURE');
      }
    } catch (err: any) {
      this.addTrace(`USER GESTURE AUDIO UNLOCK FAILED: ${err?.message || err}`);
    }
  }

  public setCallbacks(callbacks: LiveServiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public addTrace(msg: string) {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = { id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, time, text: msg };
    this.diagnosticLogs = [logItem, ...this.diagnosticLogs].slice(0, 50);
    console.info(`[RODEX LIVE TRACE ${time}] ${msg}`);
  }

  public addEventTimeline(category: string, message: string) {
    const timestamp = new Date().toISOString();
    const item = {
      timestamp,
      category,
      message,
      sessionId: this.diag.voiceSessionId,
    };
    this.eventTimeline = [item, ...this.eventTimeline].slice(0, 100);
    console.info(`[RODEX EVENT TIMELINE ${timestamp}] [${category}] ${message}`);
  }

  public getEventTimeline(): Array<{ timestamp: string; category: string; message: string; sessionId?: string }> {
    return this.eventTimeline;
  }

  public getDiagnosticLogs(): Array<{ id: string; time: string; text: string }> {
    return this.diagnosticLogs;
  }

  public getDiagnosticState(): DetailedAudioDiagnostics {
    this.diag.inputAudioContextState =
      this.inputAudioCtx?.state || this.pendingStartupAudioCtx?.state || 'uninitialized';
    this.diag.micInputLevel = this.currentInputLevel;
    this.diag.audioChunksSent = this.audioChunksSent;
    const micTrack = this.mediaStream?.getAudioTracks()[0];
    this.diag.micTrackState = micTrack
      ? `${micTrack.readyState.toUpperCase()}${micTrack.muted ? ' / MUTED' : ''}`
      : 'unavailable';
    if (typeof document !== 'undefined') {
      this.diag.visibilityState = document.visibilityState;
      this.diag.documentHasFocus = document.hasFocus();
    }
    if (this.outputAudioCtx) {
      this.diag.audioContextState = this.outputAudioCtx.state;
      this.diag.audioContextSampleRate = this.outputAudioCtx.sampleRate;
    }
    this.diag.outputSignalLevel = this.currentOutputSignalLevel;
    this.diag.isConversationActive = this.isConversationActive;
    return { ...this.diag };
  }

  public getMetrics(): LiveMetrics {
    return {
      status: this.status,
      isMicLive: this.isMicLive,
      inputActivityDetected: this.inputActivityDetected,
      outputPlaying: this.isSpeaking,
      audioChunksSent: this.audioChunksSent,
      bytesSent: this.bytesSent,
      modelMessagesReceived: this.modelMessagesReceived,
      audioChunksReceived: this.audioChunksReceived,
      inputLevel: this.currentInputLevel,
      outputLevel: this.currentOutputLevel,
      lastError: this.lastError,
    };
  }

  private setStatus(status: LiveSessionStatus) {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  public getStatus(): LiveSessionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getIsMicLive(): boolean {
    return this.isMicLive;
  }

  /**
   * A physical tap on RODEX is itself an intentional wake gesture. Previously the
   * UI only changed to "listening", while this gate stayed false and discarded
   * every model audio packet. Keep activation in the voice engine, not the UI.
   * Returns true only for a newly activated conversation.
   */
  public activateConversationFromGesture(): boolean {
    if (!this.isMicLive || !this.mediaStream?.getAudioTracks().some(track => track.readyState === 'live')) {
      this.addTrace('ROBOT TAP: MICROPHONE NOT READY');
      return false;
    }
    const newlyActive = !this.isConversationActive;
    this.isConversationActive = true;
    this.diag.isConversationActive = true;
    this.stopWakeRecognizer();
    if (this.followUpSilenceTimer) {
      clearTimeout(this.followUpSilenceTimer);
      this.followUpSilenceTimer = null;
    }
    this.diag.orbVoiceState = 'LISTENING';
    this.diag.voiceEngine = 'COMMAND_LISTENING';
    this.addTrace(newlyActive ? 'ROBOT TAP: CONVERSATION GATE OPEN' : 'ROBOT TAP: CONVERSATION ALREADY ACTIVE');
    this.setStatus('listening');
    return newlyActive;
  }

  public async start(): Promise<void> {
    await this.startNormalOrbVoice();
  }

  public hasStoredResponse(): boolean {
    return this.lastCompleteResponseBuffer !== null;
  }

  /**
   * START NORMAL ORB VOICE (Automatic on mount or via Developer Control)
   * Starts exclusive microphone stream and connects upstream Live session.
   */
  public async startNormalOrbVoice(): Promise<void> {
    if (this.engineStarted && this.isMicLive) {
      // Reuse the capture stream but permit a direct user tap to repair a
      // disconnected socket; do not silently return with a dead connection.
      if (!this.isConnected()) await this.connectWebSocketOnly();
      await this.waitForUpstreamReady();
      if (this.inputAudioCtx?.state === 'suspended') {
        void this.inputAudioCtx.resume().catch(() => {});
      }
      this.addTrace('[RODEX ENGINE] EXISTING MICROPHONE STREAM REUSED');
      return;
    }
    if (this.initializationInProgress) {
      console.info('[RODEX ENGINE] INIT_IN_PROGRESS');
      return;
    }

    this.initializationInProgress = true;
    const startupGeneration = ++this.startupGeneration;
    let pendingInputAudioCtx: AudioContext | null = null;
    let pendingMediaStream: MediaStream | null = null;
    const isCurrentStart = () => this.startupGeneration === startupGeneration;
    const releasePendingResources = () => {
      if (pendingMediaStream) {
        pendingMediaStream.getTracks().forEach((track) => track.stop());
        pendingMediaStream = null;
      }
      if (pendingInputAudioCtx) {
        if (this.pendingStartupAudioCtx === pendingInputAudioCtx) {
          this.pendingStartupAudioCtx = null;
        }
        if (pendingInputAudioCtx.state !== 'closed') {
          void pendingInputAudioCtx.close().catch(() => {});
        }
        pendingInputAudioCtx = null;
      }
    };

    this.diag.lastAction = 'VOICE ENGINE STARTED';
    this.diag.lastErrorMessage = null;
    this.addTrace('ORB READY');
    this.addTrace('ORB VOICE ENGINE START');
    this.addTrace('VOICE ENGINE STARTED');
    this.diag.voiceEngine = 'INITIALIZING';
    this.diag.orbVoiceState = 'INITIALIZING';

    try {
      this.addTrace('MIC INITIALIZING');
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      // Keep startup resources local until this attempt is still current. React
      // StrictMode runs effect setup/cleanup/setup in development; without this
      // guard, two pending getUserMedia() calls can overwrite the same singleton.
      // Older Safari/WebView versions can reject a requested sample rate.
      // The capture callback resamples when the actual context rate differs.
      try {
        pendingInputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        pendingInputAudioCtx = new AudioCtx();
      }
      this.pendingStartupAudioCtx = pendingInputAudioCtx;
      this.addTrace(`INPUT AUDIO CONTEXT INITIAL STATE: ${pendingInputAudioCtx.state}`);
      if (pendingInputAudioCtx.state === 'suspended') {
        // Do not await this in the automatic mount path: Chromium may keep resume()
        // pending until a real user gesture, which would prevent mic permission and
        // the local wake recognizer from ever starting.
        void pendingInputAudioCtx.resume()
          .then(() => this.addTrace(`INPUT AUDIO CONTEXT RESUME RESULT: ${pendingInputAudioCtx?.state || 'released'}`))
          .catch((err) => this.addTrace(`INPUT AUDIO CONTEXT RESUME DEFERRED: ${err?.message || err}`));
      }
      if (!isCurrentStart()) {
        releasePendingResources();
        return;
      }

      // Prepare output audio without blocking startup on browser autoplay policy.
      this.getOrCreateOutputAudioGraph();
      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        const outputCtx = this.outputAudioCtx;
        void outputCtx.resume()
          .then(() => this.addTrace(`OUTPUT AUDIO CONTEXT RESUME RESULT: ${outputCtx.state}`))
          .catch((err) => this.addTrace(`OUTPUT AUDIO CONTEXT RESUME DEFERRED: ${err?.message || err}`));
      }

      this.addTrace('MIC PERMISSION REQUESTED');
      pendingMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // A stop/unmount may happen while the browser permission request is pending.
      // Never let an obsolete startup attach its stream to the current engine.
      if (!isCurrentStart()) {
        this.addTrace('STALE STARTUP CANCELLED AFTER MIC PERMISSION');
        releasePendingResources();
        return;
      }

      this.inputAudioCtx = pendingInputAudioCtx;
      if (this.pendingStartupAudioCtx === pendingInputAudioCtx) {
        this.pendingStartupAudioCtx = null;
      }
      pendingInputAudioCtx = null;
      this.mediaStream = pendingMediaStream;
      pendingMediaStream = null;

      this.isMicLive = true;
      this.engineStarted = true;
      this.initializationInProgress = false;

      const audioTrack = this.mediaStream.getAudioTracks()[0];
      this.diag.micStreamId = audioTrack ? audioTrack.id.substring(0, 8) : 'mic-active';
      this.addTrace(`[RODEX AUDIO] SINGLE_STREAM_ACTIVE (Track ID: ${this.diag.micStreamId})`);

      // Establish the Live connection only after this startup owns the microphone.
      this.diag.liveConnection = 'RUNNING';
      this.lastError = null;
      await this.connectWebSocketOnly();
      await this.waitForUpstreamReady();
      if (!isCurrentStart()) {
        this.addTrace('STALE STARTUP CANCELLED AFTER LIVE CONNECTION');
        return;
      }

      this.diag.voiceSessionId = `sess-${Date.now().toString(36)}`;
      this.diag.liveConnection = this.diag.upstreamConnected ? 'PASS' : 'RUNNING';
      this.diag.voiceEngine = 'WAKE_LISTENER_ACTIVE';
      this.diag.orbVoiceState = 'IDLE';
      this.setStatus('idle');
      this.addTrace('CLIENT WEBSOCKET CONNECTED; WAITING FOR LIVE UPSTREAM HANDSHAKE');
      console.info('[RODEX GATE] WAKE_LISTENING_ACTIVE');
      this.addTrace('[RODEX GATE] WAKE_LISTENING_ACTIVE');

      // Start local wake recognizer; live-session transcription remains a fallback.
      this.startWakeRecognizer();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      releasePendingResources();

      // A failed obsolete attempt must not overwrite the state of a newer startup.
      if (!isCurrentStart()) return;

      this.initializationInProgress = false;
      this.engineStarted = false;
      // A connection failure must release the mic/audio graph as well, otherwise
      // a later retry can inherit a live-but-unusable stream.
      this.stop();
      this.diag.lastErrorMessage = `MIC ERROR: ${errMsg}`;
      this.diag.voiceEngine = 'MIC_ERROR';
      this.diag.orbVoiceState = 'ERROR';
      this.diag.liveConnection = 'FAIL';
      this.addTrace(`MIC ERROR: ${errMsg}`);
      this.setStatus('error');
      this.callbacks.onError?.(errMsg);
      throw new Error(errMsg);
    }
  }

  /**
   * PLAY IMMEDIATE CATCH-PHRASE GREETING: "Hello, I'm here and ready to help."
   */
  public async playCatchPhraseGreeting(): Promise<void> {
    this.addTrace('GREETING STARTED');
    this.isGreetingPlaying = true;
    this.isSpeaking = true;
    this.diag.orbVoiceState = 'SPEAKING';
    this.setStatus('greeting');
    this.callbacks.onGreetingStarted?.();

    return new Promise((resolve) => {
      let isDone = false;
      const finishGreeting = () => {
        if (isDone) return;
        isDone = true;
        this.isGreetingPlaying = false;
        this.isSpeaking = false;
        this.addTrace('GREETING ENDED');
        this.addTrace('COMMAND LISTENING');
        this.diag.orbVoiceState = 'LISTENING';
        this.setStatus('listening');
        this.callbacks.onGreetingEnded?.();
        this.startFollowUpSilenceTimer();
        resolve();
      };

      // Synthesize "Hello, I'm here and ready to help."
      rodexSynth.speak("Hello, I'm here and ready to help.", {
        rate: 1.05,
        pitch: 1.0,
        volume: 1.0,
        onStart: () => {
          this.diag.orbVoiceState = 'SPEAKING';
        },
        onEnd: () => {
          finishGreeting();
        },
        onError: () => {
          finishGreeting();
        },
      });

      // Safety fallback timeout in case TTS takes longer than 2.5s
      setTimeout(() => {
        if (!isDone) finishGreeting();
      }, 2500);
    });
  }

  /**
   * Handle Barge-In / Interruption
   */
  private handleBargeIn() {
    this.addTrace('USER BARGE-IN DETECTED: INTERRUPTED SPEAKING -> LISTENING');
    this.stopAllPlayback();
    rodexSynth.stop();
    this.isGreetingPlaying = false;
    this.isSpeaking = false;
    this.diag.orbVoiceState = 'LISTENING';
    this.setStatus('listening');
    this.callbacks.onInterrupted?.();
  }

  /**
   * Follow-Up Silence Timer for Active Conversational Session
   */
  private startFollowUpSilenceTimer() {
    if (this.followUpSilenceTimer) {
      clearTimeout(this.followUpSilenceTimer);
      this.followUpSilenceTimer = null;
    }

    // 9 seconds follow-up window
    this.followUpSilenceTimer = setTimeout(() => {
      if (this.isConversationActive && !this.isSpeaking && this.status === 'listening') {
        this.isConversationActive = false;
        this.diag.isConversationActive = false;
        this.deterministicResponseForTurn = false;
        this.deterministicResponseSpeechActive = false;
        this.deterministicResponseTurnFinished = false;
        this.deterministicResponseSource = null;
        this.diag.orbVoiceState = 'IDLE';
        this.setStatus('idle');
        console.info('[RODEX GATE] RETURNED_TO_WAKE_LISTENING');
        this.addTrace('[RODEX GATE] RETURNED_TO_WAKE_LISTENING');
        console.info('[RODEX GATE] WAKE_LISTENING_ACTIVE');
        this.addTrace('[RODEX GATE] WAKE_LISTENING_ACTIVE');
        this.startWakeRecognizer();
      }
    }, 9000);
  }

  /**
   * Connect WebSocket with exponential backoff, jitter, and event timeline logging
   */
  /**
   * A local WebSocket OPEN is not proof that Gemini accepted the upstream session.
   * Do not activate listening or greet until the server sends "connected".
   */
  private async waitForUpstreamReady(timeoutMs = 12000): Promise<void> {
    const started = Date.now();
    while (!this.diag.upstreamConnected) {
      if (this.explicitShutdown || this.lastError) {
        throw new Error(this.lastError || 'RODEX Live session was closed before becoming ready.');
      }
      if (!this.isConnected()) {
        throw new Error('RODEX voice socket disconnected before Gemini became ready.');
      }
      if (Date.now() - started >= timeoutMs) {
        throw new Error('Gemini voice handshake timed out. Check the server API key, connection and quota.');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    this.addTrace('UPSTREAM VERIFIED: LIVE MICROPHONE STREAM READY');
  }

  private async connectWebSocketOnly(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connectionAttempt) return this.connectionAttempt;
    const attempt = this.openLiveSocket();
    this.connectionAttempt = attempt;
    try {
      await attempt;
    } finally {
      if (this.connectionAttempt === attempt) this.connectionAttempt = null;
    }
  }

  private openLiveSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.explicitShutdown = false;
        this.addEventTimeline('SESSION_CONNECTING', 'Initiating WebSocket connection to /api/live');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/live`;

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          if (this.ws !== ws || this.explicitShutdown) {
            try { ws.close(); } catch (_) {}
            return;
          }
          this.addTrace('CLIENT WEBSOCKET OPEN; WAITING FOR LIVE UPSTREAM');
          this.diag.liveConnection = 'RUNNING';
          this.diag.upstreamConnected = false;
          this.reconnectAttempts = 0;
          this.addEventTimeline('SESSION_CONNECTED', 'WebSocket connection established successfully');
          resolve();
        };

        ws.onmessage = (event) => {
          if (this.ws !== ws || this.explicitShutdown) return;
          try {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (err) {
            console.error('[RODEX Live] Failed parsing server message', err);
          }
        };

        ws.onclose = (event) => {
          if (this.ws !== ws) return;
          this.ws = null;
          this.diag.upstreamConnected = false;
          if (!this.explicitShutdown) this.diag.liveConnection = 'FAIL';
          this.addTrace(`LIVE WS CLOSED (code: ${event.code}, reason: ${event.reason})`);
          this.addEventTimeline('SESSION_DISCONNECTED', `WebSocket closed with code ${event.code}`);

          if (this.explicitShutdown) {
            this.stop();
            return;
          }

          // Keep recovering after transient outages. After the normal retry budget,
          // continue at a capped cooldown instead of stopping the entire voice session.
          const extendedRecovery = this.reconnectAttempts >= this.maxReconnectAttempts;
          this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, this.maxReconnectAttempts);
          const backoffMs = extendedRecovery
            ? 15000
            : Math.min(10000, Math.pow(2, this.reconnectAttempts) * 400 + Math.random() * 300);
          this.addEventTimeline(
            extendedRecovery ? 'SESSION_RECOVERY_CONTINUES' : 'SESSION_RECONNECTING',
            extendedRecovery
              ? `Reconnect retry budget reached; recovery will continue in ${Math.round(backoffMs)}ms`
              : `Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(backoffMs)}ms`
          );

          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.explicitShutdown && this.isMicLive && !this.isConnected()) {
              this.connectWebSocketOnly().then(() => {
                if (this.mediaStream) {
                  this.startMicProcessing();
                }
              }).catch((err) => {
                console.warn('[RODEX Live] Reconnection attempt failed:', err);
              });
            }
          }, backoffMs);
        };

        ws.onerror = (err) => {
          if (this.ws !== ws || this.explicitShutdown) return;
          this.addTrace('LIVE WS ERROR');
          this.diag.liveConnection = 'FAIL';
          this.addEventTimeline('SESSION_ERROR', 'WebSocket error encountered');
          reject(err);
        };
      } catch (e) {
        this.diag.liveConnection = 'FAIL';
        this.addEventTimeline('SESSION_ERROR', `WebSocket connection exception: ${e}`);
        reject(e);
      }
    });
  }

  /**
   * Process microphone audio frames and send to Live API WebSocket
   */
  private startMicProcessing() {
    if (!this.inputAudioCtx || !this.mediaStream || !this.ws) return;

    // A reconnect must replace the previous graph. Otherwise multiple processor
    // callbacks can send duplicate audio frames into the new WebSocket session.
    if (this.audioProcessor) {
      this.audioProcessor.onaudioprocess = null;
      try {
        this.audioProcessor.disconnect();
      } catch (_) {}
      this.audioProcessor = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (_) {}
      this.micSource = null;
    }

    this.micSource = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    // 512 samples at 16 kHz is a 32 ms audio frame, reducing buffering delay.
    // The previous 4096-sample frame buffered about 256 ms before each send.
    this.audioProcessor = this.inputAudioCtx.createScriptProcessor(512, 1, 1);

    this.addTrace('PCM AUDIO STREAM STARTED (16kHz 16-bit Little-Endian)');

    this.audioProcessor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN || !this.diag.upstreamConnected) return;

      const rawAudio = e.inputBuffer.getChannelData(0);
      const inputChannelData = this.resampleTo16k(rawAudio, e.inputBuffer.sampleRate);

      let sum = 0;
      for (let i = 0; i < inputChannelData.length; i++) {
        sum += inputChannelData[i] * inputChannelData[i];
      }
      const rms = Math.sqrt(sum / inputChannelData.length);
      this.currentInputLevel = Math.min(1, rms * 4.5);

      // Real-Time Audio Activity Detection
      if (rms > 0.038) {
        if (!this.inputActivityDetected) {
          this.inputActivityDetected = true;
          this.addTrace('AUDIO INPUT DETECTED');
          if (this.status === 'idle' || this.status === 'wake_listening') {
            this.diag.orbVoiceState = 'INPUT_DETECTED';
            this.setStatus('input_detected');
          }
        }

        // Barge-in detection while RODEX is speaking
        if (this.isSpeaking || this.isGreetingPlaying) {
          this.consecutiveBargeInFrames++;
          if (this.consecutiveBargeInFrames >= 2) {
            this.handleBargeIn();
            this.consecutiveBargeInFrames = 0;
          }
        }
      } else {
        if (this.inputActivityDetected) {
          this.inputActivityDetected = false;
          if (this.status === 'input_detected') {
            this.diag.orbVoiceState = 'WAKE_LISTENING';
            this.setStatus('idle');
          }
        }
        this.consecutiveBargeInFrames = 0;
      }

      // Stream microphone PCM audio frames to real-time speech engine whenever not actively speaking
      if (!this.isSpeaking && !this.isGreetingPlaying) {
        const pcm16Buffer = this.float32ToPcm16(inputChannelData);
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        const wallClockNowMs = Date.now();
        const includeClockContext = wallClockNowMs - this.lastClockContextSentAt >= 1000;
        const clockContext = includeClockContext
          ? {
              clientTimeIso: new Date(wallClockNowMs).toISOString(),
              clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala',
            }
          : {};
        if (includeClockContext) this.lastClockContextSentAt = wallClockNowMs;

        this.ws.send(
          JSON.stringify({
            audio: base64Audio,
            mimeType: 'audio/pcm;rate=16000',
            ...clockContext,
          })
        );

        this.audioChunksSent++;
        this.bytesSent += pcm16Buffer.byteLength;

        if (this.audioChunksSent === 1 || this.audioChunksSent % 35 === 0) {
          this.addTrace(`AUDIO CHUNK SENT (#${this.audioChunksSent}, ${this.bytesSent} bytes)`);
        }
      }
    };

    this.micSource.connect(this.audioProcessor);
    this.audioProcessor.connect(this.inputAudioCtx.destination);
    // A suspended input graph makes the robot appear to listen without sending
    // a single PCM frame. Surface the exact state in diagnostics and retry.
    if (this.inputAudioCtx.state !== 'running') {
      const inputCtx = this.inputAudioCtx;
      void inputCtx.resume().then(() => {
        this.addTrace('MICROPHONE AUDIO CONTEXT: ' + inputCtx.state.toUpperCase());
      }).catch((err: any) => {
        this.diag.lastErrorMessage = 'Microphone audio blocked: ' + (err?.message || String(err));
        this.addTrace(this.diag.lastErrorMessage);
      });
    }
    // A WebSocket handshake may finish AFTER a user taps the robot.
    // Never reset a real active conversation back to idle on connection.
    this.diag.orbVoiceState = this.isConversationActive ? 'LISTENING' : 'IDLE';
    this.diag.voiceEngine = this.isConversationActive ? 'COMMAND_LISTENING' : 'WAKE_LISTENER_ACTIVE';
    this.setStatus(this.isConversationActive ? 'listening' : 'idle');
  }

  /**
   * Handle incoming WebSocket messages from the Gemini Live server
   */
  private async handleServerMessage(data: any) {
    if (!data || !data.type) return;

    this.modelMessagesReceived++;
    this.diag.serverResponse = 'PASS';

    switch (data.type) {
      case 'setup_complete':
        this.addTrace('SETUP COMPLETE');
        break;

      case 'connected':
        this.diag.liveConnection = 'PASS';
        this.diag.upstreamConnected = true;
        this.diag.lastErrorMessage = null;
        this.addTrace(`LIVE UPSTREAM READY: model=${data.model || 'gemini-3.8-live'}`);
        if (this.mediaStream) {
          this.startMicProcessing();
        }
        this.startAudioLevelLoop();
        break;

      case 'model_turn':
        if (!this.isConversationActive && !this.diagnosticTextTestActive) {
          // Hard Wake Gate: Discard unsolicited model turns when no wake phrase has been confirmed
          return;
        }
        this.addTrace('MODEL RESPONSE RECEIVED');
        break;

      case 'fallback':
      case 'error': {
        const errorMsg = data.error || data.message || 'Gemini Live server error';
        this.diag.liveConnection = 'FAIL';
        this.diag.upstreamConnected = false;
        this.diag.voiceEngine = 'LIVE_UPSTREAM_ERROR';
        this.lastError = errorMsg;
        // Misconfiguration/quotas require an operator action, not infinite
        // automatic reconnect loops that keep reopening a doomed WebSocket.
        if (/api key.*(?:unconfigured|invalid)|quota|billing|permission denied|unauthenticated/i.test(errorMsg)) {
          this.explicitShutdown = true;
          if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
        }
        this.addTrace(`LIVE VOICE ERROR: ${errorMsg}`);
        this.diag.lastErrorMessage = errorMsg;
        this.callbacks.onError?.(errorMsg);
        break;
      }

      case 'audio':
        if (this.deterministicResponseForTurn) {
          // A deterministic response is already speaking the exact tool result.
          return;
        }
        if (!this.isConversationActive && !this.diagnosticTextTestActive) {
          // Hard Wake Gate: discard unsolicited audio except the explicit diagnostic text test.
          return;
        }
        if (data.audio) {
          this.audioChunksReceived++;
          this.addTrace('OUTPUT AUDIO RECEIVED');
          this.diag.audioDataReceived = 'PASS';

          const binary = atob(data.audio);
          const chunkBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            chunkBytes[i] = binary.charCodeAt(i);
          }
          this.turnPcmChunks.push(chunkBytes);
          this.diag.audioBytes += chunkBytes.byteLength;

          if (this.mediaStream) {
            await this.processAndScheduleStreamingChunk(chunkBytes, data.mimeType);
          }
        } else {
          this.diag.audioDataReceived = 'FAIL';
        }
        break;

      case 'output_transcript':
        if (this.deterministicResponseForTurn) {
          // Do not overwrite the exact time with a model paraphrase.
          return;
        }
        if (!this.isConversationActive && !this.diagnosticTextTestActive) {
          // Hard Wake Gate: discard unsolicited text except the explicit diagnostic text test.
          return;
        }
        if (data.text) {
          // Live audio transcription often arrives in fragments. Retain a
          // readable fallback only if Gemini fails to deliver PCM this turn.
          const fragment = String(data.text);
          this.pendingSpokenTranscript = fragment.startsWith(this.pendingSpokenTranscript)
            ? fragment
            : this.pendingSpokenTranscript.endsWith(fragment)
              ? this.pendingSpokenTranscript
              : this.pendingSpokenTranscript + fragment;
          this.addTrace(`MODEL RESPONSE: "${data.text.substring(0, 60)}"`);
          this.diag.orbVoiceState = 'SPEAKING';
          this.diag.voiceEngine = 'SPEAKING';
          this.callbacks.onOutputTranscript?.(data.text);
        }
        break;

      case 'deterministic_response':
        if (!this.isConversationActive || typeof data.text !== 'string' || !data.text.trim()) {
          return;
        }
        if (this.deterministicResponseForTurn) {
          this.addTrace('[RODEX TIME] Ignored duplicate server clock answer');
          return;
        }
        this.speakDeterministicResponse(data.text, data.clockSource || 'server_clock');
        break;

      case 'input_transcript':
        if (data.text) {
          // This transcript comes from audio already delivered to Gemini Live.
          // Use it for the UI/gating state, but do not send the same utterance
          // back as a second text turn.
          this.handleInputTranscript(data.text, 'live_transcription');
        }
        break;

      case 'interrupted':
        this.handleBargeIn();
        break;

      case 'turn_complete':
        if (!this.isConversationActive && !this.diagnosticTextTestActive) {
          // Ignore model turn endings generated by background speech while the
          // application-level wake gate is closed. They must not move the orb
          // into an active listening state or start a follow-up timer.
          this.addTrace('[RODEX GATE] UNSOLICITED_TURN_COMPLETE_IGNORED');
          this.turnPcmChunks = [];
          return;
        }
        if (this.deterministicResponseForTurn) {
          this.addTrace('DETERMINISTIC RESPONSE TURN COMPLETE');
          this.turnPcmChunks = [];
          this.deterministicResponseTurnFinished = true;
          // Keep speech/status active until the browser TTS finishes; if TTS
          // already finished, finish the turn here instead.
          if (this.deterministicResponseSpeechActive) return;
          this.deterministicResponseForTurn = false;
          this.deterministicResponseTurnFinished = false;
          this.deterministicResponseSource = null;
        }
        this.addTrace('OUTPUT COMPLETE');
        if (!this.mediaStream && this.turnPcmChunks.length > 0) {
          await this.playConcatenatedCompleteResponse();
        }
        if (this.diagnosticTextTestActive && !this.isConversationActive) {
          this.diagnosticTextTestActive = false;
          if (this.diagnosticTextTestTimer) {
            clearTimeout(this.diagnosticTextTestTimer);
            this.diagnosticTextTestTimer = null;
          }
          this.turnPcmChunks = [];
          this.diag.orbVoiceState = 'IDLE';
          this.diag.voiceEngine = this.isMicLive ? 'WAKE_LISTENER_ACTIVE' : 'STOPPED';
          this.setStatus(this.isMicLive ? 'idle' : 'connected');
          this.addTrace('DIAGNOSTIC TEXT TEST COMPLETE; WAKE GATE REMAINS CLOSED');
          break;
        }
        // The primary path is true streaming PCM; only use local TTS if a
        // completed model turn supplied speech text but literally zero audio.
        // This avoids a silent robot without speaking twice over real audio.
        const receivedPcm = this.turnPcmChunks.length > 0;
        const speechFallbackText = this.pendingSpokenTranscript.trim();
        this.turnPcmChunks = [];
        this.pendingSpokenTranscript = '';
        if (!receivedPcm && speechFallbackText) {
          this.addTrace('NO LIVE PCM RECEIVED: USING BROWSER SPEECH FALLBACK');
          this.isSpeaking = true;
          this.diag.orbVoiceState = 'SPEAKING';
          this.setStatus('speaking');
          const finishFallback = () => {
            this.isSpeaking = false;
            this.diag.orbVoiceState = 'LISTENING';
            this.setStatus('listening');
            this.startFollowUpSilenceTimer();
            this.callbacks.onTurnComplete?.();
          };
          rodexSynth.speak(speechFallbackText, {
            rate: 1.05,
            pitch: 1,
            volume: 1,
            onEnd: finishFallback,
            onError: (err) => {
              this.addTrace(`BROWSER SPEECH FALLBACK ERROR: ${String(err)}`);
              finishFallback();
            },
          });
          break;
        }

        // Wait until queued PCM is actually played before considering the
        // utterance finished; model turn completion is not speaker completion.
        if (this.activeSources.length > 0) {
          this.pendingTurnCompletionAfterPlayback = true;
          this.addTrace('MODEL FINISHED; DRAINING AUDIO PLAYBACK');
          break;
        }
        this.diag.orbVoiceState = 'LISTENING';
        this.setStatus('listening');
        this.startFollowUpSilenceTimer();
        this.callbacks.onTurnComplete?.();
        break;

      case 'browser_action':
        if (data.action?.url && this.isConversationActive) {
          this.addTrace(`BROWSER ACTION REQUESTED: ${data.action.label || data.action.url}`);
          this.callbacks.onBrowserAction?.({
            url: data.action.url,
            label: data.action.label,
            destinationType: data.action.destinationType,
          });
        }
        break;

      case 'tool_error':
        this.addTrace(`LIVE TOOL ERROR: ${data.message || 'Tool execution failed'}`);
        this.diag.lastErrorMessage = data.message || 'Live tool execution failed';
        break;

      case 'grounding':
        if (data.metadata) {
          this.callbacks.onGrounding?.(data.metadata);
        }
        break;

      case 'session_closed':
        this.addTrace('LIVE SESSION CLOSED');
        this.stop();
        break;
    }
  }

  /**
   * Lightweight Local Wake Word Recognizer for WAKE_LISTENING Mode
   */
  private startWakeRecognizer() {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      this.diag.wakeRecognizerState = 'UNAVAILABLE';
      this.addTrace('LOCAL WAKE RECOGNIZER UNSUPPORTED; LIVE TRANSCRIPTION FALLBACK ACTIVE');
      console.warn('[RODEX WAKE RECOGNIZER] Web Speech Recognition is unavailable; live-session transcription will handle wake phrases.');
      return;
    }

    if (this.wakeRecognizer) {
      const previousRecognizer = this.wakeRecognizer;
      this.wakeRecognizer = null;
      try { previousRecognizer.abort(); } catch (_) {}
    }

    try {
      this.diag.wakeRecognizerState = 'STARTING';
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        if (this.wakeRecognizer !== rec) return;
        this.diag.wakeRecognizerState = 'LISTENING';
        this.addTrace('LOCAL WAKE RECOGNIZER STARTED');
      };

      rec.onresult = (e: any) => {
        // Ignore callbacks from recognizers that have already been replaced or stopped.
        if (this.wakeRecognizer !== rec || this.isConversationActive) return;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (transcript && transcript.trim().length > 0) {
                  this.diag.lastRecognizedTranscript = transcript.trim();
            this.addTrace(`LOCAL WAKE TRANSCRIPT: "${transcript.trim().substring(0, 100)}"`);
            this.handleInputTranscript(transcript, 'wake_recognizer');
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        const detail = String(e.error || 'unknown error');
        this.addTrace(`LOCAL WAKE RECOGNIZER ERROR: ${detail}`);
        this.diag.lastErrorMessage = `Wake recognition: ${detail}`;
        console.warn('[RODEX WAKE RECOGNIZER] Error:', detail);
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(detail)) {
          // These are normally non-recoverable until browser/site permissions or
          // speech services change; don't endlessly restart and hide the real cause.
          this.diag.wakeRecognizerState = `ERROR: ${detail}`;
          if (this.wakeRecognizer === rec) this.wakeRecognizer = null;
          try { rec.stop(); } catch (_) {}
        }
      };

      rec.onend = () => {
        if (this.wakeRecognizer !== rec) return;
        if (!this.isConversationActive && this.isMicLive) {
          this.diag.wakeRecognizerState = 'RESTARTING';
          setTimeout(() => {
            // Do not resurrect an old recognizer after a reset or wake-word match.
            if (this.wakeRecognizer !== rec || this.isConversationActive || !this.isMicLive) return;
            try {
              rec.start();
            } catch (err: any) {
              const detail = err?.message || String(err);
              this.diag.wakeRecognizerState = `ERROR: restart failed`;
              this.diag.lastErrorMessage = `Wake recognition restart failed: ${detail}`;
              this.addTrace(`LOCAL WAKE RESTART FAILED: ${detail}`);
              console.warn('[RODEX WAKE RECOGNIZER] Restart attempt failed:', detail);
            }
          }, 350);
        }
      };

      this.wakeRecognizer = rec;
      rec.start();
      console.info('[RODEX GATE] WAKE_LISTENING');
      this.addTrace('[RODEX GATE] WAKE_LISTENING');
    } catch (err: any) {
      const detail = err?.message || String(err);
      this.diag.wakeRecognizerState = 'ERROR: start failed';
      this.addTrace(`LOCAL WAKE RECOGNIZER START FAILED: ${detail}`);
      this.diag.lastErrorMessage = `Wake recognition: ${detail}`;
      console.warn('[RODEX WAKE RECOGNIZER] Failed initializing local wake recognizer:', detail);
    }
  }

  private stopWakeRecognizer() {
    if (this.wakeRecognizer) {
      try {
        this.wakeRecognizer.stop();
      } catch (_) {}
      this.wakeRecognizer = null;
    }
  }

  /** Return a browser-clock answer only for direct "current time" questions. */
  private buildDirectTimeAnswer(userText: string): string | null {
    const lower = userText
      .toLowerCase()
      .replace(/\b(?:hey|hello|hi)\s+rodex\b/g, ' ')
      .trim();
    if (!/\b(what time is it|what(?:'s| is) the time|current time|tell me the time|what time)\b/i.test(lower)) {
      return null;
    }

    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala';
    const aliases: Array<{ pattern: RegExp; zone: string }> = [
      { pattern: /\b(uganda|kampala|east africa|eastern africa|eat)\b/i, zone: 'Africa/Kampala' },
      { pattern: /\b(kenya|nairobi)\b/i, zone: 'Africa/Nairobi' },
      { pattern: /\b(rwanda|kigali)\b/i, zone: 'Africa/Kigali' },
      { pattern: /\b(tanzania|dar es salaam)\b/i, zone: 'Africa/Dar_es_Salaam' },
      { pattern: /\b(ethiopia|addis ababa)\b/i, zone: 'Africa/Addis_Ababa' },
      { pattern: /\b(uk|united kingdom|london)\b/i, zone: 'Europe/London' },
      { pattern: /\b(utc|gmt|greenwich)\b/i, zone: 'UTC' },
      { pattern: /\b(india|delhi|mumbai)\b/i, zone: 'Asia/Kolkata' },
      { pattern: /\b(japan|tokyo)\b/i, zone: 'Asia/Tokyo' },
      { pattern: /\b(china|beijing|shanghai)\b/i, zone: 'Asia/Shanghai' },
      { pattern: /\b(dubai|uae)\b/i, zone: 'Asia/Dubai' },
      { pattern: /\b(new york|nyc)\b/i, zone: 'America/New_York' },
      { pattern: /\b(los angeles)\b/i, zone: 'America/Los_Angeles' },
      { pattern: /\b(chicago)\b/i, zone: 'America/Chicago' },
      { pattern: /\b(toronto)\b/i, zone: 'America/Toronto' },
      { pattern: /\b(sydney)\b/i, zone: 'Australia/Sydney' },
    ];

    let timeZone = localZone;
    for (const alias of aliases) {
      if (alias.pattern.test(lower)) {
        timeZone = alias.zone;
        break;
      }
    }

    // Also support explicit IANA names such as "Europe/Paris".
    const ianaZone = lower.match(/\b(?:in|for)\s+([a-z]+_[a-z]+\/[a-z0-9_+.-]+(?:\/[a-z0-9_+.-]+)*)\b/i)
      || lower.match(/\b(?:in|for)\s+([a-z]+\/[a-z0-9_+.-]+(?:\/[a-z0-9_+.-]+)*)\b/i);
    if (ianaZone?.[1]) timeZone = ianaZone[1];

    const now = new Date();
    try {
      const timeOnly = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(now);
      const location = timeZone === 'Africa/Kampala'
        ? 'Uganda'
        : (timeZone.split('/').pop() || timeZone).replace(/_/g, ' ');
      return `The time in ${location} is ${timeOnly}.`;
    } catch {
      const timeOnly = new Intl.DateTimeFormat('en-US', {
        timeZone: localZone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(now);
      return `The current local time is ${timeOnly}.`;
    }
  }

  /** Speak an exact tool/browser result and suppress model paraphrasing for the turn. */
  private speakDeterministicResponse(text: string, source: string): void {
    if (!this.isConversationActive) return;
    if (this.deterministicResponseForTurn) {
      // The browser clock is the most direct source for a spoken current-time
      // question, so let it replace a server/model clock result if it arrives later.
      if (source !== 'browser_clock' || this.deterministicResponseSource === 'browser_clock') return;
      this.addTrace('[RODEX TIME] Replacing server clock speech with browser clock');
      // Clear the old guard before cancelling existing speech so its onEnd handler
      // cannot mutate the state of the replacement response.
      this.deterministicResponseForTurn = false;
      this.deterministicResponseSpeechActive = false;
      this.deterministicResponseTurnFinished = false;
      this.deterministicResponseSource = null;
    }

    const responseRunId = ++this.deterministicResponseRunId;
    this.stopAllPlayback();
    rodexSynth.stop();
    if (this.followUpSilenceTimer) {
      clearTimeout(this.followUpSilenceTimer);
      this.followUpSilenceTimer = null;
    }

    this.deterministicResponseForTurn = true;
    this.deterministicResponseSpeechActive = true;
    this.deterministicResponseTurnFinished = false;
    this.deterministicResponseSource = source;
    this.turnPcmChunks = [];
    this.isGreetingPlaying = false;
    this.isSpeaking = true;
    this.diag.orbVoiceState = 'SPEAKING';
    this.diag.voiceEngine = 'SPEAKING';
    this.addTrace(`DETERMINISTIC RESPONSE: "${text.substring(0, 80)}" (clock source: ${source})`);
    this.callbacks.onOutputTranscript?.(text);
    this.setStatus('speaking');

    rodexSynth.speak(text, {
      rate: 1.05,
      pitch: 1.0,
      volume: 1.0,
      onStart: () => {
        this.diag.orbVoiceState = 'SPEAKING';
        this.setStatus('speaking');
      },
      onEnd: () => {
        // Cancellation of a replaced utterance must not change the new utterance's state.
        if (responseRunId !== this.deterministicResponseRunId) return;
        this.deterministicResponseSpeechActive = false;
        this.isSpeaking = false;
        if (this.deterministicResponseTurnFinished) {
          this.deterministicResponseForTurn = false;
          this.deterministicResponseTurnFinished = false;
          this.deterministicResponseSource = null;
          this.diag.orbVoiceState = 'LISTENING';
          this.setStatus('listening');
          this.startFollowUpSilenceTimer();
          this.callbacks.onTurnComplete?.();
        } else {
          // If a turn-complete event is delayed, do not leave the orb stuck in SPEAKING.
          this.diag.orbVoiceState = 'LISTENING';
          this.setStatus('listening');
          this.startFollowUpSilenceTimer();
        }
      },
    });
  }

  /**
   * Process Real-Time Input Transcript with HARD Application-Level Wake Gate
   */
  private async handleInputTranscript(
    userText: string,
    source: 'wake_recognizer' | 'live_transcription' = 'live_transcription'
  ) {
    this.diag.lastRecognizedTranscript = userText.trim() || 'EMPTY TRANSCRIPT';
    this.callbacks.onInputTranscript?.(userText);

    // 1. If an active conversational turn is already underway, capture user command directly
    if (this.isConversationActive) {
      if (this.deterministicResponseForTurn && !this.deterministicResponseSpeechActive && !this.deterministicResponseTurnFinished) {
        // Recover if the model failed to send turn_complete for a previous deterministic answer.
        this.addTrace('[RODEX TIME] Cleared stale deterministic-response guard on new input');
        this.deterministicResponseForTurn = false;
      }
      if (source === 'live_transcription') {
        const directTimeAnswer = this.buildDirectTimeAnswer(userText);
        if (directTimeAnswer) {
          this.diag.lastCommand = userText;
          this.addTrace('[RODEX TIME] BROWSER CLOCK FAST PATH');
          this.speakDeterministicResponse(directTimeAnswer, 'browser_clock');
          return;
        }
      }
      if (this.followUpSilenceTimer) {
        clearTimeout(this.followUpSilenceTimer);
        this.followUpSilenceTimer = null;
      }
      this.diag.lastCommand = userText;
      console.info('[RODEX TURN] COMMAND_STARTED:', userText);
      this.addTrace(`[RODEX TURN] COMMAND_STARTED: "${userText}"`);
      this.addTrace('ORB COMMAND RECEIVED');
      this.addTrace('LIVE REQUEST SENT');
      this.diag.orbVoiceState = 'THINKING';
      this.setStatus('thinking');
      if (source === 'wake_recognizer' && this.ws && this.ws.readyState === WebSocket.OPEN) {
        // A local recognizer can race with the live transcription, but only it
        // needs the text fallback. Gemini Live already received live_transcription audio.
        this.ws.send(JSON.stringify({ text: userText }));
      } else {
        this.addTrace('[RODEX TURN] AUDIO_ALREADY_SENT; transcript is UI-only');
      }
      return;
    }

    // 2. System is in WAKE_LISTENING mode. Evaluate transcript against HARD wake gate
    console.info('[RODEX GATE] WAKE_AUDIO_RECEIVED');
    this.addTrace('[RODEX GATE] WAKE_AUDIO_RECEIVED');
    console.info(`[RODEX GATE] WAKE_TRANSCRIPT: "${userText}"`);
    this.addTrace(`[RODEX GATE] WAKE_TRANSCRIPT: "${userText}"`);

    const match = matchWakePhrase(userText);

    if (match.matched && match.phrase) {
      console.info('[RODEX GATE] WAKE_MATCH: TRUE');
      this.addTrace('[RODEX GATE] WAKE_MATCH: TRUE');
      console.info('[RODEX GATE] WAKE_DETECTED');
      this.addTrace('[RODEX GATE] WAKE_DETECTED');
      console.info('[RODEX GATE] COMMAND_LISTENING');
      this.addTrace('[RODEX GATE] COMMAND_LISTENING');

      this.diag.wakeMatch = true;
      this.diag.lastWakeTranscript = userText;
      this.diag.wakeRecognizerState = 'WAKE DETECTED';
      this.diag.orbVoiceState = 'WAKE_DETECTED';
      this.setStatus('wake_detected');
      this.callbacks.onWakeDetected?.(userText);

      // Enter active conversational session
      this.isConversationActive = true;
      this.diag.isConversationActive = true;

      // Stop local wake recognizer so it doesn't run during active command turn
      this.stopWakeRecognizer();

      // RULE 3 FIX: If command text follows wake phrase (e.g. "Hello Rodex, what is the weather?")
      // Extract command, DO NOT play separate generic greeting, send command as single turn!
      if (match.command && match.command.trim().length > 0) {
        console.info('[RODEX GATE] COMMAND_ACCEPTED:', match.command);
        this.addTrace(`[RODEX GATE] COMMAND_ACCEPTED: "${match.command}"`);
        this.diag.lastCommand = match.command;
        const directTimeAnswer = this.buildDirectTimeAnswer(match.command);
        if (directTimeAnswer) {
          this.addTrace('[RODEX TIME] BROWSER CLOCK FAST PATH');
          this.speakDeterministicResponse(directTimeAnswer, 'browser_clock');
          return;
        }
        this.diag.orbVoiceState = 'THINKING';
        this.setStatus('thinking');
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ text: match.command }));
        }
      } else {
        // Bare wake phrase ("Hello Rodex") -> play single short local greeting
        await this.playCatchPhraseGreeting();
      }
    } else {
      console.info('[RODEX GATE] WAKE_MATCH: FALSE');
      this.addTrace('[RODEX GATE] WAKE_MATCH: FALSE');
      console.info('[RODEX GATE] NON_WAKE_SPEECH_IGNORED');
      this.addTrace('[RODEX GATE] NON_WAKE_SPEECH_IGNORED');
    }
  }

  /**
   * Process and schedule streaming chunks for real-time live mic turns
   */
  private async processAndScheduleStreamingChunk(chunkBytes: Uint8Array, mimeType?: string) {
    const rawMime = mimeType || 'audio/pcm;rate=24000';
    const rateMatch = rawMime.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const int16 = new Int16Array(chunkBytes.buffer);
    const sampleCount = int16.length;
    this.diag.sampleCount += sampleCount;

    const { ctx, gain } = this.getOrCreateOutputAudioGraph();
    const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = int16[i] / 32768.0;
      channelData[i] = s;
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
      sumSquares += s * s;
    }
    const rms = Math.sqrt(sumSquares / (sampleCount || 1));
    this.diag.peakLevel = Math.max(this.diag.peakLevel, peak);
    this.diag.rmsLevel = Math.max(this.diag.rmsLevel, rms);

    if (rms > 0.001 || this.diag.rmsLevel > 0.001) {
      this.diag.audioDataValid = 'PASS';
    }

    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch (err: any) {
        this.addTrace(`OUTPUT AUDIO UNLOCK FAILED: ${err?.message || err}`);
      }
      if ((ctx.state as AudioContextState) !== 'running') {
        this.diag.playbackStarted = 'FAIL';
        this.diag.lastErrorMessage = 'Audio playback is blocked. Tap RODEX to enable sound.';
        this.callbacks.onError?.(this.diag.lastErrorMessage);
        return;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);

    const startTime = Math.max(this.nextPlaybackTime, ctx.currentTime);
    source.start(startTime);
    this.nextPlaybackTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.diag.orbVoiceState = 'SPEAKING';
      this.diag.voiceEngine = 'SPEAKING';
      this.setStatus('speaking');
      this.diag.playbackStarted = 'PASS';
      this.addTrace('OUTPUT PLAYING');
    }

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.isSpeaking = false;
        this.diag.playbackEnded = 'PASS';
        // A completed Web Audio source is not proof the physical speaker was
        // audible; leave verification to the user-facing speaker test.
        if (this.status === 'speaking') {
          this.diag.orbVoiceState = 'LISTENING';
          this.setStatus('listening');
        }
        if (this.pendingTurnCompletionAfterPlayback) {
          this.pendingTurnCompletionAfterPlayback = false;
          this.startFollowUpSilenceTimer();
          this.callbacks.onTurnComplete?.();
        }
      }
    };
  }

  /**
   * Continuous animation loop to measure and report input/output audio volume
   */
  private startAudioLevelLoop() {
    const updateLevels = () => {
      if (!this.outputAnalyser) return;

      const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
      this.outputAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length || 1);
      this.currentOutputLevel = this.isSpeaking ? Math.min(1, avg / 128) : 0;

      this.callbacks.onAudioLevel?.(this.currentInputLevel, this.currentOutputLevel);

      this.levelAnimFrame = requestAnimationFrame(updateLevels);
    };

    this.levelAnimFrame = requestAnimationFrame(updateLevels);
  }

  /**
   * Stop all active and scheduled audio buffer sources
   */
  public stopAllPlayback() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    this.nextPlaybackTime = 0;
    this.pendingTurnCompletionAfterPlayback = false;
    this.pendingSpokenTranscript = '';
    this.turnPcmChunks = [];
    this.isSpeaking = false;
    this.currentOutputLevel = 0;
  }

  /**
   * Diagnostic Tests (Preserved Reference Implementation)
   */
  public async testSpeaker(): Promise<boolean> {
    this.diag.lastAction = 'TEST SPEAKER CLICKED';
    this.diag.speakerTest = 'RUNNING';
    this.addTrace('TEST SPEAKER CLICKED');
    try {
      await this.unlockOutputAudio();
      const { ctx } = this.getOrCreateOutputAudioGraph();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      return new Promise<boolean>((resolve) => {
        osc.onended = () => {
          this.diag.speakerTest = 'PASS';
          this.addTrace('SPEAKER TEST END');
          resolve(true);
        };
      });
    } catch (err: any) {
      this.diag.speakerTest = 'FAIL';
      return false;
    }
  }

  public async testGeneratedAudio(): Promise<boolean> {
    this.diag.lastAction = 'TEST GENERATED AUDIO CLICKED';
    this.diag.generatedAudioTest = 'RUNNING';
    this.addTrace('TEST GENERATED AUDIO CLICKED');
    try {
      await this.unlockOutputAudio();
      const { ctx, gain, analyser } = this.getOrCreateOutputAudioGraph();
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      env.gain.setValueAtTime(0.001, ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
      osc.connect(env);
      env.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      return new Promise<boolean>((resolve) => {
        osc.onended = () => {
          this.diag.generatedAudioTest = 'PASS';
          this.addTrace('GENERATED AUDIO END');
          resolve(true);
        };
      });
    } catch (err: any) {
      this.diag.generatedAudioTest = 'FAIL';
      return false;
    }
  }

  public async testLiveTextResponse(textToSend: string = 'Say exactly: RODEX AUDIO TEST'): Promise<void> {
    this.diag.lastAction = 'TEST LIVE TEXT RESPONSE CLICKED';
    this.diag.textRequest = 'RUNNING';
    this.addTrace('TEST LIVE TEXT RESPONSE CLICKED');
    await this.unlockOutputAudio();
    if (!this.isConnected()) {
      await this.connectWebSocketOnly();
    }
    const upstreamWaitStart = Date.now();
    while (
      !this.diag.upstreamConnected &&
      this.isConnected() &&
      Date.now() - upstreamWaitStart < 8000
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    if (!this.diag.upstreamConnected) {
      this.diag.textRequest = 'FAIL';
      this.addTrace('DIAGNOSTIC TEXT TEST BLOCKED: LIVE UPSTREAM SESSION IS NOT READY');
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.diagnosticTextTestActive = true;
      if (this.diagnosticTextTestTimer) clearTimeout(this.diagnosticTextTestTimer);
      this.diagnosticTextTestTimer = setTimeout(() => {
        if (!this.diagnosticTextTestActive) return;
        this.diagnosticTextTestActive = false;
        this.diagnosticTextTestTimer = null;
        this.turnPcmChunks = [];
        this.diag.textRequest = 'FAIL';
        this.addTrace('DIAGNOSTIC TEXT TEST TIMED OUT WITHOUT A COMPLETE LIVE RESPONSE');
        if (!this.isConversationActive) {
          this.diag.orbVoiceState = 'IDLE';
          this.setStatus(this.isMicLive ? 'idle' : 'connected');
        }
      }, 15000);
      this.addTrace(`SENDING DIAGNOSTIC TEXT (15s response window): "${textToSend}"`);
      this.ws.send(JSON.stringify({ text: textToSend }));
      this.diag.textRequest = 'PASS';
      this.setStatus('thinking');
    } else {
      this.diag.textRequest = 'FAIL';
      this.addTrace('DIAGNOSTIC TEXT TEST FAILED: CLIENT WEBSOCKET NOT OPEN');
    }
  }

  public async playLastResponseAgain(): Promise<void> {
    this.diag.lastAction = 'PLAY LAST RESPONSE AGAIN CLICKED';
    this.addTrace('PLAY LAST RESPONSE AGAIN CLICKED');
    if (!this.lastCompleteResponseBuffer) {
      this.addTrace('NO STORED RESPONSE AUDIO');
      return;
    }
    await this.unlockOutputAudio();
    await this.playAudioBuffer(this.lastCompleteResponseBuffer, true);
  }

  private async playConcatenatedCompleteResponse(): Promise<void> {
    const totalBytes = this.turnPcmChunks.reduce((acc, c) => acc + c.byteLength, 0);
    if (totalBytes === 0) return;
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of this.turnPcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const int16 = new Int16Array(merged.buffer);
    const { ctx } = this.getOrCreateOutputAudioGraph();
    const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      channelData[i] = int16[i] / 32768.0;
    }
    this.lastCompleteResponseBuffer = audioBuffer;
    await this.playAudioBuffer(audioBuffer, false);
  }

  private async playAudioBuffer(audioBuffer: AudioBuffer, isReplay: boolean): Promise<void> {
    const { ctx, gain, analyser } = this.getOrCreateOutputAudioGraph();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);
    this.isSpeaking = true;
    this.diag.orbVoiceState = 'SPEAKING';
    this.setStatus('speaking');
    this.addTrace('OUTPUT PLAYING');
    source.start();
    source.onended = () => {
      this.isSpeaking = false;
      this.diag.orbVoiceState = 'LISTENING';
      this.addTrace('OUTPUT COMPLETE');
      this.setStatus('listening');
    };
  }

  /** Convert browser device rates (44.1/48 kHz) to Gemini's 16 kHz PCM. */
  private resampleTo16k(samples: Float32Array, inputRate: number): Float32Array {
    if (inputRate === 16000 || !Number.isFinite(inputRate) || inputRate <= 0) return samples;
    const ratio = inputRate / 16000;
    const count = Math.max(1, Math.round(samples.length / ratio));
    const output = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const start = i * ratio;
      const lower = Math.min(samples.length - 1, Math.floor(start));
      const upper = Math.min(samples.length - 1, lower + 1);
      const fraction = start - lower;
      output[i] = samples[lower] * (1 - fraction) + samples[upper] * fraction;
    }
    return output;
  }

  private float32ToPcm16(float32: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public stop() {
    // Invalidate any startup awaiting microphone permission or WebSocket setup.
    this.startupGeneration++;
    this.deterministicResponseRunId++;
    this.explicitShutdown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopWakeRecognizer();
    this.diagnosticTextTestActive = false;
    if (this.diagnosticTextTestTimer) {
      clearTimeout(this.diagnosticTextTestTimer);
      this.diagnosticTextTestTimer = null;
    }
    this.diag.upstreamConnected = false;
    this.stopAllPlayback();
    rodexSynth.stop();
    this.initializationInProgress = false;
    this.engineStarted = false;
    if (this.followUpSilenceTimer) {
      clearTimeout(this.followUpSilenceTimer);
      this.followUpSilenceTimer = null;
    }
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor.onaudioprocess = null;
      this.audioProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.pendingStartupAudioCtx) {
      const pending = this.pendingStartupAudioCtx;
      this.pendingStartupAudioCtx = null;
      if (pending.state !== 'closed') {
        void pending.close().catch(() => {});
      }
    }
    if (this.ws) {
      const previousSocket = this.ws;
      this.ws = null;
      try {
        if (previousSocket.readyState !== WebSocket.CLOSED) previousSocket.close();
      } catch (_) {}
    }
    this.isMicLive = false;
    this.isConversationActive = false;
    this.deterministicResponseForTurn = false;
    this.deterministicResponseSpeechActive = false;
    this.deterministicResponseTurnFinished = false;
    this.deterministicResponseSource = null;
    this.setStatus('disconnected');
    this.addTrace('LIVE VOICE CLEANED UP');
  }
}

export const globalLiveConversationService = new LiveConversationService();
