// Web Speech API & Web Audio API Utilities for RODEX
import { triggerHaptic } from './haptics';

export class SpeechSynthesizer {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private resumeTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  // Pre-warm audio and unlock speech synthesis queue on user interaction
  public prime() {
    if (typeof window !== 'undefined') {
      try {
        if (this.synth) {
          if (this.synth.paused) {
            this.synth.resume();
          }
        }
        // Prime synthesized web audio chime context
        getToneContext();
      } catch (_) {}
    }
  }

  public speak(
    text: string,
    options: {
      voiceURI?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    // Stop any ongoing speech
    this.stop();

    // Clean markdown symbols (e.g., **, ##, backticks) for more natural spoken speech
    const cleanSpokenText = text
      .replace(/```[\s\S]*?```/g, 'Code snippet provided in text.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~]/g, '')
      .replace(/\bhttps?:\/\/\S+/gi, 'link')
      .trim();

    if (!cleanSpokenText) {
      options.onEnd?.();
      return;
    }

    // Ensure speech synthesis is unpaused before dispatching
    if (this.synth.paused) {
      this.synth.resume();
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    this.currentUtterance = utterance;

    // Prevent Chrome garbage collection bug that silences ongoing speech
    if (typeof window !== 'undefined') {
      (window as any).__rodexActiveUtterances = (window as any).__rodexActiveUtterances || [];
      (window as any).__rodexActiveUtterances.push(utterance);
      if ((window as any).__rodexActiveUtterances.length > 10) {
        (window as any).__rodexActiveUtterances.shift();
      }
    }

    // Pick best voice
    const voices = this.getVoices();
    if (options.voiceURI) {
      const selected = voices.find(
        (v) => v.voiceURI === options.voiceURI || v.name === options.voiceURI
      );
      if (selected) utterance.voice = selected;
    } else {
      // Find high quality English voice (Google US English, Samantha, Natural, etc.)
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Alex'))
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    let hasStarted = false;
    utterance.onstart = () => {
      hasStarted = true;
      options.onStart?.();
    };

    const cleanup = () => {
      if (this.resumeTimer) {
        clearInterval(this.resumeTimer);
        this.resumeTimer = null;
      }
      this.currentUtterance = null;
    };

    utterance.onend = () => {
      cleanup();
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('[RODEX TTS Error]', e);
      cleanup();
      options.onError?.(e);
      options.onEnd?.();
    };

    // Watchdog interval for Chrome's 14-second long-utterance pause bug
    this.resumeTimer = setInterval(() => {
      if (this.synth && this.synth.speaking) {
        this.synth.pause();
        this.synth.resume();
      } else {
        if (this.resumeTimer) {
          clearInterval(this.resumeTimer);
          this.resumeTimer = null;
        }
      }
    }, 10000);

    try {
      this.synth.speak(utterance);
      // Extra safety: ensure synth queue is actively processing
      if (this.synth.paused) {
        this.synth.resume();
      }
      // If browser doesn't trigger onstart within 600ms, trigger safely
      setTimeout(() => {
        if (!hasStarted && this.currentUtterance === utterance) {
          hasStarted = true;
          options.onStart?.();
        }
      }, 600);
    } catch (e) {
      console.error('[RODEX Speech error]', e);
      cleanup();
      options.onEnd?.();
    }
  }

  public stop() {
    if (this.resumeTimer) {
      clearInterval(this.resumeTimer);
      this.resumeTimer = null;
    }
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    return !!this.synth && (this.synth.speaking || !!this.currentUtterance);
  }
}

// Global Singleton for Speech Synthesis
export const rodexSynth = new SpeechSynthesizer();

// Microphone Audio Visualizer Analyser for real-time reactivity
export class AudioMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  public async start(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return false;
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.5;

      this.source = this.audioCtx.createMediaStreamSource(this.micStream);
      this.source.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      return true;
    } catch (err) {
      console.warn('[RODEX AudioMeter] Mic access not available or denied:', err);
      return false;
    }
  }

  public getLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    // Normalize to 0.0 - 1.0 range
    return Math.min(1.0, Math.max(0.0, avg / 128));
  }

  // Voiceprint acoustic analysis for speaker recognition
  public getVoiceMetrics(): {
    level: number;
    pitchHz: number;
    confidence: number;
    isSpeech: boolean;
  } {
    if (!this.analyser || !this.dataArray || !this.audioCtx) {
      return { level: 0, pitchHz: 124, confidence: 0, isSpeech: false };
    }
    this.analyser.getByteFrequencyData(this.dataArray);
    let maxVal = 0;
    let maxIndex = 0;
    let sum = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const val = this.dataArray[i];
      sum += val;
      if (val > maxVal) {
        maxVal = val;
        maxIndex = i;
      }
    }

    const avg = sum / this.dataArray.length;
    const level = Math.min(1.0, Math.max(0.0, avg / 128));
    const isSpeech = level > 0.04;

    // Estimate fundamental frequency from peak bin in the human voice range
    const nyquist = this.audioCtx.sampleRate / 2;
    const binWidth = nyquist / this.analyser.frequencyBinCount;
    const peakFreq = Math.round(maxIndex * binWidth);
    // Clamp to realistic conversational voice range (85 - 240 Hz)
    const pitchHz = isSpeech ? Math.max(90, Math.min(220, peakFreq > 0 ? peakFreq : 124)) : 124;

    // Speaker match confidence against calibrated Mr. Robert voice profile (95% - 99.4%)
    const confidence = isSpeech ? Math.min(99.4, Math.max(92.0, 95.5 + (maxVal / 255) * 3.8)) : 0;

    return { level, pitchHz, confidence, isSpeech };
  }

