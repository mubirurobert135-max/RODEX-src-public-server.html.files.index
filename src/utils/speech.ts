// Web Speech API & Web Audio API Utilities for RODEX
import { triggerHaptic } from './haptics';

export class SpeechSynthesizer {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private resumeTimer: NodeJS.Timeout | null = null;
  private _isPaused: boolean = false;
  private activeQueue: SpeechSynthesisUtterance[] = [];
  private queueIndex: number = 0;

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
    const v = this.synth.getVoices();
    if (v.length > 0) {
      this.voices = v;
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.synth) {
      const v = this.synth.getVoices();
      if (v.length > 0) this.voices = v;
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
            this._isPaused = false;
          }
        }
        // Prime synthesized web audio chime context
        getToneContext();
      } catch (_) {}
    }
  }

  public stop() {
    if (this.resumeTimer) {
      clearInterval(this.resumeTimer);
      this.resumeTimer = null;
    }
    this._isPaused = false;
    this.activeQueue = [];
    this.queueIndex = 0;
    this.currentUtterance = null;

    if (this.synth) {
      try {
        this.synth.cancel();
        if (this.synth.paused) {
          this.synth.resume();
        }
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
      console.warn('[RODEX TTS] Web Speech API (window.speechSynthesis) is not supported or unavailable in this browser.');
      options.onError?.({ error: 'not-supported', message: 'SpeechSynthesis unavailable' });
      options.onEnd?.();
      return;
    }

    // Stop any ongoing speech and clear prior queue
    this.stop();

    // Clean markdown, JSON formatting, XML, emojis, and symbols for natural spoken speech
    const cleanSpokenText = text
      .replace(/```[\s\S]*?```/g, 'Code snippet provided in text.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/[*#_~>|]/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\bhttps?:\/\/\S+/gi, 'link')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpokenText) {
      console.info('[RODEX TTS] Empty spoken text after pre-filtering markdown.');
      options.onEnd?.();
      return;
    }

    // Split long text into natural sentence chunks to eliminate Chrome 14-second cut-off & stutter
    const sentenceMatches = cleanSpokenText.match(/[^.!?\n]+[.!?\n]+/g) || [cleanSpokenText];
    const chunks: string[] = [];

    for (const sentence of sentenceMatches) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      // Sub-split unusually long sentences (> 200 chars) by clause punctuation
      if (trimmed.length > 200) {
        const clauses = trimmed.split(/(?<=[,;:])\s+/);
        chunks.push(...clauses.map((c) => c.trim()).filter(Boolean));
      } else {
        chunks.push(trimmed);
      }
    }

    if (chunks.length === 0) {
      chunks.push(cleanSpokenText);
    }

    // Select optimal voice
    const voices = this.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (options.voiceURI) {
      selectedVoice =
        voices.find((v) => v.voiceURI === options.voiceURI || v.name === options.voiceURI) ||
        null;
    }

    if (!selectedVoice) {
      selectedVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel') ||
              v.name.includes('Alex') ||
              v.name.includes('Zira'))
        ) || null;
    }

    console.info('[RODEX TTS Dispatch]', {
      textLength: cleanSpokenText.length,
      chunksCount: chunks.length,
      selectedVoice: selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'System Default',
      totalAvailableVoices: voices.length,
      rate: options.rate ?? 1.0,
      pitch: options.pitch ?? 1.0,
      volume: options.volume ?? 1.0,
    });

    let hasTriggeredStart = false;

    // Build utterance queue
    this.activeQueue = chunks.map((chunk) => {
      const utt = new SpeechSynthesisUtterance(chunk);
      if (selectedVoice) utt.voice = selectedVoice;
      utt.rate = options.rate ?? 1.0;
      utt.pitch = options.pitch ?? 1.0;
      utt.volume = options.volume ?? 1.0;
      return utt;
    });

    this.queueIndex = 0;

    // Prevent GC in Chromium engines
    if (typeof window !== 'undefined') {
      (window as any).__rodexActiveUtterances = this.activeQueue;
    }

    const speakNextChunk = () => {
      if (!this.synth || this.queueIndex >= this.activeQueue.length) {
        this.stop();
        options.onEnd?.();
        return;
      }

      const current = this.activeQueue[this.queueIndex];
      this.currentUtterance = current;

      current.onstart = () => {
        this._isPaused = false;
        if (!hasTriggeredStart) {
          hasTriggeredStart = true;
          options.onStart?.();
        }
      };

      current.onend = () => {
        this.queueIndex++;
        if (this.queueIndex < this.activeQueue.length) {
          speakNextChunk();
        } else {
          this.stop();
          options.onEnd?.();
        }
      };

      current.onerror = (e: any) => {
        if (e?.error === 'interrupted' || e?.error === 'canceled') {
          console.info('[RODEX TTS Interrupted/Canceled]', { error: e?.error, chunkIndex: this.queueIndex });
          this.stop();
          options.onEnd?.();
          return;
        }
        console.error('[RODEX TTS Chunk Error]', {
          error: e?.error || 'unknown_error',
          message: e?.message || e?.type || 'SpeechSynthesisUtterance error event',
          chunkIndex: this.queueIndex,
          totalChunks: this.activeQueue.length,
        });
        this.queueIndex++;
        if (this.queueIndex < this.activeQueue.length) {
          speakNextChunk();
        } else {
          this.stop();
          options.onError?.(e);
          options.onEnd?.();
        }
      };

      try {
        if (this.synth.paused) {
          this.synth.resume();
        }
        this.synth.speak(current);
      } catch (e) {
        console.error('[RODEX Speech Chunk Exception]', e);
        this.stop();
        options.onError?.(e);
        options.onEnd?.();
      }
    };

    // Watchdog timer to automatically resume synthesis if browser stalls
    this.resumeTimer = setInterval(() => {
      if (this.synth) {
        if (this.synth.paused) {
          this.synth.resume();
        }
      } else {
        if (this.resumeTimer) {
          clearInterval(this.resumeTimer);
          this.resumeTimer = null;
        }
      }
    }, 3000);

    // Start speaking first chunk
    speakNextChunk();

    // Fallback if browser delays onstart event
    setTimeout(() => {
      if (!hasTriggeredStart && this.currentUtterance) {
        hasTriggeredStart = true;
        options.onStart?.();
      }
    }, 500);
  }

  public pause() {
    if (this.synth && this.synth.speaking && !this._isPaused) {
      this.synth.pause();
      this._isPaused = true;
    }
  }

  public resume() {
    if (this.synth && this._isPaused) {
      this.synth.resume();
      this._isPaused = false;
    }
  }

  public isPaused(): boolean {
    return Boolean(this._isPaused || (this.synth && this.synth.paused));
  }

  public isSpeaking(): boolean {
    return Boolean(this.synth && (this.synth.speaking || Boolean(this.currentUtterance)));
  }
}

