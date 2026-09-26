import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Brain,
  Database,
  Smartphone,
  Phone,
  Mail,
  Globe,
  Layers,
  Shield,
  CheckCircle2,
  Sparkles,
  Zap,
  Play,
  ArrowRight,
  Lock,
  Cpu,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface CapabilityDomain {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  status: 'active' | 'standby' | 'restricted';
  version: string;
  tools: string[];
  features: string[];
  subsystems: Array<{ name: string; status: 'active' | 'standby' | 'healthy'; description: string }>;
}

interface ProactiveSuggestion {
  id: string;
  title: string;
  category: string;
  suggestedAction: string;
  reason: string;
  state: 'observing' | 'suggesting' | 'preparing' | 'executing';
  requiresAuth: boolean;
  confidence: number;
}

interface CapabilityHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePrompt?: (prompt: string) => void;
}

export const CapabilityHubModal: React.FC<CapabilityHubModalProps> = ({
  isOpen,
  onClose,
  onExecutePrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'domains' | 'compound' | 'proactive' | 'architecture'>('domains');
  const [domains, setDomains] = useState<CapabilityDomain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<CapabilityDomain | null>(null);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCapabilities = async () => {
    setLoading(true);
    try {
      const [capRes, proRes] = await Promise.all([
        fetch('/api/rodex/capabilities'),
        fetch('/api/rodex/proactive'),
      ]);
      if (capRes.ok) {
        const data = await capRes.json();
        setDomains(data.domains || []);
        if (data.domains && data.domains.length > 0 && !selectedDomain) {
          setSelectedDomain(data.domains[0]);
        }
      }
      if (proRes.ok) {
        const data = await proRes.json();
        setProactiveSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.warn('Failed to load capability data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCapabilities();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getDomainIcon = (iconName: string) => {
    switch (iconName) {
      case 'Brain':
        return <Brain className="w-5 h-5 text-purple-400" />;
      case 'Database':
        return <Database className="w-5 h-5 text-amber-400" />;
      case 'Smartphone':
        return <Smartphone className="w-5 h-5 text-blue-400" />;
      case 'Phone':
        return <Phone className="w-5 h-5 text-emerald-400" />;
      case 'Mail':
        return <Mail className="w-5 h-5 text-pink-400" />;
      case 'Globe':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      case 'Layers':
        return <Layers className="w-5 h-5 text-indigo-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      default:
        return <Cpu className="w-5 h-5 text-cyan-400" />;
    }
  };

  const compoundExamples = [
    {
      title: 'Compound WhatsApp Coordination',
      query: 'Open WhatsApp, find Rose and tell her that the meeting has moved to tomorrow.',
      description: 'Resolves contact -> Prepares WhatsApp message -> Requires confirmation to dispatch.',
      icon: Phone,
      tag: 'Communication & Device',
    },
    {
      title: 'Compound Email Search & Reply',
      query: "Find the latest email from John, summarize it and draft a reply telling him I'll respond tomorrow.",
      description: 'Searches John email -> Extracts summary -> Prepares draft reply with exact wording.',
      icon: Mail,
      tag: 'Email & Reasoning',
    },
    {
      title: 'Compound Research & Memory Save',
      query: 'Search for recent quantum computing breakthroughs and save key findings to memory.',
      description: 'Executes Google web search -> Synthesizes key discoveries -> Persists into long-term memory.',
      icon: Globe,
      tag: 'Web & Long-Term Memory',
    },
    {
      title: 'Exact Minimal Command Output',
      query: 'Say only: Hello Robert',
      description: 'Fast-path instant passthrough mode. Strictly outputs the requested phrase without filler.',
      icon: Zap,
      tag: 'Strict Command Following',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        id="rodex-capability-hub-modal"
        initial={{ opacity: 0, y: '30%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '30%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between bg-black/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wider">RODEX CAPABILITY HUB</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  MULTI-DOMAIN AI
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                Extensible AI Brain &bull; 8 Capability Domains &bull; Multi-Step Automation
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-neutral-900/60 bg-neutral-950 flex gap-2">
          {[
            { id: 'domains', label: '8 Capability Domains', icon: Cpu },
            { id: 'compound', label: 'Compound Workflows', icon: Layers },
            { id: 'proactive', label: 'Proactive Intelligence', icon: Sparkles },
            { id: 'architecture', label: 'System Architecture', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic('tap');
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 max-w-4xl mx-auto w-full space-y-6">
          {/* TAB 1: 8 CAPABILITY DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Central AI Brain with Independent Modules</h3>
                    <p className="text-[11px] text-neutral-400">
                      RODEX is not merely a phone assistant. Device and assistant functions are modular tools connected to an extensible intelligence core.
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchCapabilities}
                  disabled={loading}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {/* Grid of Domains */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {domains.map((domain) => {
                  const isSelected = selectedDomain?.id === domain.id;
                  return (
                    <div
                      key={domain.id}
                      onClick={() => {
                        triggerHaptic('tap');
                        setSelectedDomain(domain);
                      }}
                      className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-neutral-900/90 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
                          : 'bg-neutral-950 hover:bg-neutral-900/50 border-neutral-800/80'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                            {getDomainIcon(domain.icon)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">{domain.name}</h4>
                            <span className="text-[10px] text-cyan-400 font-mono">v{domain.version}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {domain.status.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-300 line-clamp-2 mb-3">
                        {domain.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-900">
                        {domain.features.slice(0, 3).map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{feat}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Inspector for Selected Domain */}
              {selectedDomain && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-cyan-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <div className="flex items-center gap-2">
                      {getDomainIcon(selectedDomain.icon)}
                      <h4 className="text-xs font-bold text-white uppercase">{selectedDomain.name} Specifications</h4>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Tools: {selectedDomain.tools.join(', ')}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">{selectedDomain.tagline}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                    {selectedDomain.subsystems.map((sub, sIdx) => (
                      <div key={sIdx} className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-200">
                          <span>{sub.name}</span>
                          <span className="text-[9px] text-emerald-400 font-mono">ACTIVE</span>
                        </div>
                        <p className="text-[10px] text-neutral-400">{sub.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPOUND MULTI-STEP WORKFLOWS */}
          {activeTab === 'compound' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white">Multi-Step Task Execution Pipeline</h3>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  RODEX seamlessly converts compound instructions into structured execution graphs:
                  <br />
                  <span className="text-cyan-300 font-mono text-[10px]">
                    User Request &rarr; Intent Deconstruction &rarr; Phased Plan &rarr; Tool Selection &rarr; Execution &rarr; Verification &rarr; Memory Update &rarr; Response
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-neutral-300">
                  Ready-to-Test Compound Workflows:
                </span>
                {compoundExamples.map((ex, idx) => {
                  const Icon = ex.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white">{ex.title}</h4>
                          <span className="text-[9px] px-2 py-0.2 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 font-mono">
                            {ex.tag}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-black font-mono text-[11px] text-cyan-300 border border-neutral-900">
                          "{ex.query}"
                        </div>
                        <p className="text-[10px] text-neutral-400">{ex.description}</p>
                      </div>

                      <button
                        onClick={() => {
                          triggerHaptic('tap');
                          onExecutePrompt?.(ex.query);
                          onClose();
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>Run Workflow</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: PROACTIVE INTELLIGENCE */}
          {activeTab === 'proactive' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white">Controlled Proactive Intelligence</h3>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  RODEX detects context where assistance is helpful while maintaining strict control.
                  Autonomous execution of sensitive or financial actions is strictly blocked without explicit confirmation.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[10px] font-mono">
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <span className="text-neutral-400 block">Phase 1</span>
                    <span className="text-blue-400 font-bold">Observing</span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <span className="text-neutral-400 block">Phase 2</span>
                    <span className="text-cyan-400 font-bold">Suggesting</span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <span className="text-neutral-400 block">Phase 3</span>
                    <span className="text-amber-400 font-bold">Preparing</span>
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center">
                    <span className="text-neutral-400 block">Phase 4</span>
                    <span className="text-emerald-400 font-bold">Executing</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-neutral-300">
                  Active Contextual Suggestions ({proactiveSuggestions.length}):
                </span>
                {proactiveSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{sug.title}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                          {sug.state}
                        </span>
                        {sug.requiresAuth && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-0.5">
                            <Lock className="w-2 h-2" /> Auth Required
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-300">{sug.suggestedAction}</p>
                      <p className="text-[10px] text-neutral-500">{sug.reason}</p>
                    </div>

                    <button
                      onClick={() => {
                        triggerHaptic('tap');
                        onExecutePrompt?.(sug.suggestedAction);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-cyan-400 text-xs font-medium shrink-0 transition-colors"
                    >
                      Execute
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white">RODEX Modular Core Architecture</h3>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  The RODEX Intelligence Core decouples central cognitive reasoning from platform and peripheral tools. New capabilities can be registered dynamically without rebuilding the core.
                </p>

                <div className="p-4 rounded-xl bg-black border border-neutral-900 font-mono text-[11px] text-neutral-300 space-y-1 overflow-x-auto">
                  <div className="text-cyan-400 font-bold">RODEX CORE</div>
                  <div>│</div>
                  <div>├── Reasoning Engine (Quantitative, Comparative, Phased)</div>
                  <div>├── Conversation Engine (Multi-Turn Continuity, Pronoun Resolution)</div>
                  <div>├── Memory Engine (Encrypted Long-Term Recall, Preferences)</div>
                  <div>├── Planning Engine (Task Decomposition, Tool Orchestration)</div>
                  <div>├── Tool Router (Validation, Sandboxing, Parameter Checking)</div>
                  <div>├── Security Layer (Zero-Disclosure Hardware Shield, Passcode Gate)</div>
                  <div>├── Permission Manager (Microphone, Contacts, Email, Hardware)</div>
                  <div>├── Voice Engine (Synthesis, Custom Wake-Word, Speaker Profile)</div>
                  <div>├── Device Bridge (Android Platform, App Launch Schemes, Spotify PC)</div>
                  <div>├── Web & Cultural Intel (Google Grounding, Tooro Royal History)</div>
                  <div>├── Communication Tools (Android Contacts, Calling, WhatsApp)</div>
                  <div>└── Email Hub (Authorized Inbox Reading, Strict Draft Synthesis)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
