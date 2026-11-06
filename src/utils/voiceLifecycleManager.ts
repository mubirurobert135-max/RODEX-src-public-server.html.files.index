// RODEX Authoritative Voice Lifecycle Manager
// Single controller for automatic microphone initialization, OS permissions,
// hands-free wake-word detection, follow-up windows, and natural interruption.

import { VoiceEngineState, VoiceDiagnostics } from '../types';
import {
  rodexSynth,
  playToneChime,
  extractHeyRodexCommand,
  checkWakeWordMatch,
  isConversationExit,
  AudioMeter,
} from './speech';
import { triggerHaptic } from './haptics';
import { globalVoiceTransitionEngine } from './voiceTransitionEngine';

export interface VoiceManagerCallbacks {
  onStateChange: (state: VoiceEngineState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onWakeDetected: (pureActivation: boolean, command: string) => void;
  onCommandCaptured: (command: string) => void;
  onError: (error: string, fatal: boolean) => void;
  onAudioMetrics?: (metrics: { level: number; pitchHz: number; isSpeech: boolean; confidence?: number }) => void;
}

export class VoiceLifecycleManager {
  private static instance: VoiceLifecycleManager | null = null;

  // State Machine
  private state: VoiceEngineState = 'INITIALIZING';
  private callbacks: VoiceManagerCallbacks | null = null;

  // OS & Hardware Permissions
  private hasInputDevice: boolean = false;
  private permissionState: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';
  private permissionStatusObj: PermissionStatus | null = null;
  private isInitializingRef: boolean = false;
  private isInitializedRef: boolean = false;

  // Single Persistent Microphone Stream & AudioMeter
  private audioMeter: AudioMeter = new AudioMeter();
  private isAudioMeterActive: boolean = false;
  private audioMetricsInterval: NodeJS.Timeout | null = null;

  // Speech Recognition Session (Browser SpeechRecognition API)
  private recognition: any = null;
  private isRecognitionRunning: boolean = false;
  private isStartingRecognition: boolean = false;
  private isWakeWordEnabled: boolean = true;
  private customWakeWordConfig?: { phrase: string; enabled: boolean; isTrained?: boolean };

  // Turn-Taking & Follow-Up Window Timers
  private followUpTimer: NodeJS.Timeout | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private restartBackoffTimer: NodeJS.Timeout | null = null;
  private followUpWindowDurationMs: number = 7000;

  // Error Recovery & Diagnostics
  private liveVoiceMode: boolean = true;
  private instanceCounter: number = 0;
  private currentInstanceId: string = 'RDX-000';
  private diagnosticLogs: Array<{ id: string; time: string; text: string }> = [];
  private micProbeDetail: string = 'Not probed';
  private micSignalStatus: 'NO_SIGNAL' | 'SIGNAL_DETECTED' | 'CHECKING' = 'NO_SIGNAL';
  private speechRecStatus: 'NOT_STARTED' | 'STARTED_NO_AUDIO_EVENTS' | 'AUDIO_EVENTS_RECEIVED' | 'RESULT_RECEIVED' = 'NOT_STARTED';
  private consecutiveErrors: number = 0;
  private reconnectAttempts: number = 0;
  private lastEvent: string = 'boot';
  private lastError: string | null = null;
  private isSelfSpeaking: boolean = false;
  private ttsStartTime: number = 0;
  private lastCapturedTranscript: string = '';

  private constructor() {
    globalVoiceTransitionEngine.setAudioMeter(this.audioMeter);
    this.setupLifecycleEventListeners();
  }

  public static getInstance(): VoiceLifecycleManager {
    if (!VoiceLifecycleManager.instance) {
      VoiceLifecycleManager.instance = new VoiceLifecycleManager();
    }
    return VoiceLifecycleManager.instance;
  }

