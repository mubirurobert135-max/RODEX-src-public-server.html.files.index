export interface ActiveImageContext {
  id?: string;
  url: string;
  prompt: string;
  type: 'generated' | 'uploaded' | 'edited';
  aspectRatio?: string;
  model?: string;
  timestamp: number;
}

export interface ConversationEntityState {
  lastTopic?: string;
  lastSubject?: string;
  lastUrl?: {
    url: string;
    label: string;
    actionType: string;
    searchQuery?: string;
  };
  lastMedia?: {
    track?: string;
    artist?: string;
    query?: string;
    action?: string;
  };
  lastCalculation?: {
    expression: string;
    result: number | string;
  };
  lastTimezone?: string;
  lastImage?: ActiveImageContext;
  pendingClarification?: {
    type: 'open_url' | 'youtube_search' | 'google_search' | 'calculate_compute' | 'media_control' | 'web_search' | 'volume';
    prompt: string;
    originalInput: string;
    timestamp: number;
  };
  recentEntities: string[];
}

export type DetailLevel = 'concise' | 'normal' | 'detailed';

export interface ContextualResolution {
  isFollowUp: boolean;
  resolvedInput: string;
  inferredSubject?: string;
  inferredTopic?: string;
  detailLevel: DetailLevel;
  answeredClarification?: boolean;
}

export class ContextMemoryManager {
  private static sessions = new Map<string, ConversationEntityState>();

