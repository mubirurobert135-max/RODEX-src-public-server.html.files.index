// RODEX Unified Voice State-Machine & Instant Transition Engine
// Manages zero-latency, atomic, flicker-free state transitions between
// SPEAKING -> LISTENING (and all conversational phases) with pre-warmed audio pipelines.

import { VoiceEngineState, AssistantState } from '../types';
import { rodexSynth, playToneChime, AudioMeter } from './speech';
import { triggerHaptic } from './haptics';

export type VoicePhase =
  | 'IDLE'
  | 'WAKE_DETECTED'
  | 'LISTENING'
  | 'PROCESSING'
  | 'EXECUTING'
  | 'SPEAKING'
  | 'TRANSITIONING'
  | 'FOLLOW_UP_READY'
  | 'PAUSED'
  | 'ERROR';

export interface TransitionOptions {
  source?: string;
  reason?: string;
  followUpDurationMs?: number;
  skipChime?: boolean;
  skipHaptic?: boolean;
  initialTranscript?: string;
}

export type StateChangeObserver = (
  newPhase: VoicePhase,
  assistantState: AssistantState,
  transitionMeta: {
    fromPhase: VoicePhase;
    toPhase: VoicePhase;
    timestamp: number;
    latencyMs: number;
    sequenceId: number;
    source: string;
  }
) => void;

export class VoiceTransitionEngine {
  private static instance: VoiceTransitionEngine | null = null;

  private currentPhase: VoicePhase = 'IDLE';
  private sequenceCounter: number = 0;
  private lastTransitionTimestamp: number = performance.now();
  private observers: Set<StateChangeObserver> = new Set();

  // Pre-warmed audio pipeline references
  private audioMeter: AudioMeter | null = null;
  private isPreWarmed: boolean = false;
  private followUpTimer: NodeJS.Timeout | null = null;
  private pendingTransitionLock: boolean = false;

  // Echo cancellation grace buffer
  private lastTtsEndTime: number = 0;
  private acousticDampeningWindowMs: number = 100;

  private constructor() {
    // Singleton
  }

  public static getInstance(): VoiceTransitionEngine {
    if (!VoiceTransitionEngine.instance) {
      VoiceTransitionEngine.instance = new VoiceTransitionEngine();
    }
    return VoiceTransitionEngine.instance;
  }

  public setAudioMeter(meter: AudioMeter) {
    this.audioMeter = meter;
  }

  public subscribe(observer: StateChangeObserver): () => void {
    this.observers.add(observer);
    // Immediately emit current state to new subscriber
    observer(this.currentPhase, this.mapPhaseToAssistantState(this.currentPhase), {
      fromPhase: this.currentPhase,
      toPhase: this.currentPhase,
      timestamp: performance.now(),
      latencyMs: 0,
      sequenceId: this.sequenceCounter,
      source: 'subscription_initial',
    });

    return () => {
      this.observers.delete(observer);
    };
  }

  public getCurrentPhase(): VoicePhase {
    return this.currentPhase;
  }

  public isSpeaking(): boolean {
    return this.currentPhase === 'SPEAKING';
  }

  public isListening(): boolean {
    return this.currentPhase === 'LISTENING' || this.currentPhase === 'FOLLOW_UP_READY';
  }

  public isWithinAcousticDampeningWindow(): boolean {
    return performance.now() - this.lastTtsEndTime < this.acousticDampeningWindowMs;
  }

  /**
   * Pre-warms microphone analysis pipelines while AI is speaking
   * so that the instant speech completes, handoff latency is 0ms.
   */
  public preWarmMicrophonePipeline() {
    if (this.isPreWarmed) return;
    try {
      if (this.audioMeter) {
        this.audioMeter.start().then(() => {
          this.isPreWarmed = true;
        }).catch(() => {});
      }
    } catch (_) {}
  }

  /**
   * ATOMIC INSTANTANEOUS HANDOFF: SPEAKING -> LISTENING / FOLLOW_UP_READY
   * Guarantees 0ms flicker-free transition with no interim 'idle' emission.
   */
  public handoffSpeakingToListening(
    options: TransitionOptions = {},
    callbacks?: {
      onActivateMic?: () => void;
      onPrimeRecognition?: () => void;
    }
  ): number {
    const transitionStart = performance.now();
    const transitionToken = ++this.sequenceCounter;
    const previousPhase = this.currentPhase;

    this.pendingTransitionLock = true;
    this.lastTtsEndTime = transitionStart;

    // Clear any previous pending follow-up timers
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }

    // Step 1: Pre-activate hardware and recognition immediately in parallel
    try {
      callbacks?.onActivateMic?.();
      callbacks?.onPrimeRecognition?.();
    } catch (err) {
      console.warn('[VoiceTransitionEngine] Pipeline pre-activation notice:', err);
    }

    // Step 2: Atomic state switch to FOLLOW_UP_READY / LISTENING
    const targetPhase: VoicePhase = 'FOLLOW_UP_READY';
    this.currentPhase = targetPhase;

    if (!options.skipHaptic) {
      triggerHaptic('listen');
    }

    const duration = options.followUpDurationMs || 7000;
    const latencyMs = Math.round((performance.now() - transitionStart) * 100) / 100;

    console.info(`[VoiceTransitionEngine] Atomic Handoff: ${previousPhase} -> ${targetPhase} (${latencyMs}ms, seq #${transitionToken})`);

    // Step 3: Notify all subscribers synchronously
    const assistantState = this.mapPhaseToAssistantState(targetPhase);
    this.observers.forEach((obs) => {
      try {
        obs(targetPhase, assistantState, {
          fromPhase: previousPhase,
          toPhase: targetPhase,
          timestamp: transitionStart,
          latencyMs,
          sequenceId: transitionToken,
          source: options.source || 'speaking_onend_handoff',
        });
      } catch (err) {
        console.error('[VoiceTransitionEngine] Observer error:', err);
      }
    });

