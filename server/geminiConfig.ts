import dotenv from 'dotenv';

dotenv.config();

/**
 * Standardized resolution of Gemini API Key.
 * Checks GEMINI_API_KEY first, with fallback to GOOGLE_API_KEY.
 * Never logs or exposes secret values.
 */
export function getResolvedGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  return key.trim();
}

/**
 * Returns whether a non-empty API key is available
 */
export function isGeminiApiKeyConfigured(): boolean {
  const key = getResolvedGeminiApiKey();
  return Boolean(key && key.length > 5);
}

/**
 * Returns safe startup diagnostic state without exposing secret characters
 */
export function validateGeminiStartupConfig(): {
  configured: boolean;
  keyPresent: boolean;
  keyLength: number;
  provider: string;
} {
  const key = getResolvedGeminiApiKey();
  return {
    configured: isGeminiApiKeyConfigured(),
    keyPresent: Boolean(key),
    keyLength: key ? key.length : 0,
    provider: 'Google Gemini SDK (@google/genai)',
  };
}
