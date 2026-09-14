import { ChatSession, ChatMessage } from '../types';

const ACTIVE_SESSION_KEY = 'rodex_live_chat_active_session';
const SESSIONS_HISTORY_KEY = 'rodex_live_chat_sessions_history';

export const createDefaultInitialSession = (): ChatSession => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  const initialMessages: ChatMessage[] = [
    {
      id: `init-${Date.now()}-1`,
      sender: 'assistant',
      text: 'Hlo Mr Robert. Live neural connection with RODEX is operational. Speech recognition, World Wide Web verification, and Spotify PC controls are linked and listening.',
      timestamp: timeStr,
      speakerVerified: true,
      webGrounded: true,
      sources: [
        {
          title: 'RODEX Core Neural Link & World Wide Web Gateway',
          url: 'https://google.com',
          domain: 'google.com',
        },
      ],
    },
  ];

  return {
    id: `session-live-${Date.now()}`,
    title: `Live Session • ${dateStr}`,
    startedAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    isLive: true,
    messages: initialMessages,
    speaker: 'Mr. Robert',
  };
};

export const loadActiveSession = (): ChatSession => {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.messages)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SessionStorage] Failed to load active session:', err);
  }

  const defaultSession = createDefaultInitialSession();
  saveActiveSession(defaultSession);
  return defaultSession;
};

export const saveActiveSession = (session: ChatSession): void => {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));

    // Also update this session in history
    const history = loadAllSessions();
    const existingIdx = history.findIndex((s) => s.id === session.id);
    if (existingIdx >= 0) {
      history[existingIdx] = session;
    } else {
      history.unshift(session);
    }
    // Cap history at 15 sessions
    const capped = history.slice(0, 15);
    localStorage.setItem(SESSIONS_HISTORY_KEY, JSON.stringify(capped));
  } catch (err) {
    console.warn('[SessionStorage] Failed to save active session:', err);
  }
};

export const loadAllSessions = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[SessionStorage] Failed to load session history:', err);
  }
  return [];
};

export const createNewSession = (customTitle?: string): ChatSession => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const newSession: ChatSession = {
    id: `session-live-${Date.now()}`,
    title: customTitle || `Live Session • ${dateStr}`,
    startedAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    isLive: true,
    messages: [
      {
        id: `init-${Date.now()}`,
        sender: 'assistant',
        text: 'Hlo Mr Robert. New live session connected. I am listening for your voice commands.',
        timestamp: timeStr,
        speakerVerified: true,
      },
    ],
    speaker: 'Mr. Robert',
  };

  saveActiveSession(newSession);
  return newSession;
};

export const deleteSessionFromHistory = (sessionId: string): ChatSession[] => {
  try {
    const history = loadAllSessions().filter((s) => s.id !== sessionId);
    localStorage.setItem(SESSIONS_HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch (err) {
    console.warn('[SessionStorage] Failed to delete session:', err);
    return [];
  }
};

export const formatSessionTranscript = (session: ChatSession): string => {
  const header = `=== RODEX LIVE CHAT SESSION TRANSCRIPT ===\n` +
    `Session ID: ${session.id}\n` +
    `Title: ${session.title}\n` +
    `Started: ${new Date(session.startedAt).toLocaleString()}\n` +
    `Last Active: ${new Date(session.lastActiveAt).toLocaleString()}\n` +
    `User: ${session.speaker} (Voice Verified)\n` +
    `Exchanges: ${session.messages.length}\n` +
    `==========================================\n\n`;

  const body = session.messages
    .map((m) => {
      const speaker = m.sender === 'user' ? `${m.speaker || 'Mr. Robert'}` : 'RODEX (AI)';
      let line = `[${m.timestamp}] ${speaker}:\n${m.text}\n`;
      if (m.sources && m.sources.length > 0) {
        line += `Sources: ${m.sources.map((s) => s.title || s.url).join(', ')}\n`;
      }
      return line;
    })
    .join('\n');

  return header + body;
};
