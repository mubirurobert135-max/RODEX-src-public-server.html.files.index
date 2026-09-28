// Web Audio API Synthesized Beatbox Engine for RODEX
// Zero-copyright, zero-asset, high-performance percussive sound synthesis

class BeatboxSynthesizer {
  private ctx: AudioContext | null = null;
  private intervalId: any = null;
  private isPlaying: boolean = false;
  private tempo: number = 110; // BPM
  private pattern: string[] = ['K', 'H', 'S', 'H', 'K', 'K', 'S', 'H']; // 8-step sequence
  private onBeatCallback?: (level: number) => void;
  private stepIndex: number = 0;

  constructor() {}

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const size = sampleRate * 0.4; // 0.4 seconds of noise
    const buffer = this.ctx!.createBuffer(1, size, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playKick(time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Deep heavy kick pitch sweep
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.18);

    // Dynamic amplitude envelope
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSnare(time: number) {
    if (!this.ctx) return;
    // White noise snare core
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, time);

    const gain = this.ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    // Snare tone harmonic transient
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    oscGain.gain.setValueAtTime(0.25, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    noise.start(time);
    noise.stop(time + 0.15);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playHat(time: number) {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    // Short crisp hi-hat tick
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  public play(onBeat?: (level: number) => void) {
    this.initCtx();
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;
    this.onBeatCallback = onBeat;
    this.stepIndex = 0;

    const beatDurationMs = (60 / this.tempo / 2) * 1000; // Eighth notes interval

    const scheduleNextStep = () => {
      if (!this.isPlaying || !this.ctx) return;

      const time = this.ctx.currentTime + 0.02;
      const stepType = this.pattern[this.stepIndex % this.pattern.length];

      if (stepType === 'K') {
        this.playKick(time);
        this.onBeatCallback?.(0.65);
      } else if (stepType === 'S') {
        this.playSnare(time);
        this.onBeatCallback?.(0.5);
      } else if (stepType === 'H') {
        this.playHat(time);
        this.onBeatCallback?.(0.2);
      }

      this.stepIndex++;
      this.intervalId = setTimeout(scheduleNextStep, beatDurationMs);
    };

    scheduleNextStep();
  }

  public setTempo(bpm: number) {
    this.tempo = bpm;
  }

  public getTempo(): number {
    return this.tempo;
  }

  public setPattern(pattern: string[]) {
    this.pattern = pattern;
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const rodexBeatbox = new BeatboxSynthesizer();
