import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Bell,
  Sparkles,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export interface ScheduleItem {
  id: string;
  title: string;
  timeStr: string;
  category: 'reminder' | 'task' | 'meeting' | 'alarm';
  createdAt: string;
  status: 'active' | 'completed';
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddReminder?: (title: string, timeStr: string) => void;
}

const DEFAULT_SCHEDULES: ScheduleItem[] = [
  {
    id: 'sch_1',
    title: 'Study Autonomous Robotics & AI Systems',
    timeStr: '6:00 PM',
    category: 'reminder',
    createdAt: new Date().toISOString(),
    status: 'active',
  },
  {
    id: 'sch_2',
    title: 'Review Firebase Firestore Security Rules',
    timeStr: 'Tomorrow at 9:00 AM',
    category: 'task',
    createdAt: new Date().toISOString(),
    status: 'active',
  },
  {
    id: 'sch_3',
    title: 'Hydration & Posture Reset',
    timeStr: 'Every 2 hours',
    category: 'alarm',
    createdAt: new Date().toISOString(),
    status: 'active',
  },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onAddReminder,
}) => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem('rodex_user_schedules');
      return saved ? JSON.parse(saved) : DEFAULT_SCHEDULES;
    } catch {
      return DEFAULT_SCHEDULES;
    }
  });

  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newCategory, setNewCategory] = useState<'reminder' | 'task' | 'meeting' | 'alarm'>('reminder');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const saveSchedules = (items: ScheduleItem[]) => {
    setSchedules(items);
    try {
      localStorage.setItem('rodex_user_schedules', JSON.stringify(items));
    } catch (_) {}
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTime.trim()) return;

    triggerHaptic('success');
    const newItem: ScheduleItem = {
      id: `sch_${Date.now()}`,
      title: newTitle.trim(),
      timeStr: newTime.trim(),
      category: newCategory,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    const updated = [newItem, ...schedules];
    saveSchedules(updated);
    onAddReminder?.(newItem.title, newItem.timeStr);
    setNewTitle('');
    setNewTime('');
    setIsAdding(false);
  };

  const handleToggleComplete = (id: string) => {
    triggerHaptic('tap');
    const updated = schedules.map((item) =>
      item.id === id
        ? { ...item, status: item.status === 'active' ? ('completed' as const) : ('active' as const) }
        : item
    );
    saveSchedules(updated);
  };

  const handleDelete = (id: string) => {
    triggerHaptic('tap');
    const updated = schedules.filter((item) => item.id !== id);
    saveSchedules(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>Task & Schedule Hub</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-normal">
                  {schedules.filter((s) => s.status === 'active').length} Active
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Voice-controllable reminders, alarms & calendar tasks
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-3 px-5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between">
          <p className="text-xs text-neutral-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Say "Remind me at 6 PM to..." from the Orb anytime</span>
          </p>
          <button
            onClick={() => {
              triggerHaptic('tap');
              setIsAdding(!isAdding);
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Close Form' : 'New Task'}</span>
          </button>
        </div>

        {/* New Reminder Form */}
        {isAdding && (
          <form onSubmit={handleCreate} className="p-4 bg-neutral-900/90 border-b border-neutral-800 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Reminder / Task Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Study React & Node architecture"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Time / Frequency
                </label>
                <input
                  type="text"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="e.g. 6:00 PM or Tomorrow at 8 AM"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="reminder">Reminder</option>
                  <option value="task">Task</option>
                  <option value="meeting">Meeting</option>
                  <option value="alarm">Alarm</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs rounded-xl transition-all shadow-md shadow-cyan-500/20"
            >
              Add Scheduled Reminder
            </button>
          </form>
        )}

        {/* Schedule List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
          {schedules.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No active scheduled tasks.</p>
              <p className="text-[11px] text-neutral-600 mt-1">Speak to the Orb to create one naturally.</p>
            </div>
          ) : (
            schedules.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  item.status === 'completed'
                    ? 'bg-neutral-950/40 border-neutral-900 opacity-60'
                    : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(item.id)}
                    className={`mt-0.5 p-1 rounded-lg transition-colors ${
                      item.status === 'completed'
                        ? 'text-emerald-400 bg-emerald-950/60'
                        : 'text-neutral-500 hover:text-cyan-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium text-white truncate ${
                        item.status === 'completed' ? 'line-through text-neutral-500' : ''
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Clock className="w-3 h-3" />
                        {item.timeStr}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 uppercase tracking-wider text-[9px]">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
