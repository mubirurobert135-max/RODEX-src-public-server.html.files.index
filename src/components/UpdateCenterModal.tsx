import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  X,
  Cpu,
  Layers,
  Sparkles,
  GitCommit,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { SystemUpdateState, TechnologyUpdateItem } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface UpdateCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakStatus?: (text: string) => void;
}

export const UpdateCenterModal: React.FC<UpdateCenterModalProps> = ({
  isOpen,
  onClose,
  onSpeakStatus,
}) => {
  const [updateState, setUpdateState] = useState<SystemUpdateState>({
    version: 'v4.8.2-prod',
    lastCheckedAt: new Date().toISOString(),
    policyLevel: 3,
    autoApplyLowRisk: true,
    updates: [],
    history: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'updates' | 'policy' | 'history'>('updates');
  const [selectedUpdate, setSelectedUpdate] = useState<TechnologyUpdateItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUpdateStatus();
    }
  }, [isOpen]);

  const fetchUpdateStatus = async () => {
    try {
      const res = await fetch('/api/updates/status');
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data);
        if (data.updates?.length > 0 && !selectedUpdate) {
          setSelectedUpdate(data.updates[0]);
        }
      }
    } catch (err) {
      console.warn('[Update Status Fetch Error]', err);
    }
  };

  const handleCheckUpdates = async () => {
    setLoading(true);
    triggerHaptic('activate');
    onSpeakStatus?.('Scanning trusted technology sources and security advisories for verified updates.');
    try {
      const res = await fetch('/api/updates/check', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data.updateSystemState);
        onSpeakStatus?.('Technology scan complete. Updates evaluated successfully.');
      }
    } catch (err) {
      console.warn('[Update Check Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async (id: string) => {
    triggerHaptic('tap');
    try {
      const res = await fetch(`/api/updates/${id}/apply`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data.updateSystemState);
        onSpeakStatus?.('Update approved, validated, and deployed successfully.');
      }
    } catch (err) {
      console.warn('[Apply Update Error]', err);
    }
  };

  const handleRollback = async (id: string) => {
    triggerHaptic('tap');
    try {
      const res = await fetch(`/api/updates/${id}/rollback`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data.updateSystemState);
        onSpeakStatus?.('Successfully rolled back to previous stable checkpoint.');
      }
    } catch (err) {
      console.warn('[Rollback Error]', err);
    }
  };

  const handleUpdatePolicy = async (level: number, autoApply: boolean) => {
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/updates/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyLevel: level, autoApplyLowRisk: autoApply }),
      });
      if (res.ok) {
        const data = await res.json();
        setUpdateState(data.updateSystemState);
        onSpeakStatus?.(`Update policy updated to Level ${level}.`);
      }
    } catch (err) {
      console.warn('[Update Policy Error]', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                  RODEX Autonomous Update & Intelligence
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                    {updateState.version}
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Continuous Technology Discovery • Safe Compatibility Engine • Policy Level {updateState.policyLevel}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('tap');
                onClose();
              }}
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-neutral-900/40 border-b border-neutral-800 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { triggerHaptic('tap'); setActiveTab('updates'); }}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'updates' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Available Updates ({updateState.updates.length})
              </button>
              <button
                onClick={() => { triggerHaptic('tap'); setActiveTab('policy'); }}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'policy' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Update Policy & Governance
              </button>
              <button
                onClick={() => { triggerHaptic('tap'); setActiveTab('history'); }}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'history' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Audit Log & Rollbacks ({updateState.history.length})
              </button>
            </div>

            <button
              onClick={handleCheckUpdates}
              disabled={loading}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs text-cyan-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning Sources...' : 'Check for Updates'}
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'updates' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Updates List */}
                <div className="md:col-span-1 space-y-3">
                  <div className="text-xs font-semibold text-neutral-400">Discovered Technologies</div>
                  <div className="space-y-2.5">
                    {updateState.updates.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          triggerHaptic('tap');
                          setSelectedUpdate(item);
                        }}
                        className={`p-3.5 bg-neutral-900/80 hover:bg-neutral-850 border rounded-2xl cursor-pointer transition-all ${
                          selectedUpdate?.id === item.id ? 'border-cyan-500/60 bg-neutral-900 shadow-lg shadow-cyan-500/5' : 'border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase border ${
                            item.category === 'security'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : item.category === 'ai_model'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}>
                            {item.category.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {item.currentVersion} → {item.availableVersion}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white mt-2">{item.name}</div>
                        <div className="flex items-center justify-between mt-3 text-[11px]">
                          <span className="text-cyan-400 font-medium capitalize">{item.status}</span>
                          <span className="text-neutral-500 font-mono">Compatibility: {item.compatibilityScore}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Update Inspector & Details */}
                <div className="md:col-span-2">
                  {selectedUpdate ? (
                    <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-3xl space-y-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{selectedUpdate.name}</h3>
                            <span className="text-xs text-neutral-400 font-mono">({selectedUpdate.currentVersion} → {selectedUpdate.availableVersion})</span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{selectedUpdate.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full">
                            Compatibility: {selectedUpdate.compatibilityScore}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
                          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" /> Potential Benefits
                          </div>
                          <ul className="space-y-1">
                            {selectedUpdate.potentialBenefits.map((b, idx) => (
                              <li key={idx} className="text-neutral-300 flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
                          <div className="text-orange-400 font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" /> Potential Risks
                          </div>
                          <ul className="space-y-1">
                            {selectedUpdate.potentialRisks.length === 0 ? (
                              <li className="text-neutral-500 italic">No risks identified.</li>
                            ) : (
                              selectedUpdate.potentialRisks.map((r, idx) => (
                                <li key={idx} className="text-neutral-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                  {r}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>

                      {selectedUpdate.breakingChangesWarning && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Breaking Change Advisory:</strong> {selectedUpdate.breakingChangesWarning}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
                        <div className="text-xs text-neutral-400">
                          Status: <strong className="text-white capitalize">{selectedUpdate.status}</strong>
                        </div>

                        <div className="flex items-center gap-3">
                          {selectedUpdate.status !== 'applied' ? (
                            <button
                              onClick={() => handleApplyUpdate(selectedUpdate.id)}
                              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Approve & Deploy Update
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRollback(selectedUpdate.id)}
                              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-xl border border-neutral-700 transition-all flex items-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4 text-orange-400" />
                              Roll Back to Previous Checkpoint
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-neutral-500 bg-neutral-900/40 border border-neutral-800 rounded-3xl">
                      Select an update item to inspect compatibility and apply updates.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'policy' && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-white">Safe Update Policy & Background Scheduler</h3>
                  <p className="text-xs text-neutral-400">
                    Configure background technology scan intervals (Daily / Weekly) and automation governance in accordance with NCSC security guidelines.
                  </p>
                </div>

                {/* Scheduler interval selector */}
                <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Background Scheduler Interval</div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Automated background checks for security advisories and model telemetry.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['daily', 'weekly', 'manual'].map((interval) => (
                      <button
                        key={interval}
                        onClick={async () => {
                          triggerHaptic('tap');
                          await fetch('/api/updates/policy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ intervalType: interval }),
                          });
                          onSpeakStatus?.(`Background scheduler set to ${interval}.`);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-neutral-700 transition-colors"
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      level: 1,
                      title: 'Level 1 — Information Only',
                      desc: 'RODEX discovers and lists new technology releases without active recommendations.',
                    },
                    {
                      level: 2,
                      title: 'Level 2 — Recommendations & Insights',
                      desc: 'RODEX evaluates compatibility and presents structured recommendations with benefits and risks.',
                    },
                    {
                      level: 3,
                      title: 'Level 3 — Low-Risk Automated Deployment',
                      desc: 'RODEX automatically applies pre-approved low-risk security patches and minor dependency fixes after passing automated test suites.',
                    },
                    {
                      level: 4,
                      title: 'Level 4 — Strict Human Approval Required',
                      desc: 'Requires manual human sign-off for all dependency upgrades, AI model swaps, and core architectural changes.',
                    },
                  ].map((p) => (
                    <div
                      key={p.level}
                      onClick={() => handleUpdatePolicy(p.level, updateState.autoApplyLowRisk)}
                      className={`p-4 bg-neutral-900 border rounded-2xl cursor-pointer transition-all ${
                        updateState.policyLevel === p.level
                          ? 'border-cyan-500 bg-neutral-900 shadow-lg shadow-cyan-500/5'
                          : 'border-neutral-800 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-white">{p.title}</div>
                        {updateState.policyLevel === p.level && (
                          <span className="text-xs font-mono bg-cyan-500/20 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
                            Active Policy
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-neutral-400">Audit Logs, Deployments & Rollbacks</div>
                <div className="space-y-2">
                  {updateState.history.map((log) => (
                    <div key={log.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <strong className="text-white font-semibold">{log.updateName}</strong>
                        <span className="text-neutral-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-cyan-400">
                        <GitCommit className="w-3.5 h-3.5" />
                        {log.action}
                      </div>
                      <p className="text-xs text-neutral-400">{log.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
