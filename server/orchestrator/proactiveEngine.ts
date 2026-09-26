import { ProactiveSuggestion, ProactiveState } from './types';

export class ProactiveIntelligenceEngine {
  /**
   * Generates safe, high-value proactive suggestions based on current context,
   * recent activity, time of day, and memory.
   * Strict Rule: NEVER execute sensitive actions autonomously.
   */
  public static generateSuggestions(params: {
    history?: Array<{ role: string; text: string }>;
    currentTimeEAT?: string;
    userName?: string;
  }): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];
    const name = params.userName || 'Robert';
    const history = params.history || [];
    const lastUserMsg = history.filter((h) => h.role === 'user').slice(-1)[0]?.text || '';
    const lastUserLower = lastUserMsg.toLowerCase();

    // 1. Contextual Email Follow-up Suggestion
    if (lastUserLower.includes('email') || lastUserLower.includes('john') || lastUserLower.includes('meeting')) {
      suggestions.push({
        id: `sug-email-${Date.now()}`,
        title: 'Review Unread Email Summary',
        category: 'workflow',
        suggestedAction: 'Check latest unread emails and prepare summaries for approval',
        reason: 'Recent email or meeting topics detected in session context.',
        state: 'suggesting',
        requiresAuth: true,
        confidence: 0.94,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Multi-Step Communication Suggestion
    if (lastUserLower.includes('rose') || lastUserLower.includes('whatsapp') || lastUserLower.includes('call')) {
      suggestions.push({
        id: `sug-comm-${Date.now()}`,
        title: 'Prepare WhatsApp Communication Draft',
        category: 'device',
        suggestedAction: 'Draft proposed WhatsApp message to Sis Rose without sending',
        reason: 'Contact reference detected. Draft ready for your review and confirmation.',
        state: 'preparing',
        requiresAuth: true,
        confidence: 0.91,
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Project & Memory Synthesis Suggestion
    suggestions.push({
      id: `sug-mem-1`,
      title: 'Memory & Preference Verification',
      category: 'memory',
      suggestedAction: 'Sync active project directives to long-term memory vault',
      reason: 'Keeps project progress and architectural preferences updated.',
      state: 'suggesting',
      requiresAuth: false,
      confidence: 0.88,
      timestamp: new Date().toISOString(),
    });

    // 4. Cultural & World Intelligence Briefing
    suggestions.push({
      id: `sug-world-1`,
      title: 'Kingdom of Tooro & Regional Intel Briefing',
      category: 'knowledge',
      suggestedAction: 'Fetch verified 2026 Tooro succession updates and East Africa regional news',
      reason: 'Real-time grounding data stream available.',
      state: 'observing',
      requiresAuth: false,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    });

    // 5. Zero-Disclosure Security Check
    suggestions.push({
      id: `sug-sec-1`,
      title: 'Hardware Security Policy Active',
      category: 'security',
      suggestedAction: 'Enforce zero-credential disclosure on device passcodes & secrets',
      reason: 'Active shield preventing unauthorized credential extraction.',
      state: 'observing',
      requiresAuth: false,
      confidence: 0.99,
      timestamp: new Date().toISOString(),
    });

    return suggestions;
  }
}
