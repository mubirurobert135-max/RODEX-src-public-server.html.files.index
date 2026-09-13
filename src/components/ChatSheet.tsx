import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Volume2, Copy, Check, Trash2, Mic, Bot, User, Globe, ExternalLink, Search } from 'lucide-react';
import { ChatMessage, AssistantState } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onReplayAudio: (text: string) => void;
  onClearHistory: () => void;
  assistantState: AssistantState;
  onStartVoice: () => void;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onReplayAudio,
  onClearHistory,
  assistantState,
  onStartVoice,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
          {/* Header */}
          <header className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between bg-black/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
              <h2 className="text-base font-semibold text-white tracking-wider">
                RODEX LOGS
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                {messages.length} exchanges
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Web Connected</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  id="clear-chat-btn"
                  onClick={onClearHistory}
                  title="Clear conversation"
                  className="p-2 text-neutral-500 hover:text-red-400 rounded-xl hover:bg-neutral-900 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                id="close-chat-btn"
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-cyan-400">
                  <Bot className="w-6 h-6" />
                </div>
                <p className="text-sm max-w-xs text-neutral-400">
                  No previous records. Tap the microphone or type below to converse with RODEX.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-xs">
                  {['Hey RODEX', 'Who are you?', 'Recognize my voice', 'Give me 3 productivity tips'].map(
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
              messages.map((msg) => (
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
                          {msg.speaker || 'Mr. Robert'}
                        </span>
                        {msg.speakerVerified !== false && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                            Voice Verified
                          </span>
                        )}
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
                    {msg.sender === 'assistant' && ((msg.sources && msg.sources.length > 0) || (msg.searchQueries && msg.searchQueries.length > 0)) && (
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
                  RODEX is analyzing...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <footer className="p-3 border-t border-neutral-900 bg-black/90">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <button
                type="button"
                id="chat-mic-button"
                onClick={() => {
                  triggerHaptic('tap');
                  onClose();
                  onStartVoice();
                }}
                title="Tap to speak"
                className="p-3 rounded-xl bg-neutral-900 text-cyan-400 border border-neutral-800 hover:border-cyan-500/50 hover:bg-neutral-800 transition-colors active:scale-95"
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                id="chat-text-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask RODEX anything..."
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
