/**
 * RODEX Gemini 3.8 Live API Client Service
 *
 * Implements low-latency, real-time bidirectional audio & voice conversation
 * using model `gemini-3.8-live` and Google Maps Grounding over WebSockets.
 *
 * Audio Input: 16kHz 16-bit Linear PCM Little-Endian
 * Audio Output: 24kHz 16-bit Linear PCM Little-Endian with gapless scheduling
 */

export type LiveSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface LiveServiceCallbacks {
  onStatusChange?: (status: LiveSessionStatus) => void;
  onAudioLevel?: (inputLevel: number, outputLevel: number) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError?: (errorMessage: string) => void;
  onGrounding?: (metadata: any) => void;
}

export class LiveConversationService {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Gapless audio scheduling queue
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private status: LiveSessionStatus = 'disconnected';
  private callbacks: LiveServiceCallbacks = {};

  // Audio level monitoring
  private outputAnalyser: AnalyserNode | null = null;
  private levelAnimFrame: number | null = null;
  private currentInputLevel = 0;
  private currentOutputLevel = 0;

  constructor(callbacks?: LiveServiceCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: LiveServiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
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

  /**
   * Start the real-time Gemini 3.8 Live API session
   */
  public async start(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    this.setStatus('connecting');

    try {
      // 1. Initialize Audio Contexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      // 16kHz for input mic capture per Gemini Live API spec
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      // 24kHz for model output audio playback
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });

      // Output Analyser for visualizer/Orb reactive waveform
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.connect(this.outputAudioCtx.destination);

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      // 2. Request microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 3. Connect WebSocket to server Live endpoint
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.info('[RODEX Live] WebSocket connected to Gemini 3.8 Live API');
        this.setStatus('connected');
        this.startMicProcessing();
        this.startAudioLevelLoop();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (err) {
          console.error('[RODEX Live] Failed parsing server message', err);
        }
      };

      this.ws.onclose = () => {
        console.info('[RODEX Live] WebSocket closed');
        this.stop();
      };

      this.ws.onerror = (err) => {
        console.error('[RODEX Live] WebSocket error', err);
        this.callbacks.onError?.('Failed communicating with Gemini Live API');
        this.setStatus('error');
      };
    } catch (err: any) {
      console.error('[RODEX Live Start Error]', err);
      this.stop();
      this.setStatus('error');
      this.callbacks.onError?.(err?.message || 'Could not start Live Voice session.');
      throw err;
    }
  }

  /**
   * Process microphone audio frames and send to Live API WebSocket
   */
  private startMicProcessing() {
    if (!this.inputAudioCtx || !this.mediaStream || !this.ws) return;

    this.micSource = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    // Buffer size 2048 or 4096 samples
    this.audioProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

    this.audioProcessor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      const inputChannelData = e.inputBuffer.getChannelData(0);

      // Compute RMS volume for live audio level
      let sum = 0;
      for (let i = 0; i < inputChannelData.length; i++) {
        sum += inputChannelData[i] * inputChannelData[i];
      }
      const rms = Math.sqrt(sum / inputChannelData.length);
      this.currentInputLevel = Math.min(1, rms * 4.5);

      // Convert Float32 to 16-bit Linear PCM Little-Endian
      const pcm16Buffer = this.float32ToPcm16(inputChannelData);
      const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

      // Send to WebSocket server
      this.ws.send(
        JSON.stringify({
          audio: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        })
      );
    };

    this.micSource.connect(this.audioProcessor);
    this.audioProcessor.connect(this.inputAudioCtx.destination);
    this.setStatus('listening');
  }

  /**
   * Handle incoming WebSocket messages from the Gemini Live server
   */
  private handleServerMessage(data: any) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'connected':
        console.info('[RODEX Live] Session established:', data);
        this.setStatus('listening');
        break;

      case 'audio':
        if (data.audio) {
          this.playAudioChunk(data.audio);
        }
        break;

      case 'output_transcript':
        if (data.text) {
          this.callbacks.onOutputTranscript?.(data.text);
        }
        break;

      case 'input_transcript':
        if (data.text) {
          this.callbacks.onInputTranscript?.(data.text);
        }
        break;

      case 'interrupted':
        console.info('[RODEX Live] Model output interrupted by user');
        this.stopAllPlayback();
        this.setStatus('listening');
        this.callbacks.onInterrupted?.();
        break;

      case 'turn_complete':
        this.callbacks.onTurnComplete?.();
        break;

      case 'grounding':
        if (data.metadata) {
          this.callbacks.onGrounding?.(data.metadata);
        }
        break;

      case 'error':
        console.error('[RODEX Live Server Error]', data.error);
        this.callbacks.onError?.(data.error);
        break;

      case 'session_closed':
        this.stop();
        break;
    }
  }

  /**
   * Play real-time audio chunk with gapless scheduling
   */
  private playAudioChunk(base64Pcm: string) {
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume().catch(() => {});
    }

    try {
      const audioBuffer = this.pcm16ToAudioBuffer(this.outputAudioCtx, base64Pcm);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect through output analyser to speakers
      source.connect(this.outputAnalyser);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      this.isSpeaking = true;
      this.setStatus('speaking');

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0) {
          this.isSpeaking = false;
          if (this.status === 'speaking') {
            this.setStatus('listening');
          }
        }
      };
    } catch (err) {
      console.error('[RODEX Live Audio Decode/Play Error]', err);
    }
  }

  /**
   * Stop all active and scheduled audio buffer sources (instant interruption)
   */
  public stopAllPlayback() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    this.isSpeaking = false;
    this.currentOutputLevel = 0;
  }

  /**
   * Send a text message turn into the Live session
   */
  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
      this.setStatus('thinking');
    }
  }

  /**
   * Send video/camera snapshot frame to Live session
   */
  public sendVideoFrame(base64Jpeg: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ video: base64Jpeg, mimeType: 'image/jpeg' }));
    }
  }

  /**
   * Continuous animation loop to measure and report input/output audio volume
   */
  private startAudioLevelLoop() {
    const updateLevels = () => {
      if (!this.outputAnalyser) return;

      // Output level calculation
      const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
      this.outputAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length || 1);
      this.currentOutputLevel = this.isSpeaking ? Math.min(1, avg / 128) : 0;

      // Report combined or individual levels
      this.callbacks.onAudioLevel?.(this.currentInputLevel, this.currentOutputLevel);

      this.levelAnimFrame = requestAnimationFrame(updateLevels);
    };

    this.levelAnimFrame = requestAnimationFrame(updateLevels);
  }

  /**
   * Stop and clean up all Live session resources
   */
  public stop() {
    this.stopAllPlayback();

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

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (_) {}
      this.ws = null;
    }

    this.currentInputLevel = 0;
    this.currentOutputLevel = 0;
    this.setStatus('disconnected');
  }

  // --- AUDIO UTILITIES ---

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
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private pcm16ToAudioBuffer(ctx: AudioContext, base64Pcm: string): AudioBuffer {
    const binary = atob(base64Pcm);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      channelData[i] = int16[i] / 32768.0;
    }
    return audioBuffer;
  }
}

export const globalLiveConversationService = new LiveConversationService();
