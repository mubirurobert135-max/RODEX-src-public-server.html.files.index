import { GoogleGenAI } from '@google/genai';
import type { ToolDefinition } from '../types';
import { getResolvedGeminiApiKey } from '../../geminiConfig';
import { extractWebGrounding } from '../grounding';

let client: GoogleGenAI | null = null;
let clientKey = '';

function getClient(apiKey: string): GoogleGenAI {
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Verify current information using live Google Search grounding and return traceable sources.',
  permissionLevel: 'safe',
  parameters: {
    query: {
      type: 'string',
      description: 'A specific factual or current information query to verify',
      required: true,
    },
    focus: {
      type: 'string',
      description: 'Optional search context',
      enum: ['news', 'finance', 'technology', 'general'],
      default: 'general',
    },
  },
  handler: async (params) => {
    const query = typeof params?.query === 'string'
      ? params.query.trim().slice(0, 900)
      : '';
    if (!query) {
      return { success: false, output: null, error: 'A nonempty search query is required.' };
    }

    const key = getResolvedGeminiApiKey();
    if (!key) {
      return {
        success: false,
        output: null,
        error: 'Web search is unavailable until a Gemini API key is configured.',
        sources: [],
        searchQueries: [],
      };
    }

    const models = ['gemini-3.8-flash', 'gemini-3.6-flash'];
    let failure = 'Search grounding returned no cited web sources.';

    for (const model of models) {
      try {
        const response = await getClient(key).models.generateContent({
          model,
          contents: `Verify the following query with Google Search and answer briefly. Include only facts that can be grounded: ${query}`,
          config: {
            systemInstruction: 'You are the RODEX live web grounding agent. Search first. Do not invent citations, search results, or dates.',
            tools: [{ googleSearch: {} }],
            maxOutputTokens: 700,
          },
        });
        const grounding = extractWebGrounding(response.candidates?.[0]?.groundingMetadata);
        if (!grounding.webGrounded || !response.text?.trim()) {
          failure = `${model} did not return a grounded, cited answer.`;
          continue;
        }
        return {
          success: true,
          output: {
            query,
            summary: response.text.trim(),
            sourcesCount: grounding.sources.length,
            modelUsed: model,
          },
          sources: grounding.sources,
          searchQueries: grounding.searchQueries,
          message: response.text.trim(),
        };
      } catch (err: any) {
        failure = err instanceof Error ? err.message : String(err);
        // A rate limit or invalid key generally affects both models: do not
        // stack slow, quota-consuming retries for the same request.
        if (/\b(401|403|429|RESOURCE_EXHAUSTED|quota|API key)\b/i.test(failure)) break;
      }
    }

    return {
      success: false,
      output: null,
      error: `Live web verification was unavailable: ${failure}`,
      sources: [],
      searchQueries: [],
    };
  },
  examples: [
    { query: 'Search the latest Uganda news', params: { query: 'latest Uganda news' } },
    { query: 'Verify current gold prices', params: { query: 'current gold price' } },
  ],
};
