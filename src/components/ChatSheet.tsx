import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  Volume2,
  Copy,
  Check,
  Trash2,
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
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Terminal,
  Play,
  Youtube,
  Mail,
  Phone,
  Lock,
  Image as ImageIcon,
  Wand2,
  Paintbrush,
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
  isLiveConversation: boolean;
  onToggleLiveCall: () => void;
  onConfirmAction?: (actionId: string, toolName: string, params: any) => Promise<void>;
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
  isLiveConversation,
  onToggleLiveCall,
  onConfirmAction,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [approvingActionId, setApprovingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleTrace = (id: string) => {
    setExpandedTraces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      console.info('[RODEX TRACE] CHAT UI RENDERED');
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
                title="Return to RODEX"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="hidden sm:inline">RODEX</span>
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
                    {msg.sender === 'assistant' && msg.actionStatus && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {msg.actionStatus === 'prepared' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Draft Ready
                          </span>
                        )}
                        {msg.actionStatus === 'completed' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            Action Completed
                          </span>
                        )}
                        {msg.actionStatus === 'failed' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Failed
                          </span>
                        )}
                        {msg.actionStatus === 'needs_confirmation' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Needs Confirmation
                          </span>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap select-text">{msg.text}</p>

                    {/* Dedicated Email Execution / Draft Card */}
                    {msg.sender === 'assistant' &&
                      msg.orchestrationTrace?.executedTools?.some(
                        (t) => (t.toolName === 'email_service' || t.toolName.startsWith('gmail_')) && t.result?.success && t.result?.output
                      ) && (
                        <div className="mt-3 space-y-2">
                          {msg.orchestrationTrace.executedTools
                            .filter((t) => (t.toolName === 'email_service' || t.toolName.startsWith('gmail_')) && t.result?.success && t.result?.output)
                            .map((toolRec, eIdx) => {
                              const out = toolRec.result.output;
                              const isDraft = out.draftId || out.to || out.recipient;
                              const toAddress = out.to || out.recipient;
                              return (
                                <div
                                  key={`email-card-${eIdx}`}
                                  className="p-3 rounded-xl border bg-neutral-900/90 border-cyan-500/30 space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                                      <Mail className="w-4 h-4 text-cyan-400" />
                                      <span>{isDraft ? 'Email Draft' : 'Email Intel'}</span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400">Encrypted</span>
                                  </div>
                                  {toAddress && (
                                    <div className="text-xs text-neutral-300">
                                      <span className="text-neutral-500 font-medium">To: </span>
                                      <span className="text-neutral-200">{toAddress}</span>
                                    </div>
                                  )}
                                  {out.subject && (
                                    <div className="text-xs text-neutral-300">
                                      <span className="text-neutral-500 font-medium">Subject: </span>
                                      <span className="text-neutral-200">{out.subject}</span>
                                    </div>
                                  )}
                                  {(out.body || out.replyContent) && (
                                    <div className="text-xs p-2 rounded-lg bg-black/50 border border-neutral-800 text-neutral-300 font-mono">
                                      {out.body || out.replyContent}
                                    </div>
                                  )}
                                  {msg.pendingConfirmation && (
                                    <div className="pt-1 flex items-center gap-2">
                                      <button
                                        onClick={async () => {
                                          if (onConfirmAction && msg.pendingConfirmation) {
                                            setApprovingActionId(msg.pendingConfirmation.actionId);
                                            try {
                                              await onConfirmAction(
                                                msg.pendingConfirmation.actionId,
                                                msg.pendingConfirmation.toolName,
                                                msg.pendingConfirmation.params
                                              );
                                            } finally {
                                              setApprovingActionId(null);
                                            }
                                          }
                                        }}
                                        disabled={approvingActionId === msg.pendingConfirmation.actionId}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center gap-1.5 transition-all"
                                      >
                                        <Send className="w-3 h-3" />
                                        <span>Send Now</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}

                    {/* Dedicated Contacts Card */}
                    {msg.sender === 'assistant' &&
                      msg.orchestrationTrace?.executedTools?.some(
                        (t) => t.toolName === 'contacts_service' && t.result?.success && (t.result?.output?.phone || t.result?.output?.email)
                      ) && (
                        <div className="mt-3 space-y-2">
                          {msg.orchestrationTrace.executedTools
                            .filter((t) => t.toolName === 'contacts_service' && t.result?.success && (t.result?.output?.phone || t.result?.output?.email))
                            .map((toolRec, cIdx) => {
                              const contact = toolRec.result.output;
                              return (
                                <div
                                  key={`contact-card-${cIdx}`}
                                  className="p-3 rounded-xl border bg-neutral-900/90 border-emerald-500/30 flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                                      <Phone className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-white truncate">
                                        {contact.name || 'Contact'}
                                      </p>
                                      <span className="text-[10px] text-neutral-400 block truncate font-mono">
                                        {contact.phone || contact.email}
                                      </span>
                                    </div>
                                  </div>
                                  {contact.phone && (
                                    <a
                                      href={`tel:${contact.phone}`}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-1 transition-all active:scale-95 shrink-0"
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>Call</span>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}

                    {/* Dedicated Image Intelligence Card */}
                    {(msg.generatedImage ||
                      (msg.sender === 'assistant' &&
                        msg.orchestrationTrace?.executedTools?.some(
                          (t) =>
                            t.toolName === 'image_intelligence' &&
                            t.result?.success &&
                            (t.result?.output?.imageUrl || t.result?.output?.url)
                        ))) && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-neutral-900/95 border border-cyan-500/40 space-y-3 shadow-xl">
                        {(() => {
                          const imgObj =
                            msg.generatedImage ||
                            msg.orchestrationTrace?.executedTools?.find(
                              (t) =>
                                t.toolName === 'image_intelligence' &&
                                t.result?.success &&
                                (t.result?.output?.imageUrl || t.result?.output?.url)
                            )?.result?.output;

                          const finalImgUrl = imgObj?.url || imgObj?.imageUrl;
                          if (!imgObj || !finalImgUrl) return null;

                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                                  <Sparkles className="w-4 h-4 text-cyan-400" />
                                  <span>{imgObj.isEdit ? 'AI Edited Image' : 'AI Generated Image'}</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                                  {imgObj.aspectRatio || '1:1'}
                                </span>
                              </div>

                              <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center border border-neutral-800 relative group">
                                <img
                                  src={finalImgUrl}
                                  alt={imgObj.prompt || 'Generated by RODEX'}
                                  className="max-h-72 w-full object-contain rounded-xl"
                                />
                                <a
                                  href={finalImgUrl}
                                  download="rodex_image.png"
                                  className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/80 hover:bg-black text-white text-xs flex items-center gap-1 shadow-lg backdrop-blur-sm"
                                  title="Download Image"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>

                              {/* Quick Conversational Edit Chips */}
                              <div className="space-y-1.5 pt-1 border-t border-neutral-800">
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1">
                                  <Wand2 className="w-3 h-3 text-cyan-400" />
                                  <span>Conversational Quick Edits:</span>
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    'Remove background',
                                    'Make the sky brighter',
                                    'Turn this into a poster',
                                    'Add realistic cinematic lighting',
                                    'Remove the tree',
                                    'Convert into an illustration',
                                  ].map((chip) => (
                                    <button
                                      key={chip}
                                      onClick={() => {
                                        triggerHaptic('tap');
                                        onSendMessage(chip);
                                      }}
                                      className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 text-neutral-300 transition-colors cursor-pointer"
                                    >
                                      {chip}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Dedicated Browser Destination / YouTube Execution Card */}
                    {msg.sender === 'assistant' &&
                      msg.orchestrationTrace?.executedTools?.some(
                        (t) => t.toolName === 'open_approved_url' && t.result?.success && t.result?.output?.url
                      ) && (
                        <div className="mt-3 space-y-2">
                          {msg.orchestrationTrace.executedTools
                            .filter((t) => t.toolName === 'open_approved_url' && t.result?.success && t.result?.output?.url)
                            .map((toolRec, tIdx) => {
                              const out = toolRec.result.output;
                              const isYt = out.destinationType === 'youtube' || out.domain?.includes('youtube');
                              const isGg = out.destinationType === 'google' || out.domain?.includes('google');

                              return (
                                <div
                                  key={`launch-${tIdx}-${out.url}`}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isYt
                                      ? 'bg-red-950/40 border-red-500/40'
                                      : isGg
                                      ? 'bg-blue-950/40 border-blue-500/40'
                                      : 'bg-cyan-950/40 border-cyan-500/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isYt
                                          ? 'bg-red-600 text-white'
                                          : isGg
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-cyan-600 text-black'
                                      }`}
                                    >
                                      {isYt ? (
                                        <Youtube className="w-4 h-4" />
                                      ) : (
                                        <Globe className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-white truncate">
                                        {out.label || 'Web Destination'}
                                      </p>
                                      <span className="text-[10px] text-neutral-400 block truncate font-mono">
                                        {out.url}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => {
                                      triggerHaptic('tap');
                                      window.open(out.url, '_blank', 'noopener,noreferrer');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm ${
                                      isYt
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                    }`}
                                  >
                                    <span>{isYt ? 'Open YouTube' : 'Open in Browser'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}

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

                    {/* Pending Action Confirmation Card */}
                    {msg.sender === 'assistant' && msg.pendingConfirmation && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Operator Approval Required</span>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {msg.pendingConfirmation.description}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={async () => {
                              if (onConfirmAction && msg.pendingConfirmation) {
                                setApprovingActionId(msg.pendingConfirmation.actionId);
                                try {
                                  await onConfirmAction(
                                    msg.pendingConfirmation.actionId,
                                    msg.pendingConfirmation.toolName,
                                    msg.pendingConfirmation.params
                                  );
                                } finally {
                                  setApprovingActionId(null);
                                }
                              }
                            }}
                            disabled={approvingActionId === msg.pendingConfirmation.actionId}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>
                              {approvingActionId === msg.pendingConfirmation.actionId
                                ? 'Executing...'
                                : 'Approve & Execute'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Orchestration & Reasoning Trace View */}
                    {msg.sender === 'assistant' && msg.orchestrationTrace && (
                      <div className="mt-2.5 pt-2 border-t border-neutral-800/60">
                        <button
                          type="button"
                          onClick={() => toggleTrace(msg.id)}
                          className="w-full flex items-center justify-between text-[10px] text-neutral-400 hover:text-cyan-400 transition-colors py-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-cyan-400" />
                            <span className="font-mono font-medium text-cyan-300">
                              Orchestrator: {msg.orchestrationTrace.intent.primaryIntent}
                            </span>
                            <span className="text-neutral-500">•</span>
                            <span className="text-neutral-400">
                              {msg.orchestrationTrace.totalLatencyMs}ms
                            </span>
                            {msg.orchestrationTrace.validationPassed && (
                              <span className="px-1 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-[9px]">
                                Verified
                              </span>
                            )}
                          </div>
                          {expandedTraces[msg.id] ? (
                            <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </button>

                        {expandedTraces[msg.id] && (
                          <div className="mt-2 p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[11px] space-y-2 font-mono">
                            <div className="flex items-center justify-between text-neutral-400 pb-1 border-b border-neutral-800">
                              <span>Model: {msg.orchestrationTrace.selectedModel}</span>
                              <span>Confidence: {Math.round(msg.orchestrationTrace.intent.confidence * 100)}%</span>
                            </div>

                            {/* Plan Steps */}
                            {msg.orchestrationTrace.plan && msg.orchestrationTrace.plan.steps.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1">
                                  <Layers className="w-3 h-3" />
                                  <span>Task Plan</span>
                                </div>
                                <div className="space-y-1 pl-1">
                                  {msg.orchestrationTrace.plan.steps.map((step) => (
                                    <div key={step.stepNumber} className="flex items-start gap-1.5 text-neutral-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                      <span>
                                        {step.stepNumber}. {step.description}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Executed Tools */}
                            {msg.orchestrationTrace.executedTools && msg.orchestrationTrace.executedTools.length > 0 && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1">
                                  <Terminal className="w-3 h-3" />
                                  <span>Executed Tools</span>
                                </div>
                                <div className="space-y-1.5 pl-1">
                                  {msg.orchestrationTrace.executedTools.map((t, idx) => (
                                    <div
                                      key={`tool-${idx}`}
                                      className="p-1.5 rounded bg-black/50 border border-neutral-800/80 text-[10px]"
                                    >
                                      <div className="flex items-center justify-between text-cyan-300">
                                        <span>tool: {t.toolName}</span>
                                        <span className="text-neutral-400">{t.latencyMs}ms</span>
                                      </div>
                                      {t.result.message && (
                                        <div className="text-neutral-300 mt-0.5 truncate">
                                          output: {t.result.message}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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

            {/* The character expresses concentration; no visible artificial
                listening/thinking/processing badge is added to the conversation. */}
            {(assistantState === 'thinking' || assistantState === 'processing') && (
              <span className="sr-only" role="status">RODEX is preparing a reply.</span>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <footer className="p-3 border-t border-neutral-900 bg-black/95 shrink-0 flex justify-center">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-3xl">
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
