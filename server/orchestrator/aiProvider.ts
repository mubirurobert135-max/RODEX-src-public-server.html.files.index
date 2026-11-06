import { GoogleGenAI } from '@google/genai';
import { getResolvedGeminiApiKey, isGeminiApiKeyConfigured } from '../geminiConfig';

export interface AIProviderConfig {
  apiKey?: string;
  preferredModel?: string;
  performanceTier?: 'fast' | 'balanced' | 'deep_reasoning';
}

export interface AIGenerationRequest {
  contents: any;
  systemInstruction?: string;
  tools?: any[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  modelOverride?: string;
}

export interface AIGenerationResponse {
  text: string;
  modelUsed: string;
  sources?: Array<{ title: string; url: string; domain?: string }>;
  searchQueries?: string[];
  latencyMs: number;
}

/**
 * AI Provider Abstraction Layer
 * Decouples model calls, handles graceful multi-model fallback, rate-limit recovery,
 * and enables future provider switching (Gemini variants, local models, etc.)
 */
export class AIProviderService {
  private static instance: AIProviderService | null = null;
  private client: GoogleGenAI | null = null;
  private searchCooldownUntil = 0;

  private constructor() {
    this.initClient();
  }

  public static getInstance(): AIProviderService {
    if (!this.instance) {
      this.instance = new AIProviderService();
    }
    return this.instance;
  }

  private initClient(): void {
    const apiKey = getResolvedGeminiApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-rodex',
          },
        },
      });
    }
  }

  public isAvailable(): boolean {
    return isGeminiApiKeyConfigured();
  }

  public getModelTiers(tier: 'fast' | 'balanced' | 'deep_reasoning' = 'fast'): string[] {
    switch (tier) {
      case 'deep_reasoning':
        return ['gemini-3.1-pro-preview', 'gemini-3.8-flash'];
      case 'balanced':
        return ['gemini-3.8-flash', 'gemini-3.6-flash'];
      case 'fast':
      default:
        return ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    }
  }

  public async generateContent(
    request: AIGenerationRequest,
    tier: 'fast' | 'balanced' | 'deep_reasoning' = 'fast'
  ): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    if (!this.client) {
      this.initClient();
    }

    if (!this.client || !isGeminiApiKeyConfigured()) {
      return {
        text: 'AI reasoning is not configured. Connect a Gemini API key in settings to enable online answers.',
        modelUsed: 'local_subsystem',
        latencyMs: Date.now() - startTime,
      };
    }

    const candidateModels = Array.from(new Set([
      ...(request.modelOverride ? [request.modelOverride] : []),
      ...this.getModelTiers(tier),
    ]));

    const isSearchCooldown = Date.now() < this.searchCooldownUntil;
    const tools = !isSearchCooldown && request.tools && request.tools.length > 0 ? request.tools : undefined;

    let lastError: any = null;

    // 1. Try with tools across candidate models
    if (tools) {
      for (const model of candidateModels) {
        try {
          const res = await this.client.models.generateContent({
            model,
            contents: request.contents,
            config: {
              systemInstruction: request.systemInstruction,
              tools,
              maxOutputTokens: request.maxOutputTokens ?? 800,
            },
          });

          if (res && (res.text || res.candidates?.length)) {
            const candidate = res.candidates?.[0];
            const grounding = candidate?.groundingMetadata;
            const sources: Array<{ title: string; url: string; domain?: string }> = [];
            const searchQueries = grounding?.webSearchQueries || [];

            if (Array.isArray(grounding?.groundingChunks)) {
              const seen = new Set<string>();
              for (const chunk of grounding.groundingChunks) {
                const uri = chunk.web?.uri;
                const title = chunk.web?.title || uri;
                if (uri && !seen.has(uri)) {
                  seen.add(uri);
                  let domain = 'web';
                  try {
                    domain = new URL(uri).hostname.replace(/^www\./, '');
                  } catch (_) {}
                  sources.push({ title: title || uri, url: uri, domain });
                }
              }
            }

            return {
              text: res.text || '',
              modelUsed: model,
              sources: sources.length > 0 ? sources : undefined,
              searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
              latencyMs: Date.now() - startTime,
            };
          }
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || String(err);
          console.warn(`[AIProvider] Model ${model} failed, trying next candidate:`, msg);
        }
      }
    }

    // If a verified/grounded answer was requested, never silently downgrade
    // to an ungrounded free-form answer after grounding failed.
    if (tools) {
      throw new Error(`Grounded model request failed: ${lastError?.message || lastError || 'provider unavailable'}`);
    }

    // 2. Direct synthesis attempt without tools
    for (const model of candidateModels) {
      try {
        const res = await this.client.models.generateContent({
          model,
          contents: request.contents,
          config: {
            systemInstruction: request.systemInstruction,
            maxOutputTokens: request.maxOutputTokens ?? 800,
          },
        });

        if (res && (res.text || res.candidates?.length)) {
          return {
            text: res.text || '',
            modelUsed: model,
            latencyMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        console.warn(`[AIProvider Direct] Model ${model} failed:`, msg);
      }
    }

    throw new Error(`Gemini generation failed: ${lastError?.message || lastError || 'all configured models unavailable'}`);
  }
}

export const globalAIProvider = AIProviderService.getInstance();
