import { ToolDefinition } from '../types';

export const openUrlTool: ToolDefinition = {
  name: 'open_approved_url',
  description: 'Validate, construct, and open approved external web destinations, YouTube videos/music, or search portals in the user\'s browser.',
  permissionLevel: 'safe',
  parameters: {
    url: {
      type: 'string',
      description: 'The destination URL to open (e.g. "https://www.youtube.com", "https://www.google.com")',
      required: false,
    },
    label: {
      type: 'string',
      description: 'Human-readable label for the website link or search query',
      required: false,
    },
    actionType: {
      type: 'string',
      description: 'The specific browser action type (e.g. "youtube_search", "youtube_home", "google_search", "open_website")',
      required: false,
    },
    searchQuery: {
      type: 'string',
      description: 'Search query for YouTube or Google if searching for a song, video, or topic',
      required: false,
    },
  },
  handler: async (params) => {
    let rawUrl = params?.url;
    const actionType = params?.actionType || 'open_website';
    const searchQuery = params?.searchQuery ? String(params.searchQuery).trim() : '';

    // Handle YouTube specific search or home
    if (actionType === 'youtube_search' || (!rawUrl && searchQuery && /youtube/i.test(params?.label || ''))) {
      const encoded = encodeURIComponent(searchQuery);
      rawUrl = searchQuery ? `https://www.youtube.com/results?search_query=${encoded}` : 'https://www.youtube.com';
    } else if (actionType === 'google_search') {
      const encoded = encodeURIComponent(searchQuery);
      rawUrl = searchQuery ? `https://www.google.com/search?q=${encoded}` : 'https://www.google.com';
    } else if (!rawUrl) {
      if (/youtube/i.test(params?.label || '')) {
        rawUrl = 'https://www.youtube.com';
      } else if (/google|chrome/i.test(params?.label || '')) {
        rawUrl = 'https://www.google.com';
      }
    }

    if (!rawUrl || typeof rawUrl !== 'string') {
      return {
        success: false,
        output: null,
        error: 'A valid URL or search target is required to open a website.',
      };
    }

    // Auto-prefix http/https if missing (e.g. "youtube.com" -> "https://youtube.com")
    let normalizedUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return {
          success: false,
          output: null,
          error: 'Only standard HTTP and HTTPS web protocols are permitted.',
        };
      }

      const domain = parsed.hostname.replace(/^www\./, '');
      let label = params?.label;

      if (!label) {
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
          label = searchQuery ? `YouTube: "${searchQuery}"` : 'YouTube';
        } else if (domain.includes('google.com')) {
          label = searchQuery ? `Google: "${searchQuery}"` : 'Google';
        } else {
          label = domain.charAt(0).toUpperCase() + domain.slice(1);
        }
      }

      const isYouTube = domain.includes('youtube.com') || domain.includes('youtu.be');
      const isGoogle = domain.includes('google.com');

      let spokenMessage = `Opening ${label} now.`;
      if (isYouTube) {
        if (searchQuery) {
          spokenMessage = `Searching YouTube for "${searchQuery}" and opening results now.`;
        } else {
          spokenMessage = 'Opening YouTube now.';
        }
      } else if (isGoogle) {
        if (searchQuery) {
          spokenMessage = `Searching Google for "${searchQuery}" and opening results now.`;
        } else {
          spokenMessage = 'Opening Google now.';
        }
      }

      return {
        success: true,
        output: {
          action: 'open_url',
          url: parsed.toString(),
          domain,
          label,
          protocol: parsed.protocol,
          isSecure: parsed.protocol === 'https:',
          target: '_blank',
          searchQuery: searchQuery || undefined,
          destinationType: isYouTube ? 'youtube' : isGoogle ? 'google' : 'website',
          spokenMessage,
        },
        sources: [
          {
            title: label,
            url: parsed.toString(),
            domain,
          },
        ],
        message: spokenMessage,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Invalid URL format (${rawUrl}): ${err?.message}`,
      };
    }
  },
  examples: [
    { query: 'Open YouTube', params: { url: 'https://www.youtube.com', label: 'YouTube', actionType: 'youtube_home' } },
    { query: 'Play Bohemian Rhapsody on YouTube', params: { actionType: 'youtube_search', searchQuery: 'Bohemian Rhapsody', label: 'YouTube' } },
    { query: 'Open Google', params: { url: 'https://www.google.com', label: 'Google', actionType: 'open_website' } },
    { query: 'Open Wikipedia', params: { url: 'https://en.wikipedia.org', label: 'Wikipedia' } },
  ],
};