  public setCallbacks(callbacks: VoiceManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public setCustomWakeWord(config?: { phrase: string; enabled: boolean; isTrained?: boolean }) {
    this.customWakeWordConfig = config;
  }

  public setMicPermission(granted: boolean) {
    if (granted) {
      this.permissionState = 'granted';
      this.initializeHardwareAndWakeListening();
    } else {
      this.permissionState = 'denied';
      this.stopAll();
      this.transitionTo('PERMISSION_REVOKED', 'permission_set_false');
    }
  }

  public setSelfSpeaking(isSpeaking: boolean) {
    this.notifySpeaking(isSpeaking);
  }

  public startContinuousWakeListening(enable: boolean = true) {
    this.setWakeWordEnabled(enable);
    if (enable) {
      this.startWakeWordListening();
    } else {
      this.stopAll();
    }
  }

  public setWakeWordEnabled(enabled: boolean) {
    this.isWakeWordEnabled = enabled;
    if (!enabled && this.state === 'IDLE_LISTENING') {
      this.stopRecognition();
      this.transitionTo('PAUSED');
    } else if (enabled && (this.state === 'PAUSED' || this.state === 'MIC_READY')) {
      this.startWakeWordListening();
    }
  }

  public setFollowUpDuration(durationMs: number) {
    this.followUpWindowDurationMs = Math.max(3000, Math.min(15000, durationMs));
  }

  public getState(): VoiceEngineState {
    return this.state;
  }

  public getPermissionState(): 'granted' | 'denied' | 'prompt' | 'unknown' {
    return this.permissionState;
  }

  public isPermissionGranted(): boolean {
    return this.permissionState === 'granted';
  }

  public addDiagnosticLog(msg: string) {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = { id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, time, text: msg };
    this.diagnosticLogs = [logItem, ...this.diagnosticLogs].slice(0, 40);
    console.info(`[RODEX TRACE ${time}] ${msg}`);
  }

  public getDiagnosticLogs(): Array<{ id: string; time: string; text: string }> {
    return this.diagnosticLogs;
  }

  public getInstanceId(): string {
    return this.currentInstanceId;
  }

  public getMicProbeDetail(): string {
    return this.micProbeDetail;
  }

  public setLiveVoiceMode(active: boolean) {
    this.liveVoiceMode = active;
    if (active) {
      this.stopRecognition();
      this.addDiagnosticLog('[VoiceLifecycle] liveVoiceMode enabled: Web Speech Recognition gated OFF');
    } else {
      this.addDiagnosticLog('[VoiceLifecycle] liveVoiceMode disabled');
    }
  }

  public isLiveVoiceMode(): boolean {
    return this.liveVoiceMode;
  }

  public getMicSignalStatus(): 'NO_SIGNAL' | 'SIGNAL_DETECTED' | 'CHECKING' {
    return this.micSignalStatus;
  }

  public getSpeechRecStatus(): 'NOT_STARTED' | 'STARTED_NO_AUDIO_EVENTS' | 'AUDIO_EVENTS_RECEIVED' | 'RESULT_RECEIVED' {
    return this.speechRecStatus;
  }

  /**
   * Diagnostic Test 1: Real microphone audio level analysis (3 seconds)
   * Requests getUserMedia, connects to Web Audio AnalyserNode, calculates peak RMS volume,
   * displays MIC AUDIO LEVEL = ... and then IMMEDIATELY releases all tracks and closes AudioContext.
   */
  public async runMicAudioLevelTest(): Promise<{ peakLevel: number; signalDetected: boolean }> {
    this.micSignalStatus = 'CHECKING';
    this.addDiagnosticLog('TEST MICROPHONE AUDIO started (3s analysis window)...');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.addDiagnosticLog('TEST MIC AUDIO FAILED: getUserMedia missing');
        this.micSignalStatus = 'NO_SIGNAL';
        return { peakLevel: 0, signalDetected: false };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxRms = 0;
      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const norm = Math.min(1.0, Math.max(0.0, avg / 128));
          if (norm > maxRms) maxRms = norm;

          if (Date.now() - startTime >= 3000) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });

      // CLEANUP MIC TEST TRACKS & AUDIOCONTEXT IMMEDIATELY!
      stream.getTracks().forEach((t) => t.stop());
      try {
        source.disconnect();
        analyser.disconnect();
        await ctx.close();
      } catch (_) {}

