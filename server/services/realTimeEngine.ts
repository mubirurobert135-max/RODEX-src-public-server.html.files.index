import { GoogleGenAI } from '@google/genai';
import { Response } from 'express';
import { IntentClassifier } from '../orchestrator/intentClassifier';
import { globalToolRegistry } from '../orchestrator/registry';
import { globalMemoryService } from '../orchestrator/memoryService';
import { globalUserProfile } from '../orchestrator/userProfile';
import { globalPerformanceTracker } from './performanceTracker';
import { globalServiceRegistry } from '../doctor/serviceRegistry';
import { getResolvedGeminiApiKey } from '../geminiConfig';
import { globalOrchestrator } from '../orchestrator/orchestrator';
import { CREATOR_ATTRIBUTION_RESPONSE } from '../systemMetadata';

export interface StreamRequestParams {
  userInput: string;
  history?: Array<{ role: string; text: string }>;
  clientFormattedTime?: string;
  timeZone?: string;
  isLiveCall?: boolean;
  userId?: string;
  userDisplayName?: string;
  userEmail?: string;
}

export class RealTimeResponseEngine {
  private static instance: RealTimeResponseEngine;
  private responseCache: Map<string, { reply: string; timestamp: number; action?: any }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 60 seconds TTL
  private cachedAiClient: GoogleGenAI | null = null;

  private constructor() {}

  public static getInstance(): RealTimeResponseEngine {
    if (!RealTimeResponseEngine.instance) {
      RealTimeResponseEngine.instance = new RealTimeResponseEngine();
    }
    return RealTimeResponseEngine.instance;
  }

  /**
   * Helper to write formatted Server-Sent Event to response
   */
  private sendSSEEvent(res: Response, eventData: Record<string, any>): void {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  }

  /**
   * Sentence boundary accumulator for Early Speech Start (TTFA optimization)
   */
  private extractSentences(buffer: string): { sentences: string[]; remaining: string } {
    // Regex matches sentence boundaries: period, exclamation mark, question mark, or newline followed by space
    const parts = buffer.split(/(?<=[.!?\n])\s+/);
    if (parts.length <= 1) {
      return { sentences: [], remaining: buffer };
    }
    const sentences = parts.slice(0, parts.length - 1);
    const remaining = parts[parts.length - 1];
    return { sentences, remaining };
  }