  public static getSessionState(sessionId: string = 'default'): ConversationEntityState {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        recentEntities: [],
      });
    }
    return this.sessions.get(sessionId)!;
  }

  public static updateSessionState(
    sessionId: string = 'default',
    updates: Partial<ConversationEntityState>
  ): void {
    const current = this.getSessionState(sessionId);
    this.sessions.set(sessionId, {
      ...current,
      ...updates,
      recentEntities: updates.recentEntities || current.recentEntities,
    });
  }

  public static clearPendingClarification(sessionId: string = 'default'): void {
    const state = this.getSessionState(sessionId);
    state.pendingClarification = undefined;
  }

  public static setPendingClarification(
    sessionId: string = 'default',
    clarification: ConversationEntityState['pendingClarification']
  ): void {
    const state = this.getSessionState(sessionId);
    state.pendingClarification = clarification;
  }

  /**
   * Inspects conversation history to reconstruct conversation entities and active context
   */
  public static extractContextFromHistory(
    history: Array<{ role: string; text: string }> = []
  ): ConversationEntityState {
    const extracted: ConversationEntityState = {
      recentEntities: [],
    };

    if (!Array.isArray(history) || history.length === 0) {
      return extracted;
    }

    // Scan backwards from recent history
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      const text = turn.text || '';
      const lower = text.toLowerCase();

      // Extract subject/person
      if (!extracted.lastSubject) {
        if (/mubiru robert|robert/i.test(text)) {
          extracted.lastSubject = 'Mubiru Robert';
          extracted.recentEntities.push('Mubiru Robert');
        } else if (/king oyo|oyo nyimba|omukama/i.test(text)) {
          extracted.lastSubject = 'Omukama King Oyo';
          extracted.recentEntities.push('King Oyo');
        } else if (/kijanangoma/i.test(text)) {
          extracted.lastSubject = 'Prince Edward Rukidi Kijanangoma';
        } else if (/queen best kemigisa|kemigisa/i.test(text)) {
          extracted.lastSubject = 'Queen Best Kemigisa';
        } else if (/komuntale/i.test(text)) {
          extracted.lastSubject = 'Princess Ruth Komuntale';
        }
      }

      // Extract topic
      if (!extracted.lastTopic) {
        if (/tooro|toro/i.test(text)) {
          extracted.lastTopic = 'Kingdom of Tooro succession';
        } else if (/spotify|music|song|playback|volume/i.test(text)) {
          extracted.lastTopic = 'Spotify music playback';
        } else if (/youtube|video/i.test(text)) {
          extracted.lastTopic = 'YouTube media';
        } else if (/weather|forecast/i.test(text)) {
          extracted.lastTopic = 'Weather';
        } else if (/quantum|physics|science/i.test(text)) {
          extracted.lastTopic = 'Science and technology';
        }
      }

      // Extract last URL / website
      if (!extracted.lastUrl || !extracted.lastUrl.searchQuery) {
        if (/youtube\.com/i.test(text) || /\byoutube\b/i.test(text)) {
          const songMatch =
            text.match(/search_query=([^&"]+)/i) ||
            text.match(/(?:open|go to|launch)\s+youtube\s+(?:and\s+)?(?:search(?:\s+for)?|play|watch|find)\s+(.+)/i) ||
            text.match(/play\s+(.+?)\s+on\s+youtube/i) ||
            text.match(/search\s+youtube\s+for\s+(.+)/i) ||
            text.match(/youtube\s+search\s+for\s+(.+)/i);
          const q = songMatch ? decodeURIComponent(songMatch[1]) : undefined;
          if (q || !extracted.lastUrl) {
            extracted.lastUrl = {
              url: q ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` : 'https://www.youtube.com',
              label: q ? `YouTube: "${q}"` : 'YouTube',
              actionType: q ? 'youtube_search' : 'youtube_home',
              searchQuery: q,
            };
          }
        } else if (!extracted.lastUrl && (/google\.com/i.test(text) || /\bgoogle\b/i.test(text))) {
          extracted.lastUrl = {
            url: 'https://www.google.com',
            label: 'Google',
            actionType: 'open_website',
          };
        }
      }

      // Extract last media
      if (!extracted.lastMedia) {
        const playMatch = text.match(/(?:playing|play|song)\s+"?([^"\n,]+)"?(?:\s+by\s+([^"\n,]+))?/i);
        if (playMatch) {
          extracted.lastMedia = {
            track: playMatch[1].trim(),
            artist: playMatch[2] ? playMatch[2].trim() : undefined,
          };
        }
      }

      // Extract last calculation
      if (!extracted.lastCalculation) {
        const mathMatch = text.match(/([0-9+\-*/().\s^%]+)=\s*([0-9.]+)/);
        if (mathMatch) {
          extracted.lastCalculation = {
            expression: mathMatch[1].trim(),
            result: mathMatch[2].trim(),
          };
        }
      }
    }

    return extracted;
  }

  /**
   * Resolves follow-up queries, pronouns, and handles answers to pending clarifications
   */
  public static resolveContext(
    userInput: string,
    history: Array<{ role: string; text: string }> = [],
    sessionState?: ConversationEntityState
  ): ContextualResolution {
    const text = userInput.trim();
    const lower = text.toLowerCase();
    const historyContext = this.extractContextFromHistory(history);
    const combinedState: ConversationEntityState = {
      ...(sessionState || {}),
      ...historyContext,
    };

    // 1. Detect requested level of detail
    let detailLevel: DetailLevel = 'normal';
    if (
      /\b(concise|briefly|brief|in short|in one sentence|quick answer|short answer|nutshell|simple answer)\b/i.test(
        lower
      )
    ) {
      detailLevel = 'concise';
    } else if (
      /\b(detail|in detail|detailed|elaborate|comprehensive|deep dive|in-depth|explain fully|break down|step by step|exhaustive|walk me through)\b/i.test(
        lower
      )
    ) {
      detailLevel = 'detailed';
    }

    // 2. Check if this input answers a pending clarification
    if (combinedState.pendingClarification) {
      const pending = combinedState.pendingClarification;
      const isFresh = Date.now() - pending.timestamp < 1000 * 60 * 3; // 3 minutes

      if (isFresh) {
        // If pending YouTube search and user gives a song/artist
        if (pending.type === 'youtube_search') {
          return {
            isFollowUp: true,
            resolvedInput: `play ${text} on youtube`,
            inferredTopic: 'YouTube search',
            detailLevel,
            answeredClarification: true,
          };
        }

        // If pending URL open and user gives a domain or site
        if (pending.type === 'open_url') {
          return {
            isFollowUp: true,
            resolvedInput: `open ${text}`,
            inferredTopic: 'Open website',
            detailLevel,
            answeredClarification: true,
          };
        }

        // If pending Google search
        if (pending.type === 'google_search') {
          return {
            isFollowUp: true,
            resolvedInput: `search google for ${text}`,
            inferredTopic: 'Google search',
            detailLevel,
            answeredClarification: true,
          };
        }

        // If pending calculation
        if (pending.type === 'calculate_compute') {
          return {
            isFollowUp: true,
            resolvedInput: `calculate ${text}`,
            inferredTopic: 'Calculation',
            detailLevel,
            answeredClarification: true,
          };
        }

        // If pending volume
        if (pending.type === 'volume') {
          const volMatch = text.match(/\d+/);
          if (volMatch) {
            return {
              isFollowUp: true,
              resolvedInput: `set volume to ${volMatch[0]}`,
              inferredTopic: 'Volume adjustment',
              detailLevel,
              answeredClarification: true,
            };
          }
        }
      }
    }

    // 3. Detect follow-up pronouns and anaphora references ("he", "she", "it", "that", "his", "him")
    let isFollowUp = false;
    let resolvedInput = text;

    // "Who was his mother?", "When did he die?", "Tell me more about him", "Where was he born?"
    if (
      /\b(he|him|his|she|her|hers)\b/i.test(lower) &&
      combinedState.lastSubject &&
      !/\b(robert|mubiru|king oyo|oyo|creator|founder)\b/i.test(lower)
    ) {
      isFollowUp = true;
      resolvedInput = `${text} (Referring to: ${combinedState.lastSubject})`;
    }

    // "Tell me more about that", "Can you explain that?", "Why did that happen?", "Elaborate on that"
    if (
      /\b(about that|explain that|elaborate on that|more about that|why is that|tell me more|go deeper|what does that mean)\b/i.test(
        lower
      ) &&
      combinedState.lastTopic
    ) {
      isFollowUp = true;
      resolvedInput = `${text} (Context topic: ${combinedState.lastTopic}${
        combinedState.lastSubject ? ` regarding ${combinedState.lastSubject}` : ''
      })`;
    }

    // "Play it on YouTube" or "Open it in browser" -> refers to lastMedia or lastTopic
    if (
      /\b(play it|open it|search it|watch it)\b.*\b(youtube|browser|google)\b/i.test(lower) &&
      (combinedState.lastMedia?.track || combinedState.lastTopic)
    ) {
      isFollowUp = true;
      const target = combinedState.lastMedia?.track || combinedState.lastTopic;
      if (lower.includes('youtube')) {
        resolvedInput = `play ${target} on youtube`;
      } else if (lower.includes('google')) {
        resolvedInput = `search google for ${target}`;
      } else {
        resolvedInput = `open ${target}`;
      }
    }

    // YouTube/Spotify/Google continuation: e.g. "search for Python" or "search Python"
    if (
      (lower.startsWith('search for ') || lower.startsWith('search ') || lower.startsWith('play ')) &&
      !lower.includes('on youtube') && !lower.includes('on spotify') && !lower.includes('google')
    ) {
      const q = lower.replace(/^(search for|search|play)\s+/i, '').trim();
      const lastLabel = combinedState.lastUrl?.label?.toLowerCase() || '';
      if (lastLabel.includes('youtube') || (combinedState.lastTopic && combinedState.lastTopic.toLowerCase().includes('youtube'))) {
        isFollowUp = true;
        resolvedInput = `search youtube for ${q}`;
      } else if (lastLabel.includes('spotify') || (combinedState.lastTopic && combinedState.lastTopic.toLowerCase().includes('spotify'))) {
        isFollowUp = true;
        resolvedInput = `search spotify for ${q}`;
      } else if (lastLabel.includes('google') || (combinedState.lastTopic && combinedState.lastTopic.toLowerCase().includes('google'))) {
        isFollowUp = true;
        resolvedInput = `search google for ${q}`;
      }
    }

    // "Open the first one" or "open the first result" or "play the first result"
    if (
      /\b(open the first|play the first|the first result|open the first result|first one)\b/i.test(lower) &&
      combinedState.lastUrl?.searchQuery
    ) {
      isFollowUp = true;
      const lastQ = combinedState.lastUrl.searchQuery;
      const lastLabel = combinedState.lastUrl.label.toLowerCase();
      if (lastLabel.includes('youtube')) {
        resolvedInput = `play first youtube video of ${lastQ}`;
      } else {
        resolvedInput = `open first search result of ${lastQ}`;
      }
    }

    // Math continuation: "Multiply that by 2", "Add 50 to that", "Times 4", "Plus 10"
    if (
      combinedState.lastCalculation &&
      /^(\+|plus|\-|minus|\*|times|\/|divided by|multiply that by|add \d+ to that)\s*/i.test(lower)
    ) {
      isFollowUp = true;
      const prevResult = combinedState.lastCalculation.result;
      const operatorMatch = lower
        .replace(/^(multiply that by|times)\s*/i, '* ')
        .replace(/^(add)\s+(\d+)\s+to that/i, '$2 + ')
        .replace(/^plus\s*/i, '+ ')
        .replace(/^minus\s*/i, '- ')
        .replace(/^divided by\s*/i, '/ ');

      resolvedInput = `calculate ${prevResult} ${operatorMatch.trim()}`;
    }

    // Timezone continuation: "What about in London?", "And in Tokyo?", "What about Paris?"
    if (
      /^(what about|and in|how about|what time is it in)\s+([a-zA-Z\s]+)\??$/i.test(lower) &&
      (combinedState.lastTopic === 'Time' || history.some((h) => /time|clock|timezone/i.test(h.text)))
    ) {
      isFollowUp = true;
      const cityMatch = lower.match(/(?:in|about)\s+([a-zA-Z\s]+)\??$/i);
      if (cityMatch && cityMatch[1]) {
        resolvedInput = `what time is it in ${cityMatch[1].trim()}`;
      }
    }

    // Image modification follow-ups on active conversation image
    if (
      combinedState.lastImage &&
      (/\b(to it|from it|in it|on it|the background|this image|that image|the sky|the tree|brighter|darker|into a poster|as a poster|remove the|add a|add some|change the)\b/i.test(lower) ||
       /^(add|remove|change|replace|make it|turn it|convert it|enhance|crop|brighten|darken)\b/i.test(lower))
    ) {
      isFollowUp = true;
      resolvedInput = `edit image: ${text} (Active Image: "${combinedState.lastImage.prompt}")`;
    }

    // Question about previous context: "What was the second option?", "What were we talking about?", "What did I just ask?"
    if (
      /\b(what were we talking about|what did i just ask|what did you say earlier|remind me what we discussed)\b/i.test(
        lower
      )
    ) {
      isFollowUp = true;
    }

    return {
      isFollowUp,
      resolvedInput,
      inferredSubject: combinedState.lastSubject,
      inferredTopic: combinedState.lastTopic,
      detailLevel,
    };
  }

  /**
   * Generates a concise context anchor string for system prompt injection
   */
  public static buildConversationContextSummary(
    history: Array<{ role: string; text: string }> = [],
    resolution?: ContextualResolution
  ): string {
    const context = this.extractContextFromHistory(history);
    const parts: string[] = [];

    if (context.lastSubject) {
      parts.push(`Active Subject in Discourse: ${context.lastSubject}`);
    }
    if (context.lastTopic) {
      parts.push(`Active Topic: ${context.lastTopic}`);
    }
    if (context.lastMedia?.track) {
      parts.push(`Active Media / Song: "${context.lastMedia.track}"${context.lastMedia.artist ? ` by ${context.lastMedia.artist}` : ''}`);
    }
    if (context.lastUrl?.label) {
      parts.push(`Last Web Portal: ${context.lastUrl.label} (${context.lastUrl.url})`);
    }
    if (context.lastCalculation) {
      parts.push(`Last Calculation Result: ${context.lastCalculation.expression} = ${context.lastCalculation.result}`);
    }
    if (resolution?.detailLevel && resolution.detailLevel !== 'normal') {
      parts.push(`User Explicit Depth Directive: ${resolution.detailLevel.toUpperCase()} (Ensure the response format respects this request strictly)`);
    }

    if (parts.length === 0) return '';

    return `CONVERSATIONAL MEMORY & ACTIVE CONTEXT:\n${parts.map((p) => `- ${p}`).join('\n')}\nMaintain continuity with these entities if the user asks follow-up questions.`;
  }
}
