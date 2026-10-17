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
  private inputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Singleton initialization guards & Session Resumption
  private initializationInProgress = false;
  private engineStarted = false;
  private wakeRecognizer: any = null;
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
    if (this.engineStarted || (this.isConnected() && this.isMicLive)) {
      console.info('[RODEX ENGINE] SINGLETON_ACTIVE / DUPLICATE_START_BLOCKED');
      this.addTrace('[RODEX ENGINE] DUPLICATE_START_BLOCKED');
      return;
    }
    if (this.initializationInProgress) {
      console.info('[RODEX ENGINE] INIT_IN_PROGRESS');
      return;
    }

    this.initializationInProgress = true;
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

      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume().catch(() => {});
      }

      // Try unlocking output AudioContext as early as browser permits
      this.getOrCreateOutputAudioGraph();
      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume().catch(() => {});
      }

      // 1. Single exclusive microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.isMicLive = true;
      this.engineStarted = true;
      this.initializationInProgress = false;

      const audioTrack = this.mediaStream.getAudioTracks()[0];
      this.diag.micStreamId = audioTrack ? audioTrack.id.substring(0, 8) : 'mic-active';
      this.addTrace(`[RODEX AUDIO] SINGLE_STREAM_ACTIVE (Track ID: ${this.diag.micStreamId})`);

      // 2. Establish Live connection
      this.diag.liveConnection = 'RUNNING';
      await this.connectWebSocketOnly();

      this.diag.voiceSessionId = `sess-${Date.now().toString(36)}`;
      this.diag.liveConnection = 'PASS';
      this.diag.voiceEngine = 'WAKE_LISTENER_ACTIVE';
      this.diag.orbVoiceState = 'IDLE';
      this.setStatus('idle');
      this.addTrace('LIVE VOICE CONNECTED');
      console.info('[RODEX GATE] WAKE_LISTENING_ACTIVE');
      this.addTrace('[RODEX GATE] WAKE_LISTENING_ACTIVE');

      // 3. Start local wake word recognizer for WAKE_LISTENING mode
      this.startWakeRecognizer();
    } catch (err: any) {
      this.initializationInProgress = false;
      this.engineStarted = false;
      const errMsg = err?.message || String(err);
      this.addTrace(`MIC ERROR: ${errMsg}`);
      this.diag.lastErrorMessage = `MIC ERROR: ${errMsg}`;
      this.diag.voiceEngine = 'MIC_ERROR';
      this.diag.orbVoiceState = 'ERROR';
      this.diag.liveConnection = 'FAIL';
      this.setStatus('error');
      this.callbacks.onError?.(errMsg);
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
  private async connectWebSocketOnly(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.explicitShutdown = false;
        this.addEventTimeline('SESSION_CONNECTING', 'Initiating WebSocket connection to /api/live');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/live`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.addTrace('LIVE WS OPEN');
          this.diag.liveConnection = 'PASS';
          this.reconnectAttempts = 0;
          this.addEventTimeline('SESSION_CONNECTED', 'WebSocket connection established successfully');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (err) {
            console.error('[RODEX Live] Failed parsing server message', err);
          }
        };

        this.ws.onclose = (event) => {
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
            if (!this.explicitShutdown && this.isMicLive) {
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

        this.ws.onerror = (err) => {
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
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const inputChannelData = e.inputBuffer.getChannelData(0);

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
    this.diag.orbVoiceState = 'IDLE';
    this.diag.voiceEngine = 'WAKE_LISTENER_ACTIVE';
    this.setStatus('idle');
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
        this.addTrace(`LIVE UPSTREAM READY: model=${data.model || 'gemini-3.8-live'}`);
        if (this.mediaStream) {
          this.startMicProcessing();
        }
        this.startAudioLevelLoop();
        break;

      case 'model_turn':
        if (!this.isConversationActive) {
          // Hard Wake Gate: Discard unsolicited model turns when no wake phrase has been confirmed
          return;
        }
        this.addTrace('MODEL RESPONSE RECEIVED');
        break;

      case 'fallback':
      case 'error': {
        const errorMsg = data.error || data.message || 'Gemini Live server error';
        this.lastError = errorMsg;
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
        if (!this.isConversationActive) {
          // Hard Wake Gate: Discard unsolicited response audio when no wake phrase has been confirmed
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
        if (!this.isConversationActive) {
          // Hard Wake Gate: Discard unsolicited output transcripts when no wake phrase has been confirmed
          return;
        }
        if (data.text) {
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
        if (!this.isConversationActive) {
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
        }
        this.addTrace('OUTPUT COMPLETE');
        if (!this.mediaStream && this.turnPcmChunks.length > 0) {
          await this.playConcatenatedCompleteResponse();
        }
        // When model finishes, enter active follow-up listening
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
    if (!SpeechRec) return;

    if (this.wakeRecognizer) {
      try { this.wakeRecognizer.abort(); } catch (_) {}
      this.wakeRecognizer = null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (transcript && transcript.trim().length > 0) {
            this.handleInputTranscript(transcript, 'wake_recognizer');
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[RODEX WAKE RECOGNIZER] Non-fatal error:', e.error);
        }
      };

      rec.onend = () => {
        if (!this.isConversationActive && this.isMicLive) {
          setTimeout(() => {
            if (!this.isConversationActive && this.isMicLive) {
              try { rec.start(); } catch (_) {}
            }
          }, 350);
        }
      };

      rec.start();
      this.wakeRecognizer = rec;
      console.info('[RODEX GATE] WAKE_LISTENING');
      this.addTrace('[RODEX GATE] WAKE_LISTENING');
    } catch (err) {
      console.warn('[RODEX WAKE RECOGNIZER] Failed initializing local wake recognizer:', err);
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
      await ctx.resume().catch(() => {});
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
        this.diag.audibleOutputVerified = 'PASS';
        if (this.status === 'speaking') {
          this.diag.orbVoiceState = 'LISTENING';
          this.setStatus('listening');
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.addTrace(`SENDING TEXT: "${textToSend}"`);
      this.ws.send(JSON.stringify({ text: textToSend }));
      this.diag.textRequest = 'PASS';
      this.setStatus('thinking');
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
    this.explicitShutdown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopWakeRecognizer();
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
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.isMicLive = false;
    this.isConversationActive = false;
    this.setStatus('disconnected');
    this.addTrace('LIVE VOICE CLEANED UP');
  }
}

export const globalLiveConversationService = new LiveConversationService();