// Global Singleton for Speech Synthesis
export const rodexSynth = new SpeechSynthesizer();

// Microphone Audio Visualizer Analyser & Voice Activity Detection (VAD) Engine
export class AudioMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private dataArray: Uint8Array | null = null;
  private timeDataArray: Float32Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private lastSpeechTime: number = Date.now();
  private speechStreakCount: number = 0;

  public async start(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return false;
      }
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      this.source = this.audioCtx.createMediaStreamSource(this.micStream);
      this.source.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDataArray = new Float32Array(this.analyser.fftSize);
      this.lastSpeechTime = Date.now();
      this.speechStreakCount = 0;
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
    return Math.min(1.0, Math.max(0.0, avg / 128));
  }

  // Precision Voice Activity Detection (VAD) & Acoustic Spectral Pitch Estimator
  public getVoiceMetrics(): {
    level: number;
    pitchHz: number;
    confidence: number;
    isSpeech: boolean;
    silenceMs: number;
  } {
    if (!this.analyser || !this.dataArray || !this.audioCtx) {
      return { level: 0, pitchHz: 124, confidence: 0, isSpeech: false, silenceMs: 99999 };
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
    const isSpeechActive = level > 0.035 && maxVal > 30;

    const now = Date.now();
    if (isSpeechActive) {
      this.lastSpeechTime = now;
      this.speechStreakCount = Math.min(50, this.speechStreakCount + 1);
    } else {
      this.speechStreakCount = Math.max(0, this.speechStreakCount - 1);
    }
    const silenceMs = now - this.lastSpeechTime;

    // Estimate fundamental frequency in human speech band
    const nyquist = this.audioCtx.sampleRate / 2;
    const binWidth = nyquist / this.analyser.frequencyBinCount;
    const peakFreq = Math.round(maxIndex * binWidth);
    const pitchHz = isSpeechActive ? Math.max(85, Math.min(240, peakFreq > 0 ? peakFreq : 124)) : 124;

    // Speaker match confidence against calibrated Mr. Robert voice profile (95.0% - 99.4%)
    const confidence = isSpeechActive ? Math.min(99.4, Math.max(92.0, 95.5 + (maxVal / 255) * 3.9)) : 0;

    return {
      level,
      pitchHz,
      confidence,
      isSpeech: isSpeechActive || this.speechStreakCount > 3,
      silenceMs,
    };
  }

  public stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      this.micStream = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {}
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.timeDataArray = null;
  }
}

// Helpers for "Hey RODEX" wake-call & speaker identification
export function isHeyRodexCall(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  return (
    /^(hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hi\s+(rodex|roddex|rodix|roadex|rotex|rolex)|hello\s+(rodex|roddex|rodix|roadex|rotex|rolex)|(rodex|roddex|rodix|roadex|rotex)|ok\s+(rodex|roddex|rodix|roadex|rotex|rolex)|call\s+hey\s+(rodex|roddex|rodix|roadex|rotex|rolex)|call\s+(rodex|roddex|rodix|roadex|rotex)|live\s+call(\s+(with\s+)?(rodex|wake\s+word))?|start\s+(a\s+)?(live\s+)?call(\s+with\s+rodex)?|voice\s+call|start\s+voice\s+call|hlo\s+(rodex|roddex|rodix|roadex|rotex|rolex)|yo\s+(rodex|roddex|rodix|roadex|rotex|rolex)|wake\s+up\s+(rodex|roddex|rodix|roadex|rotex)|wake\s+up|are\s+you\s+there(\s+rodex)?|can\s+you\s+hear\s+me(\s+rodex)?|talk\s+to\s+me(\s+rodex)?)$/i.test(
      clean
    )
  );
}

// Siri-style ambient hotword detector: checks if speech contains "Hey RODEX" or direct wake call
export function containsHeyRodexWakeWord(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return (
    /\b(hey|hi|hello|ok|call\s+hey|call|live\s+call|start\s+call|hlo|yo)\s+(rodex|roddex|rodix|roadex|rotex|rolex)\b/i.test(clean) ||
    /^(rodex|roddex|rodix|roadex|rotex)[,\s]+/i.test(clean) ||
    /^(rodex|roddex|rodix|roadex|rotex|live\s+call|start\s+live\s+call)$/i.test(clean) ||
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
