import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Utensils,
  Radio,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AgentTask, TaskStepItem } from '../types';

interface TaskCardProps {
  task: AgentTask | null;
  onConfirm?: (actionId: string, params?: any) => void;
  onCancel?: (taskId: string) => void;
  onDismiss?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onConfirm,
  onCancel,
  onDismiss,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!task) return null;

  const isCompleted = task.state === 'COMPLETED';
  const isFailed = task.state === 'FAILED';
  const isWaitingUser = task.state === 'WAITING_FOR_USER' || task.state === 'WAITING_FOR_PERMISSION';
  const isExecuting = task.state === 'EXECUTING' || task.state === 'PLANNING' || task.state === 'UNDERSTANDING';

  // Category Icon Resolver
  const getCategoryIcon = () => {
    switch (task.category) {
      case 'streaming_setup':
        return <Radio className="w-4 h-4 text-cyan-400" />;
      case 'restaurant_booking':
        return <Utensils className="w-4 h-4 text-amber-400" />;
      case 'schedule':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      default:
        return <Layers className="w-4 h-4 text-cyan-400" />;
    }
  };

  // Status Badge
  const getStatusBadge = () => {
    switch (task.state) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Completed
          </span>
        );
      case 'WAITING_FOR_USER':
      case 'WAITING_FOR_PERMISSION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" />
            Waiting for confirmation
          </span>
        );
      case 'EXECUTING':
      case 'PLANNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            In progress
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Attention required
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Active
          </span>
        );
    }
  };

  const completedStepsCount = task.steps.filter((s) => s.status === 'completed').length;
  const progressPercent = task.steps.length > 0 ? (completedStepsCount / task.steps.length) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-md mx-auto my-2 overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/85 backdrop-blur-xl shadow-2xl shadow-cyan-950/40"
      >
        {/* Top Progress Bar */}
        <div className="h-1 w-full bg-slate-800/80 overflow-hidden">
          <motion.div
            className={`h-full ${
              isCompleted
                ? 'bg-emerald-400'
                : isFailed
                ? 'bg-rose-500'
                : isWaitingUser
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>

        {/* Header Bar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 shrink-0">
              {getCategoryIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-100 truncate">{task.title}</h4>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{task.goal}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {getStatusBadge()}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-colors"
              title={isCollapsed ? 'Expand Task' : 'Collapse Task'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-colors"
                title="Dismiss Card"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Body */}
        {!isCollapsed && (
          <div className="px-4 py-3 space-y-3">
            {/* Steps Checklist */}
            <div className="space-y-1.5">
              {task.steps.map((step) => {
                const isStepCompleted = step.status === 'completed';
                const isStepExecuting = step.status === 'executing';
                const isStepFailed = step.status === 'failed';

                return (
                  <div
                    key={step.id || step.stepNumber}
                    className={`flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isStepExecuting
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : isStepCompleted
                        ? 'bg-slate-900/50'
                        : 'bg-transparent text-slate-400'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isStepCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : isStepExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      ) : isStepFailed ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[9px] text-slate-500 font-mono">
                          {step.stepNumber}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`font-medium ${
                            isStepCompleted
                              ? 'text-slate-200'
                              : isStepExecuting
                              ? 'text-cyan-200 font-semibold'
                              : isStepFailed
                              ? 'text-rose-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.title}
                        </span>
                        {step.toolName && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {step.toolName}
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1">{step.description}</p>
                      )}
                      {step.error && (
                        <p className="text-[11px] text-rose-400/90 mt-0.5">{step.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Proposal / Alternative Card Box (e.g. Restaurant booking slot) */}
            {task.alternativeProposal && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 space-y-0.5">
                  <span className="font-semibold text-amber-300">Alternative Available:</span>
                  <p>{task.alternativeProposal}</p>
                </div>
              </div>
            )}

            {/* Waiting for Confirmation Action Block */}
            {isWaitingUser && task.confirmationPrompt && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5">
                <p className="text-xs text-slate-200 font-medium">{task.confirmationPrompt}</p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (onConfirm && task.confirmationAction) {
                        onConfirm(task.confirmationAction.actionId, task.confirmationAction.params);
                      }
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:brightness-110 active:scale-95 shadow-md shadow-cyan-900/40 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{task.confirmationAction?.label || 'Confirm & Proceed'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (onCancel) {
                        onCancel(task.id);
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Result Summary on completion */}
            {isCompleted && task.resultSummary && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-200">{task.resultSummary}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