    this.pendingTransitionLock = false;

    // Step 4: Arm follow-up window expiration
    this.followUpTimer = setTimeout(() => {
      // Ensure no newer transition has occurred
      if (this.sequenceCounter === transitionToken && (this.currentPhase === 'FOLLOW_UP_READY' || this.currentPhase === 'LISTENING')) {
        console.info('[VoiceTransitionEngine] Follow-up window expired naturally -> Returning to IDLE');
        this.transitionTo('IDLE', { source: 'follow_up_timeout' });
      }
    }, duration);

    return transitionToken;
  }

  /**
   * ATOMIC TRANSITION: WAKE_DETECTED -> LISTENING
   */
  public transitionWakeToListening(options: TransitionOptions = {}): number {
    return this.transitionTo('LISTENING', {
      source: 'wake_to_listening',
      ...options,
    });
  }

  /**
   * ATOMIC TRANSITION: LISTENING -> PROCESSING (THINKING)
   */
  public transitionListeningToProcessing(options: TransitionOptions = {}): number {
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }
    return this.transitionTo('PROCESSING', {
      source: 'command_captured',
      ...options,
    });
  }

  /**
   * ATOMIC TRANSITION: PROCESSING -> SPEAKING
   */
  public transitionProcessingToSpeaking(options: TransitionOptions = {}): number {
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }
    // Pre-warm the microphone pipeline so that when speaking finishes, mic is already active
    this.preWarmMicrophonePipeline();

    return this.transitionTo('SPEAKING', {
      source: 'tts_start',
      ...options,
    });
  }

  /**
   * BARGE-IN INTERRUPTION HANDOFF:
   * When user starts speaking during AI speech output, halts TTS and switches instantly to LISTENING.
   */
  public executeBargeInInterruption(
    transcript: string,
    callbacks?: {
      onStopTTS?: () => void;
      onCommandCaptured?: (text: string) => void;
    }
  ): number {
    const transitionStart = performance.now();
    const token = ++this.sequenceCounter;
    const previous = this.currentPhase;

    console.info(`[VoiceTransitionEngine] Barge-In Interruption triggered! Halting TTS (Seq #${token})`);

    // 1. Immediately halt audio output
    try {
      callbacks?.onStopTTS?.();
      rodexSynth.stop();
    } catch (_) {}

    // 2. Play subtle cut chime & haptic
    playToneChime('bargein');
    triggerHaptic('interrupt');

    // 3. Atomically switch to LISTENING
    this.currentPhase = 'LISTENING';
    const latencyMs = Math.round((performance.now() - transitionStart) * 100) / 100;
    const assistantState = this.mapPhaseToAssistantState('LISTENING');

    this.observers.forEach((obs) => {
      try {
        obs('LISTENING', assistantState, {
          fromPhase: previous,
          toPhase: 'LISTENING',
          timestamp: transitionStart,
          latencyMs,
          sequenceId: token,
          source: 'barge_in_interruption',
        });
      } catch (e) {
        console.error('[VoiceTransitionEngine] Observer error:', e);
      }
    });

    return token;
  }

  /**
   * Generic atomic transition with monotonic sequence locking
   */
  public transitionTo(targetPhase: VoicePhase, options: TransitionOptions = {}): number {
    if (this.currentPhase === targetPhase && targetPhase !== 'FOLLOW_UP_READY') {
      return this.sequenceCounter;
    }

    const transitionStart = performance.now();
    const token = ++this.sequenceCounter;
    const previousPhase = this.currentPhase;

    if (targetPhase === 'IDLE' || targetPhase === 'PAUSED' || targetPhase === 'ERROR') {
      if (this.followUpTimer) {
        clearTimeout(this.followUpTimer);
        this.followUpTimer = null;
      }
    }

    this.currentPhase = targetPhase;
    const latencyMs = Math.round((performance.now() - transitionStart) * 100) / 100;
    const assistantState = this.mapPhaseToAssistantState(targetPhase);

    this.observers.forEach((obs) => {
      try {
        obs(targetPhase, assistantState, {
          fromPhase: previousPhase,
          toPhase: targetPhase,
          timestamp: transitionStart,
          latencyMs,
          sequenceId: token,
          source: options.source || 'state_transition',
        });
      } catch (err) {
        console.error('[VoiceTransitionEngine] Observer error:', err);
      }
    });

    return token;
  }

  public mapPhaseToAssistantState(phase: VoicePhase): AssistantState {
    switch (phase) {
      case 'IDLE':
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
      case 'ERROR':
        return 'error';
      case 'TRANSITIONING':
        return 'listening';
      default:
        return 'idle';
    }
  }

  public mapVoiceEngineStateToPhase(vState: VoiceEngineState): VoicePhase {
    switch (vState) {
      case 'IDLE_LISTENING':
      case 'MIC_READY':
        return 'IDLE';
      case 'WAKE_DETECTED':
        return 'WAKE_DETECTED';
      case 'LISTENING':
        return 'LISTENING';
      case 'FOLLOW_UP_READY':
        return 'FOLLOW_UP_READY';
      case 'PROCESSING':
        return 'PROCESSING';
      case 'EXECUTING':
        return 'EXECUTING';
      case 'SPEAKING':
        return 'SPEAKING';
      case 'PAUSED':
        return 'PAUSED';
      case 'ERROR':
      case 'MIC_UNAVAILABLE':
      case 'PERMISSION_REVOKED':
        return 'ERROR';
      default:
        return 'IDLE';
    }
  }
}

export const globalVoiceTransitionEngine = VoiceTransitionEngine.getInstance();
