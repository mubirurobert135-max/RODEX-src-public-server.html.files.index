import { ToolDefinition } from '../types';
import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the World Wide Web via Google Search for current breaking news, geopolitics, regional events, facts, market rates, and fresh technical data.',
  permissionLevel: 'safe',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query or topic to look up on the live internet',
      required: true,
    },
    focus: {
      type: 'string',
      description: 'Optional domain focus: "news", "finance", "technology", "general"',
      enum: ['news', 'finance', 'technology', 'general'],
      default: 'general',
    },
  },
  handler: async (params, context) => {
    const query = params?.query;
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        output: null,
        error: 'A search query string is required.',
      };
    }

    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        output: null,
        error: 'Gemini API key is required to perform live Google Search grounding.',
        sources: [
          {
            title: 'Google News Search',
            url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
            domain: 'google.com',
          },
        ],
        searchQueries: [query],
      };
    }

    try {
      const ai = getAIClient();
      const prompt = `Perform a high-precision live web search regarding: "${query}". 
Provide 2-3 factual sentences summarizing verified findings, anchored in current 2026 facts.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are RODEX Web Grounding Agent. Return verified factual insights grounded in Google Search.',
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 300,
        },
      });

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const searchQueries = groundingMetadata?.webSearchQueries || [query];
      const sources: Array<{ title: string; url: string; domain: string }> = [];
      const seen = new Set<string>();

      if (Array.isArray(groundingMetadata?.groundingChunks)) {
        for (const chunk of groundingMetadata.groundingChunks) {
          const uri = chunk.web?.uri;
          const title = chunk.web?.title || uri;
          if (uri && !seen.has(uri)) {
            seen.add(uri);
            let domain = 'web';
            try {
              domain = new URL(uri).hostname.replace(/^www\./, '');
            } catch {
              domain = 'web';
            }
            sources.push({ title: title || uri, url: uri, domain });
          }
        }
      }

      return {
        success: true,
        output: {
          query,
          summary: response.text || 'Web search completed.',
          sourcesCount: sources.length,
        },
        sources,
        searchQueries,
        message: response.text || `Web search completed for "${query}".`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Web search grounding error: ${err?.message}`,
        sources: [
          {
            title: `Google Search: ${query}`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            domain: 'google.com',
          },
        ],
        searchQueries: [query],
      };
    }
  },
  examples: [
    { query: 'Search current gold prices in 2026', params: { query: 'gold price 2026' } },
    { query: 'Look up the latest news in Uganda', params: { query: 'latest Uganda news' } },
  ],
};
