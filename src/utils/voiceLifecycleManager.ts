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

  // Single Persistent Microphone Stream & AudioMeter
  private audioMeter: AudioMeter = new AudioMeter();
  private isAudioMeterActive: boolean = false;
  private audioMetricsInterval: NodeJS.Timeout | null = null;

  // Speech Recognition Session (Browser SpeechRecognition API)
  private recognition: any = null;
  private isRecognitionRunning: boolean = false;
  private isWakeWordEnabled: boolean = true;
  private customWakeWordConfig?: { phrase: string; enabled: boolean; isTrained?: boolean };

  // Turn-Taking & Follow-Up Window Timers
  private followUpTimer: NodeJS.Timeout | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private restartBackoffTimer: NodeJS.Timeout | null = null;
  private followUpWindowDurationMs: number = 7000;

  // Error Recovery & Diagnostics
  private consecutiveErrors: number = 0;
  private reconnectAttempts: number = 0;
  private lastEvent: string = 'boot';
  private lastError: string | null = null;
  private isSelfSpeaking: boolean = false;
  private ttsStartTime: number = 0;
  private lastCapturedTranscript: string = '';

  private constructor() {
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
    this.transitionTo('INITIALIZING', 'auto_init_start');

    if (typeof window === 'undefined') return;

    // 1. Detect microphone input hardware
    await this.detectInputDevices();

    if (!this.hasInputDevice) {
      this.transitionTo('MIC_UNAVAILABLE', 'no_audio_input_hardware');
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
          console.info('[VoiceLifecycle] Microphone permission already granted. Auto-initializing hands-free voice engine...');
          await this.initializeHardwareAndWakeListening();
        } else if (status.state === 'denied') {
          this.transitionTo('PERMISSION_REVOKED', 'permission_denied_by_os');
        } else {
          // First use: status is 'prompt'. Do not trigger invasive prompt until user interacts with the minimal UI.
          this.transitionTo('MIC_PERMISSION_REQUIRED', 'permission_prompt_required');
        }
      } catch (err: any) {
        console.info('[VoiceLifecycle] Permissions API query unavailable, checking via fallback:', err?.message);
        this.transitionTo('MIC_PERMISSION_REQUIRED', 'permissions_query_unsupported');
      }
    } else {
      this.transitionTo('MIC_PERMISSION_REQUIRED', 'permissions_api_missing');
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
  private async initializeHardwareAndWakeListening(): Promise<void> {
    this.transitionTo('MIC_READY', 'mic_ready');

    // Start single shared audio meter for voice activity & haptics
    await this.startSharedAudioMeter();

    // Start continuous wake-word detection
    if (this.isWakeWordEnabled) {
      this.startWakeWordListening();
    } else {
      this.transitionTo('PAUSED', 'wake_disabled');
    }
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
      if (document.visibilityState === 'visible') {
        console.info('[VoiceLifecycle] App active/visible: checking and restoring voice engine...');
        if (this.permissionState === 'granted') {
          if (!this.isRecognitionRunning && this.isWakeWordEnabled) {
            this.startWakeWordListening();
          }
        }
      } else {
        // App inactive/backgrounded: safely maintain or pause background speech recognition
        console.info('[VoiceLifecycle] App in background');
      }
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

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn('[VoiceLifecycle] SpeechRecognition API is unsupported in this browser.');
      this.callbacks?.onError('SpeechRecognition API unsupported in browser', true);
      return false;
    }

    // Reuse existing running session if mode matches and recognition is alive
    if (this.recognition && this.isRecognitionRunning) {
      return true;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }

    try {
      const rec = new SpeechRecognitionClass();
      this.recognition = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 2;

      rec.onstart = () => {
        this.isRecognitionRunning = true;
        this.consecutiveErrors = 0;
        this.lastEvent = 'recognition_onstart';
      };

      rec.onresult = (event: any) => {
        // -------------------------------------------------------------
        // BARGE-IN & INTERRUPTION HANDLING (While RODEX is speaking)
        // -------------------------------------------------------------
        if (this.isSelfSpeaking || rodexSynth.isSpeaking() || this.state === 'SPEAKING') {
          // Grace period: ignore microphone input during the first 750ms of speech output
          // to prevent false triggering from speaker output onset or chimes
          if (Date.now() - this.ttsStartTime < 750) {
            return;
          }

          let speechDuringTTS = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            speechDuringTTS += event.results[i][0].transcript;
          }
          const spoken = speechDuringTTS.trim();
          if (spoken.length > 2) {
            console.info('[VoiceLifecycle] User interruption detected during speech output:', spoken);
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

        this.lastCapturedTranscript = currentText;
        this.callbacks?.onTranscript(currentText, Boolean(finalTranscript));

        // In follow-up window, speech immediately cancels the window timeout
        if (this.followUpTimer) {
          clearTimeout(this.followUpTimer);
          this.followUpTimer = null;
        }

        // -------------------------------------------------------------
        // PASSIVE WAKE-WORD DETECTION (IDLE_LISTENING)
        // -------------------------------------------------------------
        if (this.state === 'IDLE_LISTENING') {
          const match = checkWakeWordMatch(currentText, this.customWakeWordConfig);

          if (match.isCall) {
            triggerHaptic('activate');
            playToneChime('wake');
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

          // Check if user says conversation exit (e.g., "stop", "cancel", "that's all", "goodbye")
          if (isConversationExit(effectiveCmd)) {
            console.info('[VoiceLifecycle] User requested conversation exit in follow-up window:', effectiveCmd);
            this.clearTimers();
            this.startWakeWordListening();
            return;
          }

          // If user repeated pure wake word (e.g., "Hey RODEX"), re-trigger wake detection
          if (wakeCheck.isCall && !effectiveCmd.trim()) {
            triggerHaptic('activate');
            playToneChime('wake');
            this.transitionTo('WAKE_DETECTED', 'wake_matched_in_followup');
            this.callbacks?.onWakeDetected(true, '');
            return;
          }

          // Natural 900ms silence boundary for responsive turn-taking
          this.silenceTimer = setTimeout(() => {
            if (effectiveCmd.trim()) {
              this.callbacks?.onCommandCaptured(effectiveCmd.trim());
            }
          }, 900);
        }
      };

      rec.onerror = (event: any) => {
        const errType = event?.error || 'unknown';
        this.lastError = errType;

        if (errType === 'no-speech') {
          return;
        }

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          this.permissionState = 'denied';
          this.stopAll();
          this.transitionTo('PERMISSION_REVOKED', 'not_allowed_error');
          this.callbacks?.onError('Microphone access requires user permission', true);
          return;
        }

        if (errType === 'aborted') {
          return;
        }

        this.consecutiveErrors++;
        console.warn('[VoiceLifecycle] Recognition error:', errType, `Streak: ${this.consecutiveErrors}`);

        if (this.consecutiveErrors > 5) {
          this.callbacks?.onError(`Speech recognition error: ${errType}`, false);
        }
      };

      rec.onend = () => {
        this.isRecognitionRunning = false;
        this.lastEvent = 'recognition_onend';

        // Auto-restart if in an active listening state and permission is granted
        if (
          this.permissionState === 'granted' &&
          (this.state === 'IDLE_LISTENING' || this.state === 'LISTENING' || this.state === 'FOLLOW_UP_READY')
        ) {
          this.reconnectAttempts++;
          const backoff = Math.min(1000, 150 + this.consecutiveErrors * 200);
          this.restartBackoffTimer = setTimeout(() => {
            if (this.permissionState === 'granted' && this.state !== 'PAUSED') {
              this.initOrResumeRecognition(mode);
            }
          }, backoff);
        }
      };

      rec.start();
      return true;
    } catch (err: any) {
      console.warn('[VoiceLifecycle] Failed starting speech recognition:', err?.message || err);
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
