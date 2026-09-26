import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Activity,
  ShieldCheck,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Database,
  Brain,
  Zap,
  Clock,
  Wrench,
  Lock,
  X,
  Play,
  Terminal,
  Radio,
  Wifi,
} from 'lucide-react';
import { DoctorDiagnosticReport, AutoRepairResult, ServiceHealth, CircuitBreakerStatus } from '../../server/doctor/types';

interface RodexDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RodexDoctorModal: React.FC<RodexDoctorModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<DoctorDiagnosticReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [repairing, setRepairing] = useState<boolean>(false);
  const [repairLog, setRepairLog] = useState<AutoRepairResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'breakers' | 'env' | 'incidents' | 'rootcauses'>('overview');

  const fetchDoctorReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/doctor');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.warn('[Rodex Doctor UI] Failed fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDoctorReport();
    }
  }, [isOpen]);

  const handleTriggerRepair = async (serviceType?: string) => {
    setRepairing(true);
    try {
      const res = await fetch('/api/doctor/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceType }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepairLog(data.repairResults || []);
        if (data.postReport) {
          setReport(data.postReport);
        }
      }
    } catch (err) {
      console.warn('[Rodex Doctor UI] Repair exception:', err);
    } finally {
      setRepairing(false);
    }
  };

  if (!isOpen) return null;

  const getHealthBadge = (health?: string) => {
    switch (health) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            HEALTHY
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            DEGRADED
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            WARNING
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            CRITICAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Stethoscope className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">RODEX DOCTOR</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-300">
                  v1.2.0 RELIABILITY
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Master Self-Diagnostic, System Health Monitoring & Safe Auto-Repair Subsystem
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {report && getHealthBadge(report.overallHealth)}

            <button
              onClick={fetchDoctorReport}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Refresh Health Diagnostics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-zinc-800/80 bg-zinc-900/30 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Overview & Metrics
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'services'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Service Registry ({report ? Object.keys(report.services).length : 0})
          </button>
          <button
            onClick={() => setActiveTab('breakers')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'breakers'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Circuit Breakers
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'env'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Environment & Secrets
          </button>
          <button
            onClick={() => setActiveTab('rootcauses')}
            className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'rootcauses'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Root Causes
            {report && report.rootCauses.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                {report.rootCauses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-2 border-b-2 transition-colors ${
              activeTab === 'incidents'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Incident History
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !report ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Executing deep system diagnostic checks...</p>
            </div>
          ) : report ? (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-4">
                    <Activity className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">System Reliability Status</h3>
                      <p className="text-xs text-zinc-300 mt-0.5">{report.summaryMessage}</p>
                    </div>
                    <button
                      onClick={() => handleTriggerRepair()}
                      disabled={repairing}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                      <Wrench className={`w-3.5 h-3.5 ${repairing ? 'animate-spin' : ''}`} />
                      {repairing ? 'Repairing...' : 'Run Safe Auto-Repair'}
                    </button>
                  </div>

                  {/* Resource & Runtime Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Server Uptime
                      </div>
                      <div className="text-lg font-mono font-bold text-white">
                        {report.resources.uptimeSeconds}s
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        Heap Memory Usage
                      </div>
                      <div className="text-lg font-mono font-bold text-white">
                        {report.resources.heapUsedMB} MB / {report.resources.heapTotalMB} MB
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        Avg Response Latency
                      </div>
                      <div className="text-lg font-mono font-bold text-white">
                        {report.resources.avgLatencyMs} ms
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        Cache Hit Rate
                      </div>
                      <div className="text-lg font-mono font-bold text-white">
                        {report.resources.cacheHitRate}
                      </div>
                    </div>
                  </div>

                  {/* Repair Execution Log Display */}
                  {repairLog && repairLog.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        SAFE AUTO-REPAIR EXECUTION RESULTS
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {repairLog.map((r, i) => (
                          <div key={i} className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300">
                            <span className="font-mono text-cyan-300 font-bold">[{r.service}]</span> {r.actionTaken} — {r.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SERVICES REGISTRY */}
              {activeTab === 'services' && (
                <div className="space-y-3">
                  {(Object.values(report.services) as ServiceHealth[]).map((srv) => (
                    <div
                      key={srv.type}
                      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-800 text-cyan-400">
                          {srv.type === 'backend' ? (
                            <Server className="w-4 h-4" />
                          ) : srv.type === 'database' || srv.type === 'memory_system' ? (
                            <Database className="w-4 h-4" />
                          ) : srv.type === 'ai_provider' ? (
                            <Brain className="w-4 h-4" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{srv.name}</span>
                            {srv.isCritical && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">
                            Latency: <span className="font-mono text-zinc-200">{srv.responseTimeMs}ms</span> | Dependencies:{' '}
                            <span className="text-zinc-300">{srv.dependencies.length ? srv.dependencies.join(', ') : 'None'}</span>
                          </p>
                          {srv.lastError && (
                            <p className="text-xs text-amber-400 mt-1 font-mono">└─ {srv.lastError}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getHealthBadge(srv.status)}
                        <button
                          onClick={() => handleTriggerRepair(srv.type)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Wrench className="w-3 h-3 text-cyan-400" />
                          Repair
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: CIRCUIT BREAKERS */}
              {activeTab === 'breakers' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    Circuit Breakers automatically isolate failing dependencies to prevent retry storms and infinite failure loops.
                  </div>

                  {report.circuitBreakers &&
                    (Object.values(report.circuitBreakers) as CircuitBreakerStatus[]).map((cb) => (
                      <div
                        key={cb.service}
                        className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4 font-mono text-xs"
                      >
                        <div>
                          <div className="font-bold text-white text-sm">{cb.service}</div>
                          <div className="text-zinc-400 text-[11px] mt-0.5">
                            Failures: <span className="text-zinc-200">{cb.failureCount}/{cb.failureThreshold}</span> | Cooldown: <span className="text-zinc-200">{cb.cooldownMs / 1000}s</span>
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            cb.state === 'CLOSED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : cb.state === 'HALF_OPEN'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {cb.state}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* TAB 4: ENVIRONMENT & SECRETS */}
              {activeTab === 'env' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    Security Masking Active: Raw secrets and API keys are strictly masked and never rendered.
                  </div>

                  {report.environmentChecks.map((env, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-mono font-bold text-white">{env.name}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{env.description}</div>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                          env.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : env.status === 'MISSING'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {env.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: ROOT CAUSES */}
              {activeTab === 'rootcauses' && (
                <div className="space-y-4">
                  {report.rootCauses.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">No Active Root-Cause Issues Detected</p>
                      <p className="text-xs text-zinc-400 mt-1">All monitored RODEX components are functioning within nominal parameters.</p>
                    </div>
                  ) : (
                    report.rootCauses.map((rc, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300 text-sm">{rc.title}</span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                            {rc.severity}
                          </span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{rc.description}</p>
                        <div className="pt-2 border-t border-amber-500/20 font-mono text-cyan-300">
                          <span className="font-bold text-white">Actionable Fix:</span> {rc.actionableFix}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: INCIDENTS */}
              {activeTab === 'incidents' && (
                <div className="space-y-3 font-mono text-xs">
                  {report.incidentHistory.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                      <Terminal className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                      <p className="text-sm text-zinc-300">No Incidents Logged in History</p>
                    </div>
                  ) : (
                    report.incidentHistory.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 space-y-1"
                      >
                        <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                          <span>{inc.timestamp}</span>
                          <span className="text-cyan-400 font-bold">{inc.service}</span>
                        </div>
                        <div className="font-bold text-white">{inc.message}</div>
                        <div className="text-zinc-400 text-[11px]">Root Cause: {inc.rootCause}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-ping" />
            <span>RODEX Doctor Monitoring Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