      const signalDetected = maxRms > 0.02;
      this.micSignalStatus = signalDetected ? 'SIGNAL_DETECTED' : 'NO_SIGNAL';
      this.addDiagnosticLog(`MIC AUDIO LEVEL = ${(maxRms * 100).toFixed(1)}% -> Result: ${this.micSignalStatus}`);
      return { peakLevel: maxRms, signalDetected };
    } catch (err: any) {
      this.micSignalStatus = 'NO_SIGNAL';
      this.addDiagnosticLog(`MIC AUDIO TEST ERROR: ${err?.message || err}`);
      return { peakLevel: 0, signalDetected: false };
    }
  }

  /**
   * Diagnostic Test 2: Speech Recognition lifecycle test
   * Starts exactly ONE SpeechRecognition instance and logs full lifecycle events.
   */
  public testSpeechRecognitionSingle(): void {
    this.addDiagnosticLog('TEST SPEECH RECOGNITION button clicked -> Starting single instance test...');
    this.speechRecStatus = 'NOT_STARTED';
    this.liveVoiceMode = false;
    this.initOrResumeRecognition('wake_detection');
  }

  public getDiagnostics(): VoiceDiagnostics {
    const metrics = this.audioMeter.getVoiceMetrics();
    return {
      state: this.state,
      hasInputDevice: this.hasInputDevice,
      permissionState: this.permissionState,
      isStreamActive: this.isAudioMeterActive,
      isRecognitionActive: this.isRecognitionRunning,
      isSynthActive: rodexSynth.isSpeaking() || this.isSelfSpeaking,
      wakeWordEnabled: this.isWakeWordEnabled,
      consecutiveErrors: this.consecutiveErrors,
      reconnectAttempts: this.reconnectAttempts,
      lastEvent: this.lastEvent,
      lastError: this.lastError,
      audioLevel: metrics.level,
      pitchHz: metrics.pitchHz,
      followUpWindowMs: this.followUpWindowDurationMs,
    };
  }

  private transitionTo(newState: VoiceEngineState, eventName?: string) {
    if (this.state === newState) return;
    this.state = newState;
    if (eventName) this.lastEvent = eventName;
    console.info(`[VoiceLifecycle] State: ${newState}${eventName ? ` (Event: ${eventName})` : ''}`);
    this.callbacks?.onStateChange(newState);
  }

  // =========================================================================
  // AUTOMATIC INITIALIZATION & LIFECYCLE LISTENERS
  // =========================================================================

  /**
   * Automatically initializes microphone on boot or startup without requiring a button.
   * If permission is already granted, the mic stream and wake-word listener start automatically.
   */
  public async autoInitialize(): Promise<void> {
    if (this.isInitializingRef) {
      console.info('[RODEX Voice] initialization skipped - already running');
      return;
    }
    if (this.isInitializedRef && this.permissionState === 'granted' && this.isRecognitionRunning) {
      console.info('[RODEX Voice] initialization skipped - already running');
      return;
    }

    this.isInitializingRef = true;
    console.info('[RODEX Voice] initialization started');
    this.transitionTo('INITIALIZING', 'auto_init_start');

    if (typeof window === 'undefined') {
      this.isInitializingRef = false;
      return;
    }

    try {
      // 1. Detect microphone input hardware
      await this.detectInputDevices();

      if (!this.hasInputDevice) {
        this.transitionTo('MIC_UNAVAILABLE', 'no_audio_input_hardware');
        this.isInitializingRef = false;
        return;
      }

      // 2. Query OS / Browser permission status
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          this.permissionStatusObj = status;
          this.permissionState = status.state as any;

          // Listen for OS / Browser permission changes in real-time
          status.onchange = () => {
            this.handlePermissionChange(status.state);
          };

          if (status.state === 'granted') {
            // Returning User: Permission is already granted! Automatically initialize mic & wake engine.
            console.info('[RODEX Voice] microphone ready');
            await this.initializeHardwareAndWakeListening();
          } else if (status.state === 'denied') {
            this.transitionTo('PERMISSION_REVOKED', 'permission_denied_by_os');
          } else {
            // First use: status is 'prompt'. Do not trigger invasive prompt until user interacts with the minimal UI.
            this.transitionTo('MIC_PERMISSION_REQUIRED', 'permission_prompt_required');
          }
        } catch (err: any) {
          console.info('[RODEX Voice] Permissions API query unavailable, checking via fallback:', err?.message);
          this.transitionTo('MIC_PERMISSION_REQUIRED', 'permissions_query_unsupported');
        }
      } else {
        this.transitionTo('MIC_PERMISSION_REQUIRED', 'permissions_api_missing');
      }
    } catch (err: any) {
      console.warn('[RODEX Voice] initialization error:', err);
    } finally {
      this.isInitializingRef = false;
      this.isInitializedRef = true;
    }
  }

  /**
   * Request microphone permission explicitly in response to user tap on the minimal first-use banner.
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    this.lastEvent = 'user_permission_requested';
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.transitionTo('MIC_UNAVAILABLE', 'get_user_media_missing');
        return false;
      }

      // Request stream from OS
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Release temporary tracks
      stream.getTracks().forEach((track) => track.stop());

      this.permissionState = 'granted';
      console.info('[VoiceLifecycle] Microphone permission granted by user. Initializing voice engine immediately.');
      await this.initializeHardwareAndWakeListening();
      return true;
    } catch (err: any) {
      console.warn('[VoiceLifecycle] Microphone permission denied or dismissed:', err);
      this.permissionState = 'denied';
      this.transitionTo('PERMISSION_REVOKED', 'permission_rejected_by_user');
      return false;
    }
  }

  /**
   * Hardware & Wake-Word Stream Startup
   */
  private async initializeHardwareAndWakeListening(): Promise<boolean> {
    // The Gemini Live service owns the microphone and its wake recognizer.
    // A second Web Speech hardware probe was acquiring a competing stream
    // each time the Permissions API reported "granted".
    if (this.liveVoiceMode) {
      this.addDiagnosticLog('Mic hardware delegated to the exclusive Live voice pipeline');
      this.transitionTo('MIC_READY', 'delegated_to_live_pipeline');
      return true;
    }
    this.addDiagnosticLog('microphone permission check started');
    this.addDiagnosticLog(`microphone permission state = ${this.permissionState}`);

    // Probe actual microphone stream capture to verify document/iframe permissions policy
    if (typeof window !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        this.addDiagnosticLog('getUserMedia requested');
        const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.addDiagnosticLog('microphone stream acquired');
        const tracks = probeStream.getAudioTracks();
        this.addDiagnosticLog(`microphone tracks = ${tracks.length}`);
        if (tracks.length > 0) {
          const t = tracks[0];
          this.micProbeDetail = `LIVE | kind=${t.kind} | readyState=${t.readyState} | enabled=${t.enabled} | label="${t.label || 'Default Mic'}"`;
          this.addDiagnosticLog(`audio track kind = ${t.kind}`);
          this.addDiagnosticLog(`audio track readyState = ${t.readyState}`);
          this.addDiagnosticLog(`audio track enabled = ${t.enabled}`);
          this.addDiagnosticLog(`audio track label = ${t.label || 'Default Mic'}`);
        } else {
          this.micProbeDetail = 'No audio tracks found on stream';
          this.addDiagnosticLog('NO AUDIO TRACKS FOUND ON ACQUIRED STREAM');
        }
        // Release probe tracks immediately so SpeechRecognition has 100% exclusive hardware access!
        tracks.forEach((track) => track.stop());
      } catch (err: any) {
        this.micProbeDetail = `FAILED: ${err?.message || err}`;
        this.addDiagnosticLog(`getUserMedia PROBE FAILED: ${err?.message || err}`);
        this.permissionState = 'denied';
        this.transitionTo('MIC_UNAVAILABLE', 'permissions_policy_violation');
        this.callbacks?.onError('Microphone audio capture is restricted in this document context', false);
        return false;
      }
    }

    this.addDiagnosticLog('microphone hardware check complete -> MIC READY');
    this.transitionTo('MIC_READY', 'mic_ready');

    // Start continuous wake-word detection
    if (this.isWakeWordEnabled) {
      this.startWakeWordListening();
    } else {
      this.transitionTo('PAUSED', 'wake_disabled');
    }
    return true;
  }

  private handlePermissionChange(newState: string) {
    console.info('[VoiceLifecycle] OS Microphone permission changed to:', newState);
    this.permissionState = newState as any;

    if (newState === 'granted') {
      this.initializeHardwareAndWakeListening();
    } else if (newState === 'denied') {
      this.stopAll();
      this.transitionTo('PERMISSION_REVOKED', 'permission_revoked_by_os');
    } else {
      this.stopAll();
      this.transitionTo('MIC_PERMISSION_REQUIRED', 'permission_reset_to_prompt');
    }
  }

  private async detectInputDevices(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        this.hasInputDevice = true; // Assume true if enumerateDevices unsupported
        return true;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioIn = devices.some((d) => d.kind === 'audioinput');
      this.hasInputDevice = hasAudioIn;
      return hasAudioIn;
    } catch (e) {
      this.hasInputDevice = true;
      return true;
    }
  }

  private setupLifecycleEventListeners() {
    if (typeof window === 'undefined') return;

    // Detect device connection / disconnection (e.g. bluetooth headset or USB mic)
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.info('[VoiceLifecycle] Media device change detected. Verifying microphone availability...');
        const hasMic = await this.detectInputDevices();
        if (!hasMic) {
          this.stopAll();
          this.transitionTo('MIC_UNAVAILABLE', 'device_disconnected');
        } else if (this.permissionState === 'granted' && !this.isRecognitionRunning) {
          this.initializeHardwareAndWakeListening();
        }
      });
    }

    // App Visibility / Tab Focus Handling
    document.addEventListener('visibilitychange', () => {
      this.addDiagnosticLog(`visibilitychange event: visibilityState=${document.visibilityState}, hasFocus=${document.hasFocus()}`);
      if (document.visibilityState === 'visible') {
        if (this.permissionState === 'granted') {
          if (!this.isRecognitionRunning && !this.isStartingRecognition && this.isWakeWordEnabled) {
            this.startWakeWordListening();
          }
        }
      }
    });

    window.addEventListener('focus', () => {
      this.addDiagnosticLog(`focus event: visibilityState=${document.visibilityState}, hasFocus=true`);
    });

    window.addEventListener('blur', () => {
      this.addDiagnosticLog(`blur event: visibilityState=${document.visibilityState}, hasFocus=false`);
    });
  }

  // =========================================================================
  // SINGLE SHARED AUDIO METER & VAD
  // =========================================================================

  private async startSharedAudioMeter(): Promise<boolean> {
    if (this.isAudioMeterActive) return true;
    try {
      const ok = await this.audioMeter.start();
      this.isAudioMeterActive = ok;
      if (ok && !this.audioMetricsInterval) {
        this.audioMetricsInterval = setInterval(() => {
          if (this.isAudioMeterActive) {
            const metrics = this.audioMeter.getVoiceMetrics();
            this.callbacks?.onAudioMetrics?.(metrics);
          }
        }, 60);
      }
      return ok;
    } catch (e) {
      this.isAudioMeterActive = false;
      return false;
    }
  }

  private stopSharedAudioMeter() {
    if (this.audioMetricsInterval) {
      clearInterval(this.audioMetricsInterval);
      this.audioMetricsInterval = null;
    }
    if (this.isAudioMeterActive) {
      this.audioMeter.stop();
      this.isAudioMeterActive = false;
    }
  }

  // =========================================================================
  // WAKE-WORD DETECTION & SPEECH RECOGNITION (SpeechRecognition API)
  // =========================================================================

  public startWakeWordListening(): boolean {
    if (this.permissionState !== 'granted') return false;

    this.clearTimers();
    this.transitionTo('IDLE_LISTENING', 'wake_listening_started');
    return this.initOrResumeRecognition('wake_detection');
  }

  public startCommandCapture(): void {
    if (this.permissionState !== 'granted') return;

    this.clearTimers();
    this.lastCapturedTranscript = '';
    this.transitionTo('LISTENING', 'active_command_capture');
    this.startSharedAudioMeter();
    this.initOrResumeRecognition('command_capture');
  }

  /**
   * Follow-up conversational window: keeps microphone active for follow-up questions
   * without requiring the user to repeat the wake phrase!
   */
  public startFollowUpWindow(durationMs?: number): void {
    if (this.permissionState !== 'granted') return;

    if (durationMs && durationMs > 0) {
      this.followUpWindowDurationMs = Math.max(3000, Math.min(15000, durationMs));
    }

    this.clearTimers();
    this.transitionTo('FOLLOW_UP_READY', 'follow_up_window_opened');
    this.startSharedAudioMeter();
    this.initOrResumeRecognition('command_capture');

    this.followUpTimer = setTimeout(() => {
      console.info('[VoiceLifecycle] Follow-up window expired; reverting to ambient wake listening.');
      this.followUpTimer = null;
      if (this.state === 'FOLLOW_UP_READY' || this.state === 'LISTENING') {
        this.startWakeWordListening();
      }
    }, this.followUpWindowDurationMs);
  }

  public notifySpeaking(isSpeaking: boolean) {
    this.isSelfSpeaking = isSpeaking;
    if (isSpeaking) {
      this.ttsStartTime = Date.now();
      this.transitionTo('SPEAKING', 'speaking_started');
    }
  }

  public notifyProcessing() {
    this.transitionTo('PROCESSING', 'ai_processing');
  }

  public notifyExecuting() {
    this.transitionTo('EXECUTING', 'tool_executing');
  }

  private initOrResumeRecognition(mode: 'wake_detection' | 'command_capture'): boolean {
    if (typeof window === 'undefined') return false;

    // GATED: Prevent SpeechRecognition from running when Live Voice mode is active
    if (this.liveVoiceMode) {
      this.addDiagnosticLog('[VoiceLifecycle] Web Speech recognition gated off while Live Voice mode is active');
      return false;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.addDiagnosticLog('SpeechRecognition API is unsupported in this browser environment');
      this.callbacks?.onError('SpeechRecognition API unsupported in browser', true);
      return false;
    }

    // Reuse existing running session if mode matches and recognition is alive
    if (this.isStartingRecognition || (this.recognition && this.isRecognitionRunning)) {
      return true;
    }

    if (this.recognition) {
      try {
        this.addDiagnosticLog(`recognition.abort() called on prior instance ${this.currentInstanceId}`);
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }

    try {
      this.isStartingRecognition = true;
      this.instanceCounter++;
      this.currentInstanceId = `RDX-${String(this.instanceCounter).padStart(3, '0')}`;

      const rec = new SpeechRecognitionClass();
      this.recognition = rec;
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      this.addDiagnosticLog(`RDX recognition instance created ${this.currentInstanceId}`);

      rec.onstart = () => {
        this.addDiagnosticLog(`RDX recognition start ${this.currentInstanceId}`);
        this.addDiagnosticLog(`recognition onstart (${this.currentInstanceId})`);
        this.speechRecStatus = 'STARTED_NO_AUDIO_EVENTS';
        this.isStartingRecognition = false;
        this.isRecognitionRunning = true;
        this.consecutiveErrors = 0;
        this.lastEvent = `recognition_onstart_${this.currentInstanceId}`;

        const isIframe = typeof window !== 'undefined' && window.top !== window.self;
        if (isIframe) {
          this.addDiagnosticLog(`ENVIRONMENT DIAGNOSTIC: Embedded iframe detected (window.top !== window.self). SecureContext: ${window.isSecureContext}`);
        }
      };

      rec.onaudiostart = () => {
        if (this.speechRecStatus === 'STARTED_NO_AUDIO_EVENTS') {
          this.speechRecStatus = 'AUDIO_EVENTS_RECEIVED';
        }
        this.addDiagnosticLog(`recognition onaudiostart (${this.currentInstanceId})`);
      };

      rec.onsoundstart = () => {
        if (this.speechRecStatus === 'STARTED_NO_AUDIO_EVENTS') {
          this.speechRecStatus = 'AUDIO_EVENTS_RECEIVED';
        }
        this.addDiagnosticLog(`recognition onsoundstart (${this.currentInstanceId})`);
      };

      rec.onspeechstart = () => {
        if (this.speechRecStatus === 'STARTED_NO_AUDIO_EVENTS') {
          this.speechRecStatus = 'AUDIO_EVENTS_RECEIVED';
        }
        this.addDiagnosticLog(`recognition onspeechstart (${this.currentInstanceId})`);
      };

      rec.onnomatch = () => {
        this.addDiagnosticLog(`recognition onnomatch (${this.currentInstanceId})`);
      };

      rec.onresult = (event: any) => {
        this.speechRecStatus = 'RESULT_RECEIVED';
        this.addDiagnosticLog(`recognition onresult (${this.currentInstanceId})`);

        // -------------------------------------------------------------
        // BARGE-IN & INTERRUPTION HANDLING (While RODEX is speaking)
        // -------------------------------------------------------------
        if (this.isSelfSpeaking || rodexSynth.isSpeaking() || this.state === 'SPEAKING') {
          if (Date.now() - this.ttsStartTime < 750) {
            return;
          }

          let speechDuringTTS = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            speechDuringTTS += event.results[i][0].transcript;
          }
          const spoken = speechDuringTTS.trim();
          if (spoken.length > 2) {
            this.addDiagnosticLog(`User interruption detected during TTS: "${spoken}"`);
            rodexSynth.stop();
            this.notifySpeaking(false);
            playToneChime('bargein');
            triggerHaptic('tap');
            this.transitionTo('LISTENING', 'user_interruption');
            this.lastCapturedTranscript = spoken;
            this.callbacks?.onTranscript(spoken, false);

            if (this.silenceTimer) clearTimeout(this.silenceTimer);
            this.silenceTimer = setTimeout(() => {
              if (this.lastCapturedTranscript.trim()) {
                this.callbacks?.onCommandCaptured(this.lastCapturedTranscript.trim());
              }
            }, 900);
            return;
          }
          return;
        }

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const currentText = (finalTranscript || interimTranscript || '').trim();
        if (!currentText) return;

        this.addDiagnosticLog(`transcript = "${currentText}"`);

        this.lastCapturedTranscript = currentText;
        this.callbacks?.onTranscript(currentText, Boolean(finalTranscript));

        // Bypassing Gemini AI test command check
        if (currentText.toLowerCase().includes('hello rodex test')) {
          this.addDiagnosticLog('LOCAL TEST COMMAND MATCHED: "hello rodex test" -> Bypassing Gemini AI');
          triggerHaptic('activate');
          playToneChime('wake');
          this.transitionTo('SPEAKING', 'local_test_command_speak');
          rodexSynth.speak('Voice test successful.', {
            onStart: () => {
              this.addDiagnosticLog('TTS started (Local test phrase)');
            },
            onEnd: () => {
              this.addDiagnosticLog('TTS ended (Local test phrase)');
              this.startWakeWordListening();
            },
          });
          return;
        }

        // In follow-up window, speech immediately cancels the window timeout
        if (this.followUpTimer) {
          clearTimeout(this.followUpTimer);
          this.followUpTimer = null;
        }

        // -------------------------------------------------------------
        // PASSIVE WAKE-WORD DETECTION (IDLE_LISTENING)
        // -------------------------------------------------------------
        if (this.state === 'IDLE_LISTENING') {
          this.addDiagnosticLog(`wake matching against transcript: "${currentText}"`);
          const match = checkWakeWordMatch(currentText, this.customWakeWordConfig);
          this.addDiagnosticLog(`wake MATCHED = ${match.isCall}`);

          if (match.isCall) {
            triggerHaptic('activate');
            playToneChime('wake');
            this.addDiagnosticLog('wake handler called');
            this.transitionTo('WAKE_DETECTED', 'wake_matched');

            if (match.isPureActivation) {
              this.callbacks?.onWakeDetected(true, '');
            } else {
              this.callbacks?.onWakeDetected(false, match.command);
            }
          }
        }
        // -------------------------------------------------------------
        // ACTIVE COMMAND CAPTURE (LISTENING or FOLLOW_UP_READY)
        // -------------------------------------------------------------
        else if (this.state === 'LISTENING' || this.state === 'FOLLOW_UP_READY') {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }

          const wakeCheck = extractHeyRodexCommand(currentText);
          const effectiveCmd = wakeCheck.isCall ? wakeCheck.command : currentText;

          if (isConversationExit(effectiveCmd)) {
            this.addDiagnosticLog(`User requested exit: "${effectiveCmd}"`);
            this.clearTimers();
            this.startWakeWordListening();
            return;
          }

          if (wakeCheck.isCall && !effectiveCmd.trim()) {
            triggerHaptic('activate');
            playToneChime('wake');
            this.addDiagnosticLog('wake handler called in follow-up');
            this.transitionTo('WAKE_DETECTED', 'wake_matched_in_followup');
            this.callbacks?.onWakeDetected(true, '');
            return;
          }

          this.silenceTimer = setTimeout(() => {
            if (effectiveCmd.trim()) {
              this.addDiagnosticLog(`command captured = "${effectiveCmd.trim()}"`);
              this.callbacks?.onCommandCaptured(effectiveCmd.trim());
            }
          }, 900);
        }
      };

      rec.onspeechend = () => {
        this.addDiagnosticLog(`recognition onspeechend (${this.currentInstanceId})`);
      };

      rec.onsoundend = () => {
        this.addDiagnosticLog(`recognition onsoundend (${this.currentInstanceId})`);
      };

      rec.onaudioend = () => {
        this.addDiagnosticLog(`recognition onaudioend (${this.currentInstanceId})`);
      };

      let wasNoSpeech = false;

      rec.onerror = (event: any) => {
        const errType = event?.error || 'unknown';
        this.lastError = errType;
        this.addDiagnosticLog(`recognition onerror = ${errType} (${this.currentInstanceId})`);

        if (errType === 'no-speech') {
          wasNoSpeech = true;
          return;
        }

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          this.addDiagnosticLog('Microphone access denied or service not allowed by browser');
          this.permissionState = 'denied';
          this.stopAll();
          this.transitionTo('PERMISSION_REVOKED', 'not_allowed_error');
          this.callbacks?.onError('Microphone access is not allowed in this document context', true);
          return;
        }

        if (errType === 'audio-capture') {
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= 3) {
            this.stopAll();
            this.transitionTo('MIC_UNAVAILABLE', 'audio_capture_hardware_error');
            this.callbacks?.onError('Microphone hardware capture error. Please verify device connection.', false);
            return;
          }
          return;
        }

        if (errType === 'aborted') {
          return;
        }

        this.consecutiveErrors++;
        if (this.consecutiveErrors > 5) {
          this.callbacks?.onError(`Speech recognition error: ${errType}`, false);
        }
      };

      rec.onend = () => {
        this.addDiagnosticLog(`RDX recognition stop ${this.currentInstanceId}`);
        this.addDiagnosticLog(`recognition onend (${this.currentInstanceId})`);
        this.isRecognitionRunning = false;
        this.isStartingRecognition = false;

        const isIframe = typeof window !== 'undefined' && window.top !== window.self;

        if (this.speechRecStatus === 'STARTED_NO_AUDIO_EVENTS') {
          if (isIframe) {
            this.addDiagnosticLog('SpeechRecognition started but browser delivered no audio events. Preview iframe may be blocking Web Speech audio input.');
          } else {
            this.addDiagnosticLog('SpeechRecognition started but no audio events received. Check browser microphone input selection.');
          }
        }

        if (wasNoSpeech || !this.lastError || this.lastError === 'no-speech') {
          this.consecutiveErrors = 0;
        }

        // If SpeechRecognition started but delivered zero audio events in an iframe, do NOT create an aggressive restart loop!
        if (this.speechRecStatus === 'STARTED_NO_AUDIO_EVENTS' && isIframe) {
          this.addDiagnosticLog('[RODEX DIAGNOSTIC] Auto-restart loop paused because browser delivered no audio events in iframe.');
          return;
        }

        if (
          this.permissionState === 'granted' &&
          (this.state === 'IDLE_LISTENING' || this.state === 'LISTENING' || this.state === 'FOLLOW_UP_READY') &&
          this.consecutiveErrors < 5
        ) {
          this.reconnectAttempts++;
          const backoff = wasNoSpeech ? 350 : Math.min(3000, 500 + this.consecutiveErrors * 500);
          this.addDiagnosticLog(`[RODEX DIAGNOSTIC] scheduled recognition restart in ${backoff}ms`);
          if (this.restartBackoffTimer) clearTimeout(this.restartBackoffTimer);
          this.restartBackoffTimer = setTimeout(() => {
            if (
              this.permissionState === 'granted' &&
              !this.isRecognitionRunning &&
              !this.isStartingRecognition &&
              (this.state === 'IDLE_LISTENING' || this.state === 'LISTENING' || this.state === 'FOLLOW_UP_READY')
            ) {
              this.addDiagnosticLog('[RODEX DIAGNOSTIC] recognition restart executed');
              this.initOrResumeRecognition(mode);
            }
          }, backoff);
        }
      };

      this.addDiagnosticLog(`recognition.start() called on instance ${this.currentInstanceId}`);
      rec.start();
      return true;
    } catch (err: any) {
      this.addDiagnosticLog(`Failed starting speech recognition instance ${this.currentInstanceId}: ${err?.message || err}`);
      this.isStartingRecognition = false;
      this.lastError = err?.message || 'start_failed';
      return false;
    }
  }

  private stopRecognition() {
    this.clearTimers();
    this.isRecognitionRunning = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
  }

  private clearTimers() {
    if (this.restartBackoffTimer) {
      clearTimeout(this.restartBackoffTimer);
      this.restartBackoffTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }
  }

  public stopAll() {
    this.clearTimers();
    this.stopRecognition();
    this.stopSharedAudioMeter();
    this.isSelfSpeaking = false;
    this.transitionTo('PAUSED', 'stopped_all');
  }
}

export const globalVoiceManager = VoiceLifecycleManager.getInstance();