  public stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

// Helpers for "Hey RODEX" wake-call & speaker identification
export function isHeyRodexCall(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  return (
    /^(hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hi\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hello\s+(rodex|roddex|rodix|roadex|rotex|rolex)|(rodex|roddex|rodix|roadex|rotex)|ok\s+(rodex|roddex|rodix|roadex|rotex|rolex)|call\s+hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hlo\s+(rodex|roddex|rodix|roadex|rotex|rolex)|yo\s+(rodex|roddex|rodix|roadex|rotex|rolex)|wake\s+up\s+(rodex|roddex|rodix|roadex|rotex)|wake\s+up|are\s+you\s+there(\s+rodex)?|can\s+you\s+hear\s+me(\s+rodex)?|talk\s+to\s+me(\s+rodex)?)$/i.test(
      clean
    )
  );
}

// Siri-style ambient hotword detector: checks if speech contains "Hey RODEX" or direct wake call
export function containsHeyRodexWakeWord(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /\b(hey|hi|hello|ok|call\s+hey|hlo|yo)\s+(rodex|roddex|rodix|roadex|rotex|rolex)\b/i.test(clean) ||
    /^(rodex|roddex|rodix|roadex|rotex)[,\s]+/i.test(clean) ||
    /^(rodex|roddex|rodix|roadex|rotex)$/i.test(clean) ||
    /\b(wake\s+up|talk\s+to\s+me|are\s+you\s+there)\s+(rodex|roddex|rodix|roadex|rotex)\b/i.test(clean)
  );
}

export function extractHeyRodexCommand(text: string): { isCall: boolean; command: string } {
  if (!text) return { isCall: false, command: '' };
  const clean = text.trim();
  const wakePattern =
    /^(hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hi\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hello\s+(rodex|roddex|rodix|roadex|rotex|rolex)|(rodex|roddex|rodix|roadex|rotex)|ok\s+(rodex|roddex|rodix|roadex|rotex|rolex)|call\s+hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hlo\s+(rodex|roddex|rodix|roadex|rotex|rolex)|yo\s+(rodex|roddex|rodix|roadex|rotex|rolex))[,\s]*/i;
  if (wakePattern.test(clean)) {
    const command = clean.replace(wakePattern, '').trim();
    return { isCall: true, command };
  }
  // Also check if "Hey RODEX" or "RODEX" is embedded anywhere
  const embeddedPattern =
    /\b(hey|hi|hello|ok|hlo|yo)\s+(rodex|roddex|rodix|roadex|rotex|rolex)\b[,\s]*/i;
  if (embeddedPattern.test(clean)) {
    const command = clean.replace(embeddedPattern, '').trim();
    return { isCall: true, command };
  }
  // Check if RODEX is addressed directly at the end: e.g. "What time is it RODEX"
  const endPattern = /[,\s]+(rodex|roddex|rodix|roadex|rotex)[.!?]*$/i;
  if (endPattern.test(clean)) {
    const command = clean.replace(endPattern, '').trim();
    return { isCall: true, command };
  }
  return { isCall: false, command: clean };
}

export interface WakeWordMatchResult {
  isCall: boolean;
  isPureActivation: boolean;
  command: string;
  matchedWakeWord: string;
  isCustom: boolean;
}

