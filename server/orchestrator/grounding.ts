/**
 * Normalize Google Search grounding metadata before exposing results as facts.
 * A generated answer alone is not evidence that a real web search ran.
 */
export interface GroundedSource {
  title: string;
  url: string;
  domain: string;
}

export interface WebGrounding {
  sources: GroundedSource[];
  searchQueries: string[];
  webGrounded: boolean;
}

export function extractWebGrounding(metadata: unknown): WebGrounding {
  const meta = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  const searchQueries = Array.isArray(meta.webSearchQueries)
    ? Array.from(new Set(
        meta.webSearchQueries
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim())
      ))
    : [];

  const sources: GroundedSource[] = [];
  const seen = new Set<string>();
  const chunks = Array.isArray(meta.groundingChunks) ? meta.groundingChunks : [];
  for (const raw of chunks) {
    if (!raw || typeof raw !== 'object') continue;
    const chunk = raw as Record<string, unknown>;
    const web = chunk.web;
    if (!web || typeof web !== 'object') continue;
    const ref = web as Record<string, unknown>;
    if (typeof ref.uri !== 'string') continue;
    try {
      const url = new URL(ref.uri);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const uri = url.toString();
      if (seen.has(uri)) continue;
      seen.add(uri);
      sources.push({
        title: typeof ref.title === 'string' && ref.title.trim()
          ? ref.title.trim()
          : url.hostname,
        url: uri,
        domain: url.hostname.replace(/^www\./, ''),
      });
    } catch {
      // Ignore invalid or non-web grounding links.
    }
  }

  return { sources, searchQueries, webGrounded: sources.length > 0 };
}
