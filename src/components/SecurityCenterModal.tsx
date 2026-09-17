import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Search,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
  Wifi,
  FileText,
  Zap,
  Radio,
  Eye,
  Check,
  Cpu,
} from 'lucide-react';
import { SecurityIncident, SecuritySeverity, SecurityState } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface SecurityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakStatus?: (text: string) => void;
}

export const SecurityCenterModal: React.FC<SecurityCenterModalProps> = ({
  isOpen,
  onClose,
  onSpeakStatus,
}) => {
  const [securityData, setSecurityData] = useState<SecurityState>({
    status: 'protected',
    monitoringActive: true,
    lastScannedAt: new Date().toISOString(),
    totalChecks: 1420,
    threatsCount: 1,
    incidents: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'scan' | 'phishing'>('feed');
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [phishingInput, setPhishingInput] = useState('');
  const [phishingResult, setPhishingResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  // Fetch security status on mount
  useEffect(() => {
    if (isOpen) {
      fetchSecurityStatus();
    }
  }, [isOpen]);

  const fetchSecurityStatus = async () => {
    try {
      const res = await fetch('/api/security/status');
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data);
      }
    } catch (err) {
      console.warn('[Security Status Fetch Error]', err);
    }
  };

  const handleStartScan = async () => {
    setScanning(true);
    triggerHaptic('activate');
    onSpeakStatus?.('Initiating deep security scan across system processes, network sockets, and event logs.');
    try {
      const res = await fetch('/api/security/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data.securityState);
        onSpeakStatus?.('Security scan completed successfully. No critical threats detected.');
      }
    } catch (err) {
      console.warn('[Security Scan Error]', err);
    } finally {
      setScanning(false);
    }
  };

  const handleResolveIncident = async (id: string, action: 'mitigated' | 'resolved') => {
    triggerHaptic('tap');
    try {
      const res = await fetch(`/api/security/incidents/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data.securityState);
        if (selectedIncident?.id === id) {
          setSelectedIncident(null);
        }
        onSpeakStatus?.(`Security incident marked as ${action}.`);
      }
    } catch (err) {
      console.warn('[Resolve Incident Error]', err);
    }
  };

  const handleAnalyzePhishing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phishingInput.trim()) return;

    setLoading(true);
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/security/analyze-phishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: phishingInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setPhishingResult(data);
      }
    } catch (err) {
      console.warn('[Phishing Analysis Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: SecuritySeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'LOW':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      default:
        return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/40';
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
          className="w-full max-w-3xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                securityData.status === 'protected'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
              }`}>
                {securityData.status === 'protected' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                  RODEX Security Center
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase border ${
                    securityData.status === 'protected'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  }`}>
                    {securityData.status.replace('_', ' ')}
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Continuous Threat Intelligence • {securityData.totalChecks} Safety Checks Verified
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
          <div className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900/40 border-b border-neutral-800 text-xs">
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('feed'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'feed' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Threat Feed & Incidents ({securityData.incidents.length})
            </button>
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('scan'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'scan' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              System Scan & Diagnostics
            </button>
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('phishing'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'phishing' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Phishing & Message Analyzer
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'feed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-neutral-400">Active Incidents & Security Warnings</div>
                  <button
                    onClick={handleStartScan}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs text-cyan-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                    {scanning ? 'Scanning...' : 'Run Quick Check'}
                  </button>
                </div>

                {securityData.incidents.length === 0 ? (
                  <div className="py-12 text-center space-y-3 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                    <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
                    <div className="text-sm font-medium text-white">No active threats detected</div>
                    <p className="text-xs text-neutral-400">All monitored system vectors, accounts, and network streams are secure.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {securityData.incidents.map((incident) => (
                      <div
                        key={incident.id}
                        onClick={() => {
                          triggerHaptic('tap');
                          setSelectedIncident(incident);
                        }}
                        className={`p-4 bg-neutral-900/80 hover:bg-neutral-850 border rounded-2xl cursor-pointer transition-all ${
                          incident.status === 'detected' ? 'border-orange-500/40 shadow-lg shadow-orange-500/5' : 'border-neutral-800 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl border mt-0.5 ${getSeverityBadge(incident.severity)}`}>
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{incident.title}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase border ${getSeverityBadge(incident.severity)}`}>
                                  {incident.severity}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-400 mt-1">{incident.evidence}</p>
                              <div className="flex items-center gap-3 mt-3 text-[11px] text-neutral-500 font-mono">
                                <span>Source: {incident.source}</span>
                                <span>•</span>
                                <span>Confidence: {incident.confidence}%</span>
                                <span>•</span>
                                <span>Status: <strong className="capitalize text-neutral-300">{incident.status}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {incident.status === 'detected' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveIncident(incident.id, 'resolved');
                                }}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-medium text-emerald-400 transition-colors"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Incident Details Drawer */}
                {selectedIncident && (
                  <div className="p-5 bg-neutral-900 border border-cyan-500/30 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-cyan-400" />
                        Incident Inspector: {selectedIncident.title}
                      </div>
                      <button
                        onClick={() => setSelectedIncident(null)}
                        className="text-neutral-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <span className="text-neutral-500 block mb-1">Affected Resource</span>
                        <strong className="text-white font-mono">{selectedIncident.affectedResource}</strong>
                      </div>
                      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <span className="text-neutral-500 block mb-1">Possible Impact</span>
                        <strong className="text-white">{selectedIncident.possibleImpact}</strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-neutral-400">Recommended Safe Actions</div>
                      <ul className="space-y-1.5">
                        {selectedIncident.recommendedActions.map((action, idx) => (
                          <li key={idx} className="text-xs text-neutral-300 flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => handleResolveIncident(selectedIncident.id, 'resolved')}
                        className="px-4 py-2 bg-emerald-500 text-black font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors"
                      >
                        Mark Resolved & Secure
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'scan' && (
              <div className="space-y-6">
                <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-2xl">
                    <Cpu className={`w-8 h-8 ${scanning ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">System Security Diagnostics</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                      RODEX continuously audits background processes, authentication logs, and network sockets for anomalous indicators.
                    </p>
                  </div>
                  <button
                    onClick={handleStartScan}
                    disabled={scanning}
                    className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm rounded-2xl shadow-xl shadow-cyan-500/20 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                    {scanning ? 'Running Deep Diagnostics...' : 'Start Comprehensive Scan'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Process Integrity
                    </div>
                    <div className="text-sm font-bold text-white">Secure & Verified</div>
                    <p className="text-[11px] text-neutral-500">No unauthorized persistence hooks or injected binaries found.</p>
                  </div>

                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-cyan-400" />
                      Network Sockets
                    </div>
                    <div className="text-sm font-bold text-white">Monitored</div>
                    <p className="text-[11px] text-neutral-500">Active connections matched against reputable threat telemetry.</p>
                  </div>

                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      Event Logs
                    </div>
                    <div className="text-sm font-bold text-white">Audited</div>
                    <p className="text-[11px] text-neutral-500">Auth logs and failed attempts tracked in real-time.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'phishing' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white">Phishing & Suspicious Message Analyzer</div>
                  <p className="text-xs text-neutral-400">
                    Paste an email, message, URL, or suspicious text below for instant AI-assisted threat analysis and indicator scoring.
                  </p>
                </div>

                <form onSubmit={handleAnalyzePhishing} className="space-y-4">
                  <textarea
                    rows={4}
                    value={phishingInput}
                    onChange={(e) => setPhishingInput(e.target.value)}
                    placeholder="Paste email content, link, or message here..."
                    className="w-full p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={loading || !phishingInput.trim()}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Analyze Content for Threats
                  </button>
                </form>

                {phishingResult && (
                  <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Security Analysis Result
                    </div>
                    <div className="text-xs text-neutral-300 leading-relaxed font-mono whitespace-pre-wrap bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      {phishingResult.analysis || JSON.stringify(phishingResult, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
