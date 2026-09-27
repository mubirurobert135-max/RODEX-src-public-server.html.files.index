// RODEX Robust Continuous Speech Recognition & Ambient Wake-Word Manager
import {
  rodexSynth,
  playToneChime,
  extractHeyRodexCommand,
  checkWakeWordMatch,
  isConversationExit,
  AudioMeter,
} from './speech';
import { triggerHaptic } from './haptics';

export type RecognitionState =
  | 'idle'
  | 'listening_wake'
  | 'wake_detected'
  | 'listening_command'
  | 'processing'
  | 'speaking'
  | 'error';

export interface SpeechManagerCallbacks {
  onStateChange: (state: RecognitionState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onWakeDetected: (pureActivation: boolean, command: string) => void;
  onCommandCaptured: (command: string) => void;
  onError: (error: string, fatal: boolean) => void;
  onSpeechEnd: () => void;
}

export class SpeechRecognitionManager {
  private static instance: SpeechRecognitionManager | null = null;
  private recognition: any = null;
  private isRunning: boolean = false;
  private isContinuousWakeEnabled: boolean = true;
  private callbacks: SpeechManagerCallbacks | null = null;
  private restartTimeout: NodeJS.Timeout | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private customWakeWord?: { phrase: string; enabled: boolean; isTrained?: boolean };
  private micPermissionGranted: boolean = true;
  private currentMode: 'wake_detection' | 'command_capture' = 'wake_detection';
  private consecutiveErrors: number = 0;
  private activeUtteranceBuffer: string = '';
  private lastCapturedText: string = '';
  private isSelfSpeaking: boolean = false;
  private audioMeter: AudioMeter = new AudioMeter();
  private isAudioMeterActive: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      // Reconnect listeners on tab focus or visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isContinuousWakeEnabled && !this.isRunning) {
          this.restart('visibility_change');
        }
      });

      // Handle media device change (e.g. bluetooth headset plugged/unplugged)
      if (navigator.mediaDevices?.ondevicechange !== undefined) {
        navigator.mediaDevices.ondevicechange = () => {
          if (this.isContinuousWakeEnabled && this.isRunning) {
            this.restart('device_change');
          }
        };
      }
    }
  }

  public static getInstance(): SpeechRecognitionManager {
    if (!this.instance) {
      this.instance = new SpeechRecognitionManager();
    }
    return this.instance;
  }

  public setCallbacks(callbacks: SpeechManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public setCustomWakeWord(wakeWord?: { phrase: string; enabled: boolean; isTrained?: boolean }) {
    this.customWakeWord = wakeWord;
  }

  public setSelfSpeaking(speaking: boolean) {
    this.isSelfSpeaking = speaking;
  }

  public async startContinuousWakeListening(permissionGranted: boolean = true): Promise<boolean> {
    this.micPermissionGranted = permissionGranted;
    this.isContinuousWakeEnabled = true;
    this.currentMode = 'wake_detection';
    return this.initRecognition();
  }

  public stopAll() {
    this.isContinuousWakeEnabled = false;
    this.isRunning = false;
    this.clearTimers();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.stopAudioMeter();
    this.callbacks?.onStateChange('idle');
  }

  private clearTimers() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public async startCommandCapture(): Promise<void> {
    this.currentMode = 'command_capture';
    this.activeUtteranceBuffer = '';
    this.lastCapturedText = '';
    this.callbacks?.onStateChange('listening_command');
    await this.startAudioMeter();

    if (!this.isRunning) {
      this.initRecognition();
    }
  }

  private async startAudioMeter() {
    if (!this.isAudioMeterActive) {
      const ok = await this.audioMeter.start();
      this.isAudioMeterActive = ok;
    }
  }

  private stopAudioMeter() {
    if (this.isAudioMeterActive) {
      this.audioMeter.stop();
      this.isAudioMeterActive = false;
    }
  }

  private initRecognition(): boolean {
    if (typeof window === 'undefined') return false;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn('[SpeechManager] SpeechRecognition API not supported in this environment.');
      this.callbacks?.onError('SpeechRecognition not supported in browser', true);
      return false;
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
        this.isRunning = true;
        this.consecutiveErrors = 0;
        if (this.currentMode === 'wake_detection') {
          this.callbacks?.onStateChange('listening_wake');
        } else {
          this.callbacks?.onStateChange('listening_command');
        }
      };

      rec.onresult = (event: any) => {
        // Echo suppression: Ignore input while RODEX TTS is actively speaking
        if (this.isSelfSpeaking || rodexSynth.isSpeaking()) {
          // Check for user barge-in "stop" command
          let speechDuringTTS = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            speechDuringTTS += event.results[i][0].transcript;
          }
          if (isConversationExit(speechDuringTTS)) {
            rodexSynth.stop();
            this.setSelfSpeaking(false);
            playToneChime('bargein');
            this.startCommandCapture();
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

        this.lastCapturedText = currentText;
        this.callbacks?.onTranscript(currentText, Boolean(finalTranscript));

        // MODE 1: Ambient Wake Phrase Detection
        if (this.currentMode === 'wake_detection') {
          const matchResult = checkWakeWordMatch(currentText, this.customWakeWord);

          if (matchResult.isCall) {
            triggerHaptic('activate');
            playToneChime('wake');
            this.callbacks?.onStateChange('wake_detected');

            if (matchResult.isPureActivation) {
              // Pure activation: e.g. "Hello RODEX", "Hey RODEX", "RODEX"
              this.currentMode = 'command_capture';
              this.callbacks?.onWakeDetected(true, '');
            } else {
              // Full command combined: e.g. "Hello RODEX open YouTube"
              this.currentMode = 'command_capture';
              this.callbacks?.onWakeDetected(false, matchResult.command);
            }
          }
        }
        // MODE 2: Active Command Capture
        else if (this.currentMode === 'command_capture') {
          // Reset turn-taking silence timer on active speech
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }

          // Check for early wake command embedded
          const wakeCheck = extractHeyRodexCommand(currentText);
          const effectiveCmd = wakeCheck.isCall ? wakeCheck.command : currentText;

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

        if (errType === 'no-speech') {
          // Normal ambient silence, ignore and continue
          return;
        }

        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          this.micPermissionGranted = false;
          this.callbacks?.onError('Microphone permission denied', true);
          return;
        }

        if (errType === 'aborted') {
          // Aborted intentionally during mode transition, safe to ignore
          return;
        }

        this.consecutiveErrors++;
        console.warn('[SpeechManager Error]', errType, `Streak: ${this.consecutiveErrors}`);

        if (this.consecutiveErrors > 5) {
          this.callbacks?.onError(`Speech recognition error: ${errType}`, false);
        }
      };

      rec.onend = () => {
        this.isRunning = false;

        // Auto-restart if continuous listening is enabled and not manually stopped
        if (this.isContinuousWakeEnabled && this.micPermissionGranted) {
          const backoff = Math.min(1000, 150 + this.consecutiveErrors * 200);
          this.restartTimeout = setTimeout(() => {
            if (this.isContinuousWakeEnabled) {
              this.initRecognition();
            }
          }, backoff);
        }
      };

      rec.start();
      return true;
    } catch (err: any) {
      console.warn('[SpeechManager Init Exception]', err?.message || err);
      return false;
    }
  }

  private restart(reason: string) {
    this.clearTimers();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.initRecognition();
  }

  public getAudioMetrics() {
    return this.audioMeter.getVoiceMetrics();
  }
}

export const globalSpeechManager = SpeechRecognitionManager.getInstance();
