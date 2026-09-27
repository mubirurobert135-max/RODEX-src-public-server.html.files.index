import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  LogIn,
  Search,
  Send,
  Volume2,
  FileEdit,
  Clock,
  ShieldCheck,
  Bell,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { globalGmailClient, ClientGmailStatus, ClientEmailSummary, ClientEmailDetail } from '../services/gmail/gmailClient';
import { triggerHaptic } from '../utils/haptics';
import { rodexSynth } from '../utils/speech';

interface GmailHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (text: string) => void;
}

export const GmailHubModal: React.FC<GmailHubModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [status, setStatus] = useState<ClientGmailStatus>({ isConnected: false, scopes: [] });
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<ClientEmailSummary[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<ClientEmailDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [backgroundAlerts, setBackgroundAlerts] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStatusAndEmails();
    }
  }, [isOpen]);

  // Setup background alerts if enabled
  useEffect(() => {
    if (status.isConnected && backgroundAlerts) {
      globalGmailClient.startBackgroundChecking((notif) => {
        if (onNotification) {
          onNotification(notif.spokenText);
        }
      }, 60000);
    } else {
      globalGmailClient.stopBackgroundChecking();
    }
    return () => globalGmailClient.stopBackgroundChecking();
  }, [status.isConnected, backgroundAlerts]);

  const loadStatusAndEmails = async () => {
    setLoading(true);
    try {
      const currentStatus = await globalGmailClient.getStatus();
      setStatus(currentStatus);
      if (currentStatus.isConnected) {
        const msgs = await globalGmailClient.listMessages({ maxResults: 10 });
        setEmails(msgs);
      }
    } catch (err: any) {
      console.warn('Failed loading Gmail status', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    triggerHaptic('tap');
    setLoading(true);
    setActionNotice(null);
    try {
      const updated = await globalGmailClient.connect();
      setStatus(updated);
      if (updated.isConnected) {
        setActionNotice('Gmail successfully connected!');
        const msgs = await globalGmailClient.listMessages({ maxResults: 10 });
        setEmails(msgs);
      }
    } catch (err: any) {
      setActionNotice(err?.message || 'Failed connecting to Gmail.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    triggerHaptic('tap');
    setLoading(true);
    try {
      await globalGmailClient.disconnect();
      setStatus({ isConnected: false, scopes: [] });
      setEmails([]);
      setSelectedEmail(null);
      setActionNotice('Gmail disconnected.');
    } catch (err: any) {
      setActionNotice(err?.message || 'Error disconnecting.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckNew = async () => {
    triggerHaptic('tap');
    setLoading(true);
    try {
      const result = await globalGmailClient.checkNew(5);
      setActionNotice(result.spokenSummary);
      if (result.messages && result.messages.length > 0) {
        setEmails(result.messages);
      }
      rodexSynth.speak(result.spokenSummary);
    } catch (err: any) {
      setActionNotice(err?.message || 'Error checking emails.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      return loadStatusAndEmails();
    }
    triggerHaptic('tap');
    setLoading(true);
    try {
      const results = await globalGmailClient.listMessages({ query: searchQuery, maxResults: 10 });
      setEmails(results);
      setActionNotice(`Found ${results.length} email(s) for "${searchQuery}".`);
    } catch (err: any) {
      setActionNotice(err?.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmail = async (id: string) => {
    triggerHaptic('tap');
    setLoading(true);
    try {
      const detail = await globalGmailClient.getMessage(id);
      setSelectedEmail(detail);
      setIsDrafting(false);
      setReplyText('');
    } catch (err: any) {
      setActionNotice('Could not load email detail.');
    } finally {
      setLoading(false);
    }
  };

  const handleReadAloud = (email: ClientEmailDetail) => {
    triggerHaptic('tap');
    const spoken = `Email from ${email.senderName}. Subject: "${email.subject}". Message: "${email.body.slice(0, 300)}".`;
    rodexSynth.speak(spoken);
    setActionNotice('Reading email aloud...');
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    triggerHaptic('tap');
    setLoading(true);
    try {
      await globalGmailClient.sendReply({
        emailId: selectedEmail.id,
        replyContent: replyText.trim(),
      });
      setActionNotice(`Reply sent to ${selectedEmail.senderName}!`);
      setIsDrafting(false);
      setReplyText('');
      rodexSynth.speak('Your reply has been sent.');
    } catch (err: any) {
      setActionNotice(`Failed to send: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    triggerHaptic('tap');
    setLoading(true);
    try {
      await globalGmailClient.draftReply({
        emailId: selectedEmail.id,
        replyContent: replyText.trim(),
      });
      setActionNotice('Draft saved to your Gmail account.');
      setIsDrafting(false);
      setReplyText('');
    } catch (err: any) {
      setActionNotice(`Draft error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden font-sans text-white"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600/30 to-amber-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">Gmail Integration</h2>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      status.isConnected
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {status.isConnected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Connected
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-neutral-500" />
                        Not Connected
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {status.isConnected && status.userEmail
                    ? `Authorized for: ${status.userEmail}`
                    : 'Official Google OAuth 2.0 & Gmail API'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Notification Banner */}
          {actionNotice && (
            <div className="px-4 py-2 bg-cyan-950/70 border-b border-cyan-800/40 text-cyan-300 text-xs flex items-center justify-between">
              <span>{actionNotice}</span>
              <button
                onClick={() => setActionNotice(null)}
                className="text-cyan-400 hover:text-white text-[11px] underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Connection Status & Account Card */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-neutral-200">
                  {status.isConnected ? 'Gmail Account Active' : 'Connect Your Gmail Account'}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  {status.isConnected
                    ? `RODEX can check unread emails, read content aloud, and draft or send authorized replies.`
                    : 'Connect securely using official Google OAuth. Passwords are never requested or stored.'}
                </p>
                {status.lastChecked && (
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>Last checked: {new Date(status.lastChecked).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {status.isConnected ? (
                  <>
                    <button
                      onClick={handleCheckNew}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>Check New</span>
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-red-950/80 border border-neutral-800 hover:border-red-500/40 text-neutral-300 hover:text-red-300 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-950/40 transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{loading ? 'Connecting...' : 'Connect Gmail'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Background Notification Toggle */}
            {status.isConnected && (
              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-neutral-300">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>Background New-Mail Announcements</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backgroundAlerts}
                    onChange={(e) => setBackgroundAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>
            )}

            {/* Email Search & Filter */}
            {status.isConnected && (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search by sender, subject, or query (e.g. from:Robert)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500/80 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  Search
                </button>
              </form>
            )}

            {/* Selected Email Detail View */}
            {selectedEmail && (
              <div className="p-4 rounded-2xl bg-neutral-900/90 border border-cyan-500/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedEmail.subject}</h3>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      From: <span className="text-neutral-200 font-medium">{selectedEmail.sender}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500">{new Date(selectedEmail.date).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleReadAloud(selectedEmail)}
                      className="p-1.5 rounded-lg bg-cyan-950 text-cyan-300 hover:bg-cyan-900 transition-all cursor-pointer"
                      title="Read aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedEmail(null)}
                      className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedEmail.hasAttachments && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/40">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Contains {selectedEmail.attachmentCount} attachment(s)</span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 text-xs text-neutral-300 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap select-text">
                  {selectedEmail.body}
                </div>

                {/* Drafting / Reply Section */}
                <div className="pt-2 border-t border-neutral-800 space-y-2">
                  {!isDrafting ? (
                    <button
                      onClick={() => setIsDrafting(true)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Prepare Reply</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        placeholder="Type reply message content (e.g. 'I will attend tomorrow')..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500/80 text-xs text-neutral-200 placeholder-neutral-500 outline-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Confirmation required before sending</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsDrafting(false)}
                            className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDraftReply}
                            disabled={loading || !replyText.trim()}
                            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer"
                          >
                            Save Draft
                          </button>
                          <button
                            onClick={handleSendReply}
                            disabled={loading || !replyText.trim()}
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-red-950/40 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send Reply</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emails List */}
            {status.isConnected && !selectedEmail && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                  <span>Recent Inbox Messages ({emails.length})</span>
                  <span>Click to view & reply</span>
                </div>

                {emails.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500 bg-neutral-900/30 rounded-2xl border border-neutral-900">
                    No emails found. Click &quot;Check New&quot; to refresh.
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleSelectEmail(email.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        !email.isRead
                          ? 'bg-neutral-900/90 border-cyan-500/40 hover:border-cyan-400'
                          : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              !email.isRead ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-transparent'
                            }`}
                          />
                          <span className="text-xs font-semibold text-white">{email.senderName}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500">{new Date(email.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-neutral-300 font-medium mt-1 truncate">{email.subject}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{email.snippet}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quick Natural Voice Commands Reference */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/30 border border-neutral-800/60 space-y-2">
              <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>RODEX Gmail Voice & Text Commands</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-neutral-400 font-mono">
                <div>• &quot;Do I have any new emails?&quot;</div>
                <div>• &quot;Read my latest email&quot;</div>
                <div>• &quot;Find the email about my assignment&quot;</div>
                <div>• &quot;Summarize my latest email&quot;</div>
                <div>• &quot;Reply saying I&apos;ll attend tomorrow&quot;</div>
                <div>• &quot;Send the reply&quot;</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
