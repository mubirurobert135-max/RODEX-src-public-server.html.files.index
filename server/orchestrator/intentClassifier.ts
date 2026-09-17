import { IntentClassification, TaskIntentCategory, ToolPermissionLevel } from './types';

export class IntentClassifier {
  public static classify(userInput: string): IntentClassification {
    if (!userInput || typeof userInput !== 'string') {
      return {
        primaryIntent: 'conversational',
        confidence: 1.0,
        extractedEntities: {},
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    const text = userInput.trim();
    const lower = text.toLowerCase();

    // 1. Creator & Founder Inquiry
    if (
      /\b(who created you|who is your creator|who made you|who is your founder|who developed you|who is mubiru robert|who is robert)\b/i.test(lower)
    ) {
      return {
        primaryIntent: 'creator_inquiry',
        confidence: 0.98,
        extractedEntities: { subject: 'Mubiru Robert' },
        suggestedTools: [],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 2. Cultural & Regional Intelligence (Tooro Kingdom / Uganda)
    if (
      /\b(tooro|toro kingdom|king oyo|omukama|fort portal|babiito|queen best kemigisa|princess komuntale|kijanangoma)\b/i.test(lower)
    ) {
      return {
        primaryIntent: 'cultural_knowledge',
        confidence: 0.95,
        extractedEntities: { region: 'Kingdom of Tooro, Uganda' },
        suggestedTools: ['web_search'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 3. YouTube, Websites & Browser URL Launch Intent
    // Matches: "open youtube", "launch youtube", "go to youtube", "play [song] on youtube", "search youtube for [query]", "open google", "open chrome", "open [website]"
    if (
      /\b(open youtube|launch youtube|go to youtube|visit youtube|open the youtube|open yt)\b/i.test(lower) ||
      /\b(play|search|find|watch|listen to)\b.*\b(on youtube|in youtube|youtube)\b/i.test(lower) ||
      /\byoutube\b.*\b(play|search for|find|open)\b/i.test(lower) ||
      /\b(open google|launch google|go to google|open chrome|launch chrome|open browser)\b/i.test(lower) ||
      /^(open|launch|go to|visit)\s+(https?:\/\/\S+|www\.\S+|[a-zA-Z0-9_\-]+\.(?:com|org|io|net|edu|gov|co|ai|app|dev)(?:\/\S*)?)/i.test(lower) ||
      /\b(open wikipedia|open reddit|open github|open netflix|open x|open twitter|open amazon|open chatgpt|open openai|open spotify web|open maps|open google maps|open gmail)\b/i.test(lower)
    ) {
      let targetUrl = 'https://www.youtube.com';
      let label = 'YouTube';
      let actionType = 'open_website';
      let searchQuery = '';

      // Check YouTube song / search requests
      if (
        /\b(play|search|find|watch|listen to)\b.*\b(on youtube|in youtube|youtube)\b/i.test(lower) ||
        /\byoutube\b.*\b(play|search for|find)\b/i.test(lower)
      ) {
        // Extract song / topic
        let extractedQuery = text
          .replace(/^(rodex,?\s*)?(please\s+)?(play|search for|search|find|watch|listen to)\s+/i, '')
          .replace(/\s+(on|in|using|via)\s+youtube\b.*/i, '')
          .replace(/\s+youtube\b.*/i, '')
          .replace(/^[,\s]+|[,\s]+$/g, '')
          .trim();

        if (/^music$|^songs?$|^video$/i.test(extractedQuery)) {
          extractedQuery = '';
        }

        if (extractedQuery) {
          searchQuery = extractedQuery;
          actionType = 'youtube_search';
          targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(extractedQuery)}`;
          label = `YouTube: "${extractedQuery}"`;
        } else {
          actionType = 'youtube_home';
          targetUrl = 'https://www.youtube.com';
          label = 'YouTube';
        }
      } else if (/\byoutube\b/i.test(lower)) {
        actionType = 'youtube_home';
        targetUrl = 'https://www.youtube.com';
        label = 'YouTube';
      } else if (/\b(google|chrome|browser)\b/i.test(lower)) {
        // Google or Chrome
        const searchMatch = text.match(/(?:search google for|google search for|google)\s+(.+)/i);
        if (searchMatch && !/^(open|launch|go to)\s+google/i.test(text)) {
          searchQuery = searchMatch[1].trim();
          actionType = 'google_search';
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
          label = `Google: "${searchQuery}"`;
        } else {
          actionType = 'open_website';
          targetUrl = 'https://www.google.com';
          label = 'Google';
        }
      } else if (/\bwikipedia\b/i.test(lower)) {
        targetUrl = 'https://en.wikipedia.org';
        label = 'Wikipedia';
      } else if (/\breddit\b/i.test(lower)) {
        targetUrl = 'https://www.reddit.com';
        label = 'Reddit';
      } else if (/\bgithub\b/i.test(lower)) {
        targetUrl = 'https://github.com';
        label = 'GitHub';
      } else if (/\bnetflix\b/i.test(lower)) {
        targetUrl = 'https://www.netflix.com';
        label = 'Netflix';
      } else if (/\b(x|twitter)\b/i.test(lower)) {
        targetUrl = 'https://x.com';
        label = 'X';
      } else if (/\bamazon\b/i.test(lower)) {
        targetUrl = 'https://www.amazon.com';
        label = 'Amazon';
      } else if (/\b(chatgpt|openai)\b/i.test(lower)) {
        targetUrl = 'https://chatgpt.com';
        label = 'ChatGPT';
      } else if (/\bgmail\b/i.test(lower)) {
        targetUrl = 'https://mail.google.com';
        label = 'Gmail';
      } else if (/\b(maps|google maps)\b/i.test(lower)) {
        targetUrl = 'https://maps.google.com';
        label = 'Google Maps';
      } else {
        // Extract raw URL or domain
        const urlMatch = text.match(/(https?:\/\/\S+|www\.\S+|[a-zA-Z0-9_\-]+\.(?:com|org|io|net|edu|gov|co|ai|app|dev)(?:\/\S*)?)/i);
        if (urlMatch) {
          let raw = urlMatch[1];
          if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
          targetUrl = raw;
          try {
            label = new URL(raw).hostname.replace(/^www\./, '');
          } catch {
            label = 'Website';
          }
        }
      }

      return {
        primaryIntent: 'open_url',
        confidence: 0.98,
        extractedEntities: {
          targetUrl,
          label,
          actionType,
          searchQuery: searchQuery || undefined,
        },
        suggestedTools: ['open_approved_url'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 4. Spotify & Media Control
    if (
      /\b(spotify|play music|pause music|skip song|next song|previous track|volume to \d+|stop music|what is playing|what song is this|play song)\b/i.test(lower) ||
      /^play\s+.+/i.test(lower) ||
      /^pause$/i.test(lower)
    ) {
      let action = 'status';
      let query = '';
      let volumePercent: number | undefined;

      const volMatch = lower.match(/volume\s+(?:to\s+)?(\d+)/i);
      if (volMatch) {
        action = 'volume';
        volumePercent = parseInt(volMatch[1], 10);
      } else if (/\b(next song|skip song|next track|skip track)\b/i.test(lower)) {
        action = 'next';
      } else if (/\b(previous song|previous track|last song)\b/i.test(lower)) {
        action = 'previous';
      } else if (/\b(pause|stop)\b/i.test(lower)) {
        action = 'pause';
      } else if (/^play\s+(.+)/i.test(lower)) {
        action = 'search_and_play';
        query = lower.replace(/^play\s+/i, '').replace(/\s+on\s+spotify/i, '').trim();
      } else if (/\bplay\b/i.test(lower)) {
        action = 'play';
      }

      return {
        primaryIntent: 'media_control',
        confidence: 0.94,
        extractedEntities: { action, query, volumePercent },
        suggestedTools: ['media_control'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 4. Mathematical Calculation & Unit Conversion
    if (
      /^(calculate|compute|what is|convert)\s+([0-9+\-*/().\s^%sqrtcointalgnabs|miles|km|kg|lbs|celsius|fahrenheit|gb|mb|to]+)$/i.test(lower) ||
      /\b(\d+\s*[\+\-\*\/]\s*\d+|\d+\s*%\s*of\s*\d+|sqrt\(\d+\)|\d+\s*(?:km|miles|kg|lbs|gb|mb)\s+to\s+(?:km|miles|kg|lbs|gb|mb))\b/i.test(lower)
    ) {
      const mathMatch = text.replace(/^(calculate|compute|what is|convert)\s+/i, '').replace(/[?!=]+$/, '').trim();
      return {
        primaryIntent: 'calculate_compute',
        confidence: 0.95,
        extractedEntities: { expression: mathMatch },
        suggestedTools: ['calculate_compute'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 5. High-Precision Time, Date, and Timezone
    if (
      /\b(what time is it|what is the time|current time|current date|what day is it|what year is it|time in [a-z\s_]+|timezone)\b/i.test(lower)
    ) {
      let tz = 'Africa/Kampala';
      if (/tokyo|japan/i.test(lower)) tz = 'Asia/Tokyo';
      else if (/london|uk|gmt/i.test(lower)) tz = 'Europe/London';
      else if (/new york|est|nyc/i.test(lower)) tz = 'America/New_York';
      else if (/los angeles|pst|california/i.test(lower)) tz = 'America/Los_Angeles';
      else if (/utc/i.test(lower)) tz = 'UTC';

      return {
        primaryIntent: 'datetime_timezone',
        confidence: 0.96,
        extractedEntities: { targetTimeZone: tz },
        suggestedTools: ['datetime_timezone'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 6. Safe System & Runtime Telemetry
    if (
      /\b(system info|system status|check system|memory usage|ram usage|uptime|health check|system telemetry|cpu status|node version)\b/i.test(lower)
    ) {
      const isMemory = /memory|ram|heap/i.test(lower);
      return {
        primaryIntent: 'system_info',
        confidence: 0.95,
        extractedEntities: { category: isMemory ? 'memory' : 'overview' },
        suggestedTools: ['system_info'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 7. Permitted File Inspection
    if (
      /\b(read file|inspect file|show file|read package\.json|read metadata\.json|view file)\b/i.test(lower) ||
      /\b(package\.json|metadata\.json|src\/types\.ts|README\.md)\b/i.test(text)
    ) {
      const fileMatch = text.match(/([a-zA-Z0-9_\-\/.]+\.(json|ts|tsx|md|txt|html|css))/i);
      const filePath = fileMatch ? fileMatch[1] : 'package.json';

      return {
        primaryIntent: 'file_inspection',
        confidence: 0.92,
        extractedEntities: { filePath },
        suggestedTools: ['read_permitted_file'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 8. In-App Navigation & Modals
    if (
      /\b(open settings|open voice profile|open security center|open spotify|open modes|open update center|open creator profile|clear (?:all )?(?:chat )?(?:history|messages)|clear chat)\b/i.test(lower)
    ) {
      let action = 'open_settings';
      let risk: ToolPermissionLevel = 'safe';

      if (/voice profile/i.test(lower)) action = 'open_voice_profile';
      else if (/security center/i.test(lower)) action = 'open_security_center';
      else if (/spotify/i.test(lower)) action = 'open_spotify_player';
      else if (/modes/i.test(lower)) action = 'open_modes';
      else if (/update/i.test(lower)) action = 'open_update_center';
      else if (/creator/i.test(lower)) action = 'open_creator_profile';
      else if (/clear/i.test(lower)) {
        action = 'clear_history';
        risk = 'high_risk';
      }

      return {
        primaryIntent: 'app_action',
        confidence: 0.96,
        extractedEntities: { action },
        suggestedTools: ['app_action'],
        requiresPlanning: false,
        riskLevel: risk,
      };
    }

    // 9. Web Search & Live Breaking News
    if (
      /\b(search for|search the web|look up|google|latest news|breaking news|weather in|who won|current price|stock market)\b/i.test(lower) ||
      /\b(2026|today|current|happening now)\b/i.test(lower)
    ) {
      const searchQuery = text
        .replace(/^(search for|search the web for|search|look up|google)\s+/i, '')
        .replace(/[?]+$/, '')
        .trim();

      return {
        primaryIntent: 'web_search',
        confidence: 0.91,
        extractedEntities: { query: searchQuery || text },
        suggestedTools: ['web_search'],
        requiresPlanning: false,
        riskLevel: 'safe',
      };
    }

    // 10. General Knowledge or Conversational
    return {
      primaryIntent: 'general_knowledge',
      confidence: 0.85,
      extractedEntities: { text },
      suggestedTools: [],
      requiresPlanning: false,
      riskLevel: 'safe',
    };
  }
}
