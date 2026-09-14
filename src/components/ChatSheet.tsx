import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  Volume2,
  Copy,
  Check,
  Trash2,
  Mic,
  Bot,
  User,
  Globe,
  ExternalLink,
  Search,
  Radio,
  PhoneCall,
  PhoneOff,
  History,
  Plus,
  Download,
  Share2,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, AssistantState, ChatSession } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { formatSessionTranscript } from '../utils/sessionStorage';

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession: ChatSession;
  allSessions: ChatSession[];
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReplayAudio: (text: string) => void;
  onClearHistory: () => void;
  assistantState: AssistantState;
  onStartVoice: () => void;
  isLiveConversation: boolean;
  onToggleLiveCall: () => void;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  isOpen,
  onClose,
  activeSession,
  allSessions,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  messages,
  onSendMessage,
  onReplayAudio,
  onClearHistory,
  assistantState,
  onStartVoice,
  isLiveConversation,
  onToggleLiveCall,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || assistantState === 'thinking') return;
    triggerHaptic('tap');
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTranscript = () => {
    triggerHaptic('tap');
    const transcript = formatSessionTranscript({
      ...activeSession,
      messages,
    });
    navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  };

  const filteredMessages = filterQuery.trim()
    ? messages.filter(
        (m) =>
          m.text.toLowerCase().includes(filterQuery.toLowerCase()) ||
          m.sources?.some((s) => s.title.toLowerCase().includes(filterQuery.toLowerCase()))
      )
    : messages;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="rodex-chat-sheet"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col justify-between"
        >
          {/* Top Session Header */}
          <header className="px-4 py-3 border-b border-neutral-900 flex items-center justify-between bg-black/90 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLiveConversation
                    ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-ping'
                    : 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white tracking-wider truncate">
                    {isLiveConversation ? 'LIVE RODEX CALL' : 'RODEX CHAT SESSION'}
                  </h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-mono shrink-0">
                    {messages.length} msgs
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 truncate">
                  <span className="truncate">{activeSession.title || 'Live Session'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Return to Voice Orb Button */}
              <button
                id="close-chat-to-orb-btn"
                onClick={() => {
                  triggerHaptic('tap');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-700/80 text-cyan-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Return to the Voice Orb screen"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="hidden sm:inline">VOICE ORB</span>
              </button>

              {/* Live Audio Call Connect / End Button */}
              <button
                id="sheet-live-call-toggle-btn"
                onClick={() => {
                  triggerHaptic('tap');
                  onToggleLiveCall();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer ${
                  isLiveConversation
                    ? 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-950 border border-rose-400'
                    : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-emerald-950 border border-emerald-400'
                }`}
                title={isLiveConversation ? 'End Live Two-Way Call' : 'Connect Live with RODEX'}
              >
                {isLiveConversation ? (
                  <>
                    <PhoneOff className="w-3.5 h-3.5 animate-pulse" />
                    <span className="hidden xs:inline">END CALL</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-100" />
                    <span className="hidden xs:inline">CONNECT LIVE</span>
                  </>
                )}
              </button>

              {/* Sessions Drawer Toggle */}
              <button
                id="toggle-session-history-btn"
                onClick={() => {
                  triggerHaptic('tap');
                  setShowSessionDrawer(!showSessionDrawer);
                }}
                title="View & Retrieve Stored Sessions"
                className={`p-2 rounded-xl border transition-colors ${
                  showSessionDrawer
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                    : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <History className="w-4 h-4" />
              </button>

              {/* Copy Full Transcript */}
              <button
                id="copy-session-transcript-btn"
                onClick={handleCopyTranscript}
                title="Copy Full Session Transcript"
                className="p-2 text-neutral-400 hover:text-cyan-400 rounded-xl hover:bg-neutral-900 border border-neutral-800 transition-colors"
              >
                {copiedTranscript ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
              </button>

              {messages.length > 0 && (
                <button
                  id="clear-chat-btn"
                  onClick={onClearHistory}
                  title="Clear current session messages"
                  className="p-2 text-neutral-500 hover:text-red-400 rounded-xl hover:bg-neutral-900 border border-neutral-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Close Sheet */}
              <button
                id="close-chat-btn"
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Session Switcher / Retrieval Drawer */}
          <AnimatePresence>
            {showSessionDrawer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-neutral-950 border-b border-neutral-800 px-4 py-3 shrink-0 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white tracking-wide">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>RETRIEVE CHAT SESSIONS</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerHaptic('tap');
                      onNewSession();
                      setShowSessionDrawer(false);
                    }}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Session</span>
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {allSessions.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 py-1">No other archived sessions.</div>
                  ) : (
                    allSessions.map((session) => {
                      const isCurrent = session.id === activeSession.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            triggerHaptic('tap');
                            onSelectSession(session);
                            setShowSessionDrawer(false);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                            isCurrent
                              ? 'bg-cyan-950/60 border-cyan-700/80 text-cyan-200'
                              : 'bg-neutral-900/80 hover:bg-neutral-800/90 border-neutral-800 text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCurrent ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-neutral-600'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{session.title}</p>
                              <span className="text-[10px] text-neutral-500">
                                {new Date(session.lastActiveAt || session.startedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {' • '}
                                {session.messages?.length || 0} messages
                              </span>
                            </div>
                          </div>

                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-semibold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Connection Banner */}
          {isLiveConversation && (
            <div className="bg-gradient-to-r from-rose-950/80 via-neutral-900 to-rose-950/80 border-b border-rose-800/60 px-4 py-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="text-xs font-semibold text-rose-200 tracking-wide">
                  LIVE TWO-WAY VOICE ACTIVE
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">
                Real-Time Neural Link
              </span>
            </div>
          )}

          {/* Quick Search inside Session */}
          {messages.length > 4 && (
            <div className="px-4 py-1.5 bg-neutral-950/60 border-b border-neutral-900 flex items-center gap-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search within this live session..."
                className="w-full bg-transparent text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="text-[10px] text-neutral-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-cyan-400">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">Live Session Connected</h3>
                <p className="text-xs max-w-xs text-neutral-400">
                  {filterQuery
                    ? `No messages matched "${filterQuery}".`
                    : 'Speak freely with RODEX. Every exchange, verification source, and query is recorded in this live session.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-xs">
                  {['Hey RODEX', 'What is on my schedule today?', 'Play music on my PC', 'Who are you?'].map(
                    (example) => (
                      <button
                        key={example}
                        onClick={() => onSendMessage(example)}
                        className="text-xs px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-cyan-500/40 transition-colors"
                      >
                        "{example}"
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-500">
                    {msg.sender === 'user' ? (
                      <>
                        <span className="font-medium text-neutral-300">
                          {msg.speaker || 'You'}
                        </span>
                        <User className="w-3 h-3 text-cyan-400" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400 font-medium">RODEX</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-cyan-600/90 to-teal-700/90 text-white rounded-tr-sm shadow-[0_4px_16px_rgba(6,182,212,0.15)]'
                        : 'bg-neutral-950 border border-neutral-800/90 text-neutral-200 rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="User uploaded attachment"
                        className="rounded-lg mb-2 max-h-48 object-cover border border-neutral-800"
                      />
                    )}
                    <p className="whitespace-pre-wrap select-text">{msg.text}</p>

                    {/* Web Search Queries & Grounded Sources from World Wide Web */}
                    {msg.sender === 'assistant' &&
                      ((msg.sources && msg.sources.length > 0) ||
                        (msg.searchQueries && msg.searchQueries.length > 0)) && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-800/70 space-y-2">
                          {msg.searchQueries && msg.searchQueries.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                                <Search className="w-3 h-3 text-cyan-400" />
                                <span>Web Query:</span>
                              </span>
                              {msg.searchQueries.map((q, idx) => (
                                <span
                                  key={`query-${idx}`}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800"
                                >
                                  "{q}"
                                </span>
                              ))}
                            </div>
                          )}

                          {msg.sources && msg.sources.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-medium mb-1.5">
                                <Globe className="w-3 h-3 text-cyan-400" />
                                <span>World Wide Web Sources ({msg.sources.length})</span>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {msg.sources.map((src, sIdx) => (
                                  <a
                                    key={`src-${sIdx}-${src.url}`}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 transition-all text-left"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs text-neutral-200 group-hover:text-cyan-300 truncate font-normal">
                                        {src.title || src.url}
                                      </p>
                                      <span className="text-[10px] text-neutral-400 group-hover:text-neutral-300 block truncate">
                                        {src.domain || 'web source'}
                                      </span>
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-cyan-400 shrink-0 transition-colors" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Action buttons on RODEX messages */}
                    {msg.sender === 'assistant' && (
                      <div className="mt-2 pt-2 border-t border-neutral-800/60 flex items-center gap-3">
                        <button
                          onClick={() => onReplayAudio(msg.text)}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                          title="Replay audio speech"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Speak</span>
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {assistantState === 'thinking' && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 w-fit">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs text-neutral-400 tracking-wide">
                  RODEX is processing live input...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <footer className="p-3 border-t border-neutral-900 bg-black/95 shrink-0 flex justify-center">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-3xl">
              <button
                type="button"
                id="chat-mic-button"
                onClick={() => {
                  triggerHaptic('tap');
                  onStartVoice();
                }}
                title={isLiveConversation ? 'Speaking directly' : 'Tap to speak into this session'}
                className={`p-3 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                  isLiveConversation
                    ? 'bg-rose-950 border-rose-600 text-rose-300 animate-pulse'
                    : 'bg-neutral-900 text-cyan-400 border-neutral-800 hover:border-cyan-500/50 hover:bg-neutral-800'
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                id="chat-text-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isLiveConversation
                    ? 'Live call active... type or speak to RODEX'
                    : 'Message RODEX in this session...'
                }
                className="flex-1 bg-neutral-950 text-white placeholder-neutral-500 text-sm px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-cyan-500/80 transition-colors"
              />

              <button
                type="submit"
                id="chat-send-button"
                disabled={!inputText.trim() || assistantState === 'thinking'}
                className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold disabled:opacity-30 disabled:hover:bg-cyan-500 transition-all active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