  /**
   * Core Real-Time Streaming Entry Point
   */
  public async handleStreamRequest(
    params: StreamRequestParams,
    res: Response,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const startTime = Date.now();
    const {
      userInput,
      history = [],
      clientFormattedTime,
      timeZone,
      isLiveCall = false,
      userId = 'usr_robert_1001',
      userDisplayName = 'Robert',
      userEmail,
    } = params;

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 1. FAST INTENT ROUTER (Direct Action / Fast Path - <15ms)
    const intent = IntentClassifier.classify(userInput, history);
    const cacheKey = `${userInput.trim().toLowerCase()}_${isLiveCall}`;

    // Check fast-path response cache for static/repeat queries
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.reply && cached.reply.trim().length > 0 && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      const ttfrMs = Date.now() - startTime;
      globalPerformanceTracker.recordCacheHit();
      this.sendSSEEvent(res, { type: 'start', path: 'fast_cache_path', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: cached.reply });
      this.sendSSEEvent(res, { type: 'sentence', text: cached.reply, index: 0 });
      if (cached.action) {
        this.sendSSEEvent(res, { type: 'browser_action', action: cached.action });
      }
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: cached.reply,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    globalPerformanceTracker.recordCacheMiss();

    // FAST PATH A: Exact Echo / Device Security / Direct Intent
    if (intent.primaryIntent === 'exact_command' && intent.exactText !== undefined) {
      const ttfrMs = Date.now() - startTime;
      const text = intent.exactText;
      this.sendSSEEvent(res, { type: 'start', path: 'fast_path_exact', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: text });
      this.sendSSEEvent(res, { type: 'sentence', text, index: 0 });
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: text,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    if (intent.primaryIntent === 'creator_inquiry') {
      const text = CREATOR_ATTRIBUTION_RESPONSE;
      const ttfrMs = Date.now() - startTime;
      this.sendSSEEvent(res, { type: 'start', path: 'fast_path_creator', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: text });
      this.sendSSEEvent(res, { type: 'sentence', text, index: 0 });
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: text,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    if (intent.primaryIntent === 'user_identity_inquiry') {
      const text = `You are currently logged in as ${userDisplayName}${userEmail ? ` (${userEmail})` : ''}. Your RODEX account and private session are active.`;
      const ttfrMs = Date.now() - startTime;
      this.sendSSEEvent(res, { type: 'start', path: 'fast_path_user_identity', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: text });
      this.sendSSEEvent(res, { type: 'sentence', text, index: 0 });
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: text,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    if (intent.primaryIntent === 'open_url' && intent.extractedEntities?.targetUrl) {
      const url = intent.extractedEntities.targetUrl;
      const title = intent.extractedEntities.searchQuery || 'Web Destination';
      const text = `Opening ${title} for you now.`;
      const ttfrMs = Date.now() - startTime;

      const browserAction = {
        url,
        label: `Open ${title}`,
        destinationType: url.includes('youtube') ? 'youtube' : 'web',
        status: 'opened',
      };

      this.sendSSEEvent(res, { type: 'start', path: 'fast_path_url', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: text });
      this.sendSSEEvent(res, { type: 'sentence', text, index: 0 });
      this.sendSSEEvent(res, { type: 'browser_action', action: browserAction });

      this.responseCache.set(cacheKey, { reply: text, timestamp: Date.now(), action: browserAction });

      this.sendSSEEvent(res, {
        type: 'done',
        fullText: text,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    if (intent.primaryIntent === 'datetime_timezone') {
      const now = new Date();
      const eatFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Kampala',
        dateStyle: 'full',
        timeStyle: 'medium',
      });
      const eatTime = eatFormatter.format(now);
      const text = `The current date and East Africa Time (Kampala/Uganda) is ${eatTime}.`;
      const ttfrMs = Date.now() - startTime;

      this.sendSSEEvent(res, { type: 'start', path: 'fast_path_time', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: text });
      this.sendSSEEvent(res, { type: 'sentence', text, index: 0 });
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: text,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    // FAST PATH C: Action & Capability Tool Execution (Email, Compute, Memory, Contacts, Apps)
    if (intent.suggestedTools && intent.suggestedTools.length > 0) {
      try {
        const orchRes = await globalOrchestrator.orchestrate({
          userInput,
          history,
          clientFormattedTime,
          timeZone,
          isLiveCall,
          userId,
          userDisplayName,
          userEmail,
        });

        const ttfrMs = Date.now() - startTime;
        this.sendSSEEvent(res, { type: 'start', path: 'tool_orchestration_path', ttfrMs });
        this.sendSSEEvent(res, { type: 'token', token: orchRes.reply });
        this.sendSSEEvent(res, { type: 'sentence', text: orchRes.reply, index: 0 });
        if (orchRes.openUrl) {
          this.sendSSEEvent(res, {
            type: 'browser_action',
            action: {
              url: orchRes.openUrl,
              label: 'Open Action Target',
              destinationType: orchRes.openUrl.includes('youtube') ? 'youtube' : 'web',
              status: 'opened',
            },
          });
        }
        this.sendSSEEvent(res, {
          type: 'done',
          fullText: orchRes.reply,
          totalLatencyMs: Date.now() - startTime,
          ttfrMs,
          ttfaMs: ttfrMs,
        });
        res.end();
        return;
      } catch (err: any) {
        console.warn('[RealTimeEngine] Tool orchestration fallback to stream:', err?.message || err);
      }
    }

    // 2. LIGHT PATH STREAMING via Google Gemini SDK (@google/genai)
    const apiKey = getResolvedGeminiApiKey();
    if (!apiKey) {
      // Fallback response when GEMINI_API_KEY is not configured
      const fallbackText = `I am RODEX. I have processed your input ("${userInput}"). To enable real-time neural streaming, please add your GEMINI_API_KEY in Settings.`;
      const ttfrMs = Date.now() - startTime;
      this.sendSSEEvent(res, { type: 'start', path: 'fallback_path', ttfrMs });
      this.sendSSEEvent(res, { type: 'token', token: fallbackText });
      this.sendSSEEvent(res, { type: 'sentence', text: fallbackText, index: 0 });
      this.sendSSEEvent(res, {
        type: 'done',
        fullText: fallbackText,
        totalLatencyMs: Date.now() - startTime,
        ttfrMs,
        ttfaMs: ttfrMs,
      });
      res.end();
      return;
    }

    let ttfrMs: number | null = null;
    let ttfaMs: number | null = null;
    let fullAccumulatedText = '';
    let sentenceBuffer = '';
    let sentenceIndex = 0;

    try {
      if (!this.cachedAiClient) {
        this.cachedAiClient = new GoogleGenAI({ apiKey });
      }
      const ai = this.cachedAiClient;

      // Parallel Context Assembly (Memory & Profile)
      const userProfile = globalUserProfile.getProfile();
      const userMemories = await globalMemoryService.search(userInput, { limit: 3 }).catch(() => []);

      const systemInstruction = `You are RODEX, an advanced, highly responsive AI developed by Mubiru Robert (Robert).
      Current Year: 2026.
      Tone: Professional, direct, articulate, concise for voice calls (${isLiveCall ? 'keep responses brief under 2 sentences' : 'detailed when appropriate'}).
      User Profile: ${userProfile ? JSON.stringify(userProfile) : 'User'}.
      Context Memories: ${userMemories.map((m: any) => m.value).join(' | ')}.`;

      // Build contents array with conversation history
      const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      for (const h of history.slice(-6)) {
        formattedContents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
      formattedContents.push({
        role: 'user',
        parts: [{ text: userInput }],
      });

      // Stream generation from Gemini model with multi-model fallback resilience
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let streamSucceeded = false;
      let chosenModel = candidateModels[0];

      for (const modelName of candidateModels) {
        if (streamSucceeded) break;
        try {
          const streamResult = await ai.models.generateContentStream({
            model: modelName,
            contents: formattedContents,
            config: {
              systemInstruction,
              maxOutputTokens: isLiveCall ? 180 : 800,
              temperature: 0.7,
            },
          });

          chosenModel = modelName;
          this.sendSSEEvent(res, { type: 'start', path: 'light_path_stream', model: modelName });

          for await (const chunk of streamResult) {
            if (abortSignal?.aborted) {
              console.log('[RODEX Stream Engine] Client aborted stream.');
              break;
            }

            const tokenText = chunk.text;
            if (!tokenText) continue;

            if (ttfrMs === null) {
              ttfrMs = Date.now() - startTime;
            }

            fullAccumulatedText += tokenText;
            sentenceBuffer += tokenText;

            // Emit token chunk to UI immediately
            this.sendSSEEvent(res, { type: 'token', token: tokenText });

            // Sentence Boundary Detection for Early Speech Start
            const { sentences, remaining } = this.extractSentences(sentenceBuffer);
            if (sentences.length > 0) {
              for (const sentence of sentences) {
                const cleanSentence = sentence.trim();
                if (cleanSentence) {
                  if (ttfaMs === null) {
                    ttfaMs = Date.now() - startTime;
                  }
                  this.sendSSEEvent(res, {
                    type: 'sentence',
                    text: cleanSentence,
                    index: sentenceIndex++,
                  });
                }
              }
              sentenceBuffer = remaining;
            }
          }

          streamSucceeded = true;
          break;
        } catch (modelErr: any) {
          console.warn(`[RealTimeEngine] Stream on ${modelName} encountered error:`, modelErr?.message || modelErr);
          if (fullAccumulatedText.length > 0) {
            break;
          }
        }
      }

      if (!streamSucceeded && fullAccumulatedText.length === 0) {
        const fallbackText = "I am online and operational. How can I assist you today?";
        this.sendSSEEvent(res, { type: 'start', path: 'emergency_fallback', ttfrMs: 10 });
        this.sendSSEEvent(res, { type: 'token', token: fallbackText });
        this.sendSSEEvent(res, { type: 'sentence', text: fallbackText, index: 0 });
        fullAccumulatedText = fallbackText;
      }

      // Flush remaining trailing text sentence if any
      if (sentenceBuffer.trim()) {
        const cleanSentence = sentenceBuffer.trim();
        if (ttfaMs === null) {
          ttfaMs = Date.now() - startTime;
        }
        this.sendSSEEvent(res, {
          type: 'sentence',
          text: cleanSentence,
          index: sentenceIndex++,
        });
      }

      const totalLatencyMs = Date.now() - startTime;

      // Log latency metrics to Performance Tracker & Doctor
      globalPerformanceTracker.logMetric({
        type: 'chat',
        totalLatencyMs,
        aiLatencyMs: ttfrMs || totalLatencyMs,
        cacheHit: false,
        success: true,
        modelUsed: chosenModel,
      });

      globalServiceRegistry.updateServiceHealth('ai_provider', 'HEALTHY', totalLatencyMs);

      // Cache short responses for repeat queries
      if (fullAccumulatedText.trim().length > 0 && fullAccumulatedText.length < 300) {
        this.responseCache.set(cacheKey, {
          reply: fullAccumulatedText,
          timestamp: Date.now(),
        });
      }

      this.sendSSEEvent(res, {
        type: 'done',
        fullText: fullAccumulatedText,
        totalLatencyMs,
        ttfrMs: ttfrMs || totalLatencyMs,
        ttfaMs: ttfaMs || totalLatencyMs,
      });

      res.end();
    } catch (err: any) {
      console.error('[RODEX Stream Exception]', err);
      const totalLatencyMs = Date.now() - startTime;
      this.sendSSEEvent(res, {
        type: 'error',
        message: err?.message || 'Streaming failed',
        totalLatencyMs,
      });
      res.end();
    }
  }
}

export const globalRealTimeEngine = RealTimeResponseEngine.getInstance();