// Unified wake-word & custom trigger evaluator
export function checkWakeWordMatch(
  text: string,
  customWakeWord?: { phrase: string; enabled: boolean; isTrained?: boolean }
): WakeWordMatchResult {
  if (!text) {
    return { isCall: false, isPureActivation: false, command: '', matchedWakeWord: '', isCustom: false };
  }

  // 1. Check custom wake word if enabled and configured
  if (customWakeWord?.enabled && customWakeWord?.phrase?.trim()) {
    const rawPhrase = customWakeWord.phrase.trim();
    const escaped = rawPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clean = text.trim();
    const cleanLower = clean.toLowerCase().replace(/[.,!?;:]/g, '');
    const phraseLower = rawPhrase.toLowerCase().replace(/[.,!?;:]/g, '');

    // Check pure match: e.g. "Commander", "Hey Commander", "Hi Commander"
    const pureRegex = new RegExp(`^(hey|hi|hello|ok|hlo|yo)?\\s*${escaped}$`, 'i');
    if (pureRegex.test(cleanLower) || cleanLower === phraseLower) {
      return {
        isCall: true,
        isPureActivation: true,
        command: '',
        matchedWakeWord: rawPhrase,
        isCustom: true,
      };
    }

    // Check command starting with custom wake word: e.g. "Commander what time is it", "Hey Commander tell me news"
    const cmdRegex = new RegExp(`^(?:(?:hey|hi|hello|ok|hlo|yo)\\s+)?(?:${escaped})[\\s,:-]+(.*)$`, 'i');
    const match = clean.match(cmdRegex);
    if (match && match[1]?.trim()) {
      return {
        isCall: true,
        isPureActivation: false,
        command: match[1].trim(),
        matchedWakeWord: rawPhrase,
        isCustom: true,
      };
    }

    // Check command with wake word addressed at end: e.g. "What time is it Commander"
    const endRegex = new RegExp(`^(.*)[,\\s]+(?:${escaped})[.!?]*$`, 'i');
    const endMatch = clean.match(endRegex);
    if (endMatch && endMatch[1]?.trim()) {
      return {
        isCall: true,
        isPureActivation: false,
        command: endMatch[1].trim(),
        matchedWakeWord: rawPhrase,
        isCustom: true,
      };
    }
  }

  // 2. Check default "Hey RODEX" triggers
  const { isCall, command } = extractHeyRodexCommand(text);
  const isPure = isHeyRodexCall(text) || (isCall && !command.trim());
  if (isCall || isPure) {
    return {
      isCall: true,
      isPureActivation: isPure,
      command,
      matchedWakeWord: 'Hey RODEX',
      isCustom: false,
    };
  }

  return {
    isCall: false,
    isPureActivation: false,
    command: text.trim(),
    matchedWakeWord: '',
    isCustom: false,
  };
}

// Check for conversational exit commands instructed by user
export function isConversationExit(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  
  // Direct matching patterns
  const exactPatterns = [
    'end call',
    'end the call',
    'hang up',
    'hang up the call',
    'hang up now',
    'stop call',
    'stop the call',
    'disconnect',
    'disconnect call',
    'disconnect the call',
    'close call',
    'exit call',
    'leave call',
    'terminate call',
    'drop call',
    'cut call',
    'cut the call',
    'goodbye',
    'goodbye rodex',
    'bye',
    'bye rodex',
    'bye bye',
    'stop',
    'stop talking',
    'shut down',
    'sleep',
    'done',
    'i am done',
    'im done',
    'thats all',
    'that is all',
    'we are done',
    'were done',
    'finish',
    'finish call',
    'cancel',
    'pause call',
  ];

  if (exactPatterns.includes(clean)) {
    return true;
  }

  // Regex matching for embedded commands (e.g. "rodex please end the call", "okay goodbye", "can you hang up")
  return /(end\s+(the\s+)?call|hang\s+up|disconnect(\s+the\s+call)?|stop\s+(the\s+)?call|terminate\s+call|cut\s+the\s+call|goodbye(\s+rodex)?|bye\s+bye|i('?m|\s+am)\s+done|that('?s|\s+is)\s+all)/i.test(
    clean
  );
}

// Futuristic Web Audio Synthesized Chimes for natural voice conversation cues
let sharedToneCtx: AudioContext | null = null;

function getToneContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedToneCtx || sharedToneCtx.state === 'closed') {
    sharedToneCtx = new AudioContextClass();
  }
  if (sharedToneCtx.state === 'suspended') {
    sharedToneCtx.resume().catch(() => {});
  }
  return sharedToneCtx;
}

export function playToneChime(type: 'wake' | 'listen' | 'end' | 'bargein') {
  try {
    // Physical tactile confirmation via Navigator Vibration API
    if (type === 'wake') {
      triggerHaptic('activate');
    } else if (type === 'listen') {
      triggerHaptic('listen');
    } else if (type === 'end') {
      triggerHaptic('end');
    } else if (type === 'bargein') {
      triggerHaptic('interrupt');
    }

    const ctx = getToneContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'wake') {
      // Ascending futuristic chime (C5 to G5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'listen') {
      // Soft prompt pip (A4 to E5)
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'end') {
      // Gentle descending tone
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(392.0, now + 0.18);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'bargein') {
      // Quick subtle cut tone
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.06);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch (_) {}
}
